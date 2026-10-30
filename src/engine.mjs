import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { normalize, hash, inspect, score, contextFor, validateAnalysis, validateDraft, VERSION, validEmail, tidy } from './rules.mjs';

const CONTACT_FIELDS = ['first_name', 'last_name', 'designation', 'email', 'company', 'company_website', 'linkedin_url'];
const now = () => new Date().toISOString();

export class Engine {
  constructor({ store, ai, crm, model }) { Object.assign(this, { store, ai, crm, model }); this.busy = false; }
  // Serialise local requests so a dashboard click cannot race an n8n execution.
  async exclusive(fn) { if (this.busy) { const e = new Error('A processing run is already active. Retry after it finishes.'); e.status = 409; throw e; } this.busy = true; try { return await fn(); } finally { this.busy = false; } }
  async event(contactId, stage, level, message) {
    await this.store.put('events', { id: randomUUID(), contact_id: contactId, stage, level, message, created_at: now() });
  }
  async importCsv(path) {
    const rows = parse(await readFile(path, 'utf8'), { columns: true, bom: true, skip_empty_lines: true });
    if (!rows.length || !['lead_id', 'source_tool', 'email', 'tool_input', 'tool_output'].every(k => Object.hasOwn(rows[0], k))) throw new Error('CSV is empty or missing required columns. No rows imported.');
    return this.ingest(rows);
  }
  async ingest(rows) {
    if (!Array.isArray(rows) || rows.length > 100) throw new Error('Provide between one and 100 sessions.');
    const planned = new Map();
    for (const raw of rows) {
      if (!tidy(raw.lead_id) || !tidy(raw.source_tool)) throw new Error('Every session requires a stable lead_id and source_tool.');
      const row = normalize(raw);
      const payloadHash = hash(raw);
      const existing = planned.get(row.lead_id) || await this.store.get('sessions', row.lead_id);
      if (existing && existing.payload_hash !== payloadHash) throw new Error(`Session ${row.lead_id} already exists with different data. Preserve the original and supply a new session ID.`);
      planned.set(row.lead_id, { id: row.lead_id, contact_id: row.contact_id, source_tool: row.source_tool, created_at: row.created_at || '', tool_input: row.tool_input || '', tool_output: row.tool_output || '', raw, payload_hash: payloadHash, imported_at: now(), normalized: row });
    }
    let added = 0;
    for (const item of planned.values()) {
      if (await this.store.get('sessions', item.id)) continue;
      const { normalized, ...session } = item;
      const existing = await this.store.get('contacts', session.contact_id);
      const contact = { id: session.contact_id, updated_at: now() };
      for (const field of CONTACT_FIELDS) contact[field] = normalized[field] || existing?.[field] || '';
      await this.store.put('contacts', contact);
      await this.store.put('sessions', session, { ignoreDuplicates: true });
      added++;
    }
    await this.event(null, 'import', 'info', `Received ${rows.length} rows; added ${added}; retained ${rows.length - added} unchanged duplicates.`);
    return { received: rows.length, added, unchanged: rows.length - added, sessions: (await this.store.all('sessions')).length, contacts: (await this.store.all('contacts')).length };
  }
  async work(contactId) {
    const contact = await this.store.get('contacts', contactId);
    if (!contact) throw new Error('Contact not found.');
    const sessions = (await this.store.all('sessions', { contact_id: contactId })).sort((a,b) => a.id.localeCompare(b.id));
    const fingerprint = hash({ version: VERSION, model: this.model, contact: CONTACT_FIELDS.map(k => contact[k]), sessions: sessions.map(s => [s.id, s.payload_hash]) });
    return { contact, sessions, id: `a_${fingerprint.slice(0, 32)}` };
  }
  async assess(contactId) {
    const { contact, sessions, id } = await this.work(contactId);
    const existing = await this.store.get('assessments', id);
    if (existing && !['assessment_error', 'draft_error'].includes(existing.status)) return existing;
    const checks = inspect(contact, sessions);
    let analysis = existing?.analysis || null;
    let status = 'assessed'; let error = null;
    const blocked = checks.excluded || checks.flags.includes('missing_tool_context') || checks.injection;
    if (!blocked && !analysis) {
      try {
        analysis = await this.ai.analyse(contact, contextFor(sessions));
        const errors = validateAnalysis(analysis, sessions);
        if (errors.length) throw new Error(`Assessment validation failed: ${errors.join('; ')}`);
      } catch (e) { status = 'assessment_error'; error = e.message; analysis = null; }
    }
    const result = score(contact, sessions, analysis);
    const flags = [...result.checks.flags];
    if (checks.excluded) status = 'complete';
    else if (checks.flags.some(f => ['missing_tool_context', 'prompt_injection', 'missing_or_invalid_email', 'service_overlap_review'].includes(f))) status = 'needs_review';
    // Provider failures remain failures even when a record also needs human review.
    if (error) { status = 'assessment_error'; flags.push('ai_assessment_failed'); }
    const assessment = {
      id, contact_id: contactId, version: VERSION, model: this.model, session_ids: sessions.map(s => s.id),
      score: result.score, tier: result.tier, service: result.service, points: result.points, reason: result.reason,
      flags, status, analysis, draft: null, validation: null,
      crm_status: 'pending', crm_id: null, error,
      created_at: existing?.created_at || now(), updated_at: now(),
    };
    await this.store.put('assessments', assessment);
    await this.event(contactId, 'assessment', error ? 'error' : 'info', error || `${assessment.score}/10 ${assessment.tier}: ${assessment.reason}`);
    return assessment;
  }
  async draft(assessmentId) {
    const a = await this.store.get('assessments', assessmentId);
    if (!a) throw new Error('Assessment not found.');
    if ((await this.work(a.contact_id)).id !== a.id) { const e = new Error('Assessment is superseded by newer session data. Reassess this contact.'); e.status = 409; throw e; }
    if (a.status !== 'assessed') return a;
    if (a.tier === 'not_a_fit') { a.status = 'complete'; await this.store.put('assessments', a); return a; }
    const { contact, sessions } = await this.work(a.contact_id);
    let correction = [];
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = await this.ai.draft(contact, contextFor(sessions), a, correction);
        correction = validateDraft(candidate, sessions);
        if (!correction.length) {
          a.draft = candidate; a.validation = { passed: true, attempts: attempt + 1, word_count: `${candidate.subject} ${candidate.body}`.trim().split(/\s+/).length, rules: 'under 120 words; no digits/dashes/jargon/promises; allowed link only; evidence anchors from input and output' };
          a.status = 'ready'; a.error = null; break;
        }
      }
      if (!a.draft) throw new Error(`Draft rejected after three attempts: ${correction.join('; ')}`);
    } catch (e) { a.status = 'draft_error'; a.error = e.message; a.validation = { passed: false, errors: correction }; }
    a.updated_at = now(); await this.store.put('assessments', a);
    await this.event(a.contact_id, 'draft', a.error ? 'error' : 'info', a.error || 'AI draft passed the automated checks. No message was sent.');
    return a;
  }
  async publish(assessmentId) {
    const a = await this.store.get('assessments', assessmentId);
    if (!a) throw new Error('Assessment not found.');
    if ((await this.work(a.contact_id)).id !== a.id) { const e = new Error('Assessment is superseded by newer session data. Reassess this contact.'); e.status = 409; throw e; }
    if (['assessment_error', 'draft_error', 'assessed'].includes(a.status)) return a;
    const contact = await this.store.get('contacts', a.contact_id);
    if (a.tier === 'hot' && a.draft && a.validation?.passed) await this.store.put('alerts', { id: a.id, assessment_id: a.id, contact_id: a.contact_id, message: `Hot lead: ${contact.first_name} ${contact.last_name} at ${contact.company}. Review the draft.`, created_at: a.created_at }, { ignoreDuplicates: true });
    if (a.crm_status === 'synced') return a;
    if (!validEmail(contact.email) || inspect(contact, []).test) a.crm_status = 'skipped';
    else if (!this.crm.configured) a.crm_status = 'not_configured';
    else {
      try { a.crm_id = await this.crm.upsert(contact, a); a.crm_status = 'synced'; a.error = null; }
      catch (e) { a.crm_status = 'error'; a.error = e.message; await this.event(a.contact_id, 'zoho', 'error', e.message); }
    }
    if (a.status === 'ready') a.status = 'complete';
    a.updated_at = now(); await this.store.put('assessments', a);
    return a;
  }
  async run() {
    const results = [];
    for (const contact of await this.store.all('contacts')) {
      const a = await this.assess(contact.id);
      await this.draft(a.id);
      results.push(await this.publish(a.id));
    }
    return this.summary(results);
  }
  summary(assessments) {
    return { contacts: assessments.length, hot: assessments.filter(a => a.tier === 'hot').length, warm: assessments.filter(a => a.tier === 'warm').length, not_a_fit: assessments.filter(a => a.tier === 'not_a_fit').length, drafts: assessments.filter(a => a.draft).length, review: assessments.filter(a => a.status === 'needs_review').length, errors: assessments.filter(a => /error/.test(a.status) || a.crm_status === 'error').length, crm_synced: assessments.filter(a => a.crm_status === 'synced').length };
  }
  async state() {
    const [contacts, sessions, allAssessments, alerts, events] = await Promise.all(['contacts', 'sessions', 'assessments', 'alerts', 'events'].map(t => this.store.all(t)));
    const assessments = [];
    for (const c of contacts) {
      const { id } = await this.work(c.id);
      const a = allAssessments.find(item => item.id === id);
      if (a) assessments.push(a);
    }
    return { contacts, sessions, assessments, alerts: alerts.filter(alert => assessments.some(a => a.id === alert.assessment_id)), events: events.sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0, 100), summary: this.summary(assessments) };
  }
}
