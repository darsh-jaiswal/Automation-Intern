import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { MemoryStore } from '../src/store.mjs';
import { Engine } from '../src/engine.mjs';
import { normalize, score, inspect, validateDraft, CALL_URL } from '../src/rules.mjs';
import { retry } from '../src/providers.mjs';

const rows = parse(await readFile(new URL('../leads.csv', import.meta.url), 'utf8'), { columns: true });
const row = id => rows.find(r => r.lead_id === id);
const fakeAi = {
  calls: 0,
  async analyse(_contact, sessions) { this.calls++; const s = sessions.find(s => s.tool_input && s.tool_output); return { business_type: 'b2b', need: 'clear', service: 'linkedin_outreach', reason: 'A business leader has a stated outreach need.', input_evidence: s.tool_input.slice(0, 15), output_evidence: s.tool_output.slice(0, 15) }; },
  async draft() { return { subject: 'A practical next step', body: `Your corporate travel offer and DM angles suggest a useful starting point. Try one opening that focuses on the team offsite problem. Would a conversation help? ${CALL_URL}\nMyntmore`, input_anchor: 'corporate travel', output_anchor: 'DM angles' }; },
};
function setup(ai = fakeAi, crm = { configured: false }) { const store = new MemoryStore(); const engine = new Engine({ store, ai, crm, model: 'test-double-not-live-gemini' }); return { store, engine }; }

test('all 20 sessions survive, with 19 contacts and separate company contacts', async () => {
  const { engine, store } = setup();
  const imported = await engine.ingest(rows);
  assert.equal(imported.sessions, 20); assert.equal(imported.contacts, 19);
  assert.equal(normalize(row('L03')).contact_id, normalize(row('L11')).contact_id);
  assert.notEqual(normalize(row('L02')).contact_id, normalize(row('L15')).contact_id);
  assert.equal((await store.get('sessions', 'L19')).raw.tool_input, row('L19').tool_input);
});
test('repeat import does not overwrite raw sessions or duplicate rows', async () => {
  const { engine, store } = setup(); await engine.ingest(rows);
  const original = await store.get('sessions', 'L01');
  assert.equal((await engine.ingest(rows)).added, 0);
  assert.deepEqual(await store.get('sessions', 'L01'), original);
  await assert.rejects(engine.ingest([{ ...row('L01'), tool_input: 'changed' }]), /different data/);
});
test('test, student, job seeker and injection are handled without calling AI', async () => {
  const { engine } = setup({ analyse() { throw Error('AI must not be called'); } });
  await engine.ingest(['L07','L09','L14','L19'].map(row));
  for (const id of ['L07','L09','L14','L19']) {
    const assessment = await engine.assess(normalize(row(id)).contact_id);
    assert.equal(assessment.score, 1); assert.equal(assessment.draft, null);
    assert.equal(assessment.status, id === 'L19' ? 'needs_review' : 'complete');
  }
});
test('missing email keeps business fit but holds drafting; missing context is explicit', async () => {
  const { engine } = setup(); await engine.ingest([row('L18'), row('L05')]);
  const noEmail = await engine.assess(normalize(row('L18')).contact_id);
  assert.equal(noEmail.status, 'needs_review'); assert.ok(noEmail.score >= 8);
  assert.equal((await engine.draft(noEmail.id)).draft, null);
  const noContext = await engine.assess(normalize(row('L05')).contact_id);
  assert.equal(noContext.status, 'needs_review'); assert.ok(noContext.flags.includes('missing_tool_context'));
});
test('scoring is bounded and thresholds are deterministic', () => {
  const contact = normalize(row('L12')); const sessions = [row('L12')];
  const analysis = { business_type: 'b2b', need: 'clear', service: 'linkedin_outreach', reason: 'Reason' };
  assert.equal(score(contact, sessions, analysis).score, 10);
  assert.equal(score(contact, sessions, analysis).tier, 'hot');
  assert.deepEqual(score(contact, sessions, analysis), score(contact, sessions, analysis));
  assert.equal(score(contact, sessions, { ...analysis, business_type: 'd2c', need: 'possible' }).tier, 'warm');
});
test('free/personal email is not an exclusion', () => { assert.equal(inspect(normalize(row('L12')), [row('L12')]).excluded, false); });
test('a staffing company selling to hiring managers is not a job seeker', () => {
  assert.equal(inspect({ designation: 'Founder' }, [{ tool_input: 'We sell recruiting software. ICP role: hiring managers', tool_output: 'DM angles generated' }]).excluded, false);
});
test('failed Gemini is recorded with provisional score, never a completed AI result', async () => {
  const { engine, store } = setup({ analyse: async () => { throw Error('Provider request failed (HTTP 429).'); } });
  await engine.ingest([row('L12')]); const a = await engine.assess(normalize(row('L12')).contact_id);
  assert.equal(a.status, 'assessment_error'); assert.equal(a.analysis, null); assert.equal(a.draft, null);
  assert.ok((await store.all('events')).some(e => e.level === 'error'));
});
test('invented evidence is rejected', async () => {
  const { engine } = setup({ analyse: async () => ({ business_type: 'b2b', need: 'clear', service: 'cold_email', reason: 'Reason', input_evidence: 'fake quote', output_evidence: 'fake quote' }) });
  await engine.ingest([row('L12')]); const a = await engine.assess(normalize(row('L12')).contact_id); assert.equal(a.status, 'assessment_error');
});
test('invalid drafts are corrected and valid drafts are idempotent', async () => {
  let count = 0;
  const ai = { ...fakeAi, async draft(...args) { count++; return count === 1 ? { subject: 'We guarantee 50 meetings', body: 'No' } : fakeAi.draft(...args); } };
  const { engine, store } = setup(ai); await engine.ingest([row('L12')]);
  const a = await engine.assess(normalize(row('L12')).contact_id);
  const draft = await engine.draft(a.id); assert.equal(draft.status, 'ready'); assert.equal(draft.validation.attempts, 2);
  await engine.draft(a.id); assert.equal(count, 2);
  await engine.publish(a.id); await engine.publish(a.id);
  assert.equal((await store.all('alerts')).length, 1);
});
test('rejected drafts never become ready or create hot alerts', async () => {
  const ai = { ...fakeAi, async draft() { return { subject: 'Guaranteed 50 meetings', body: 'Invented' }; } };
  const { engine, store } = setup(ai); await engine.ingest([row('L12')]);
  const a = await engine.assess(normalize(row('L12')).contact_id); await engine.draft(a.id); await engine.publish(a.id);
  assert.equal((await store.get('assessments', a.id)).status, 'draft_error'); assert.equal((await store.all('alerts')).length, 0);
});
test('Zoho failure is retryable without regenerating a validated draft', async () => {
  let calls = 0;
  const { engine, store } = setup(fakeAi, { configured: true, async upsert() { calls++; if(calls === 1) throw Error('Zoho rejected the record'); return 'crm-test-id'; } });
  await engine.ingest([row('L12')]); const a = await engine.assess(normalize(row('L12')).contact_id); await engine.draft(a.id);
  const draftBefore = (await store.get('assessments', a.id)).draft;
  assert.equal((await engine.publish(a.id)).crm_status, 'error');
  assert.equal((await engine.publish(a.id)).crm_status, 'synced');
  assert.deepEqual((await store.get('assessments', a.id)).draft, draftBefore);
});
test('future Hook Grader session joins the same contact and invalidates the old assessment', async () => {
  const { engine } = setup(); await engine.ingest([row('L12')]); const before = await engine.work(normalize(row('L12')).contact_id);
  await engine.ingest([{ ...row('L12'), lead_id: 'hook-test-1', source_tool: 'hook_grader', tool_input: 'A new hook', tool_output: 'Score and rewrites' }]);
  const after = await engine.work(before.contact.id); assert.notEqual(before.id, after.id); assert.equal(after.sessions.length, 2);
});
test('draft checks reject extra links, jargon, dashes, numbers and unsupported anchors', async () => {
  const valid = await fakeAi.draft(); assert.deepEqual(validateDraft(valid, [row('L12')]), []);
  for(const bad of [{ ...valid, body: valid.body + ' https://evil.example' }, { ...valid, subject: 'Your ICP pipeline' }, { ...valid, subject: 'Hello — there' }, { ...valid, subject: '50 meetings' }, { ...valid, input_anchor: 'Made up' }, { ...valid, body: 'word '.repeat(120) + CALL_URL }]) assert.ok(validateDraft(bad, [row('L12')]).length > 0);
  assert.ok(validateDraft({ ...valid, body: valid.body.replace(CALL_URL, CALL_URL + '/other') }, [row('L12')]).length > 0);
  assert.ok(validateDraft({ ...valid, body: valid.body + ' Our clients get fifty meetings every month.' }, [row('L12')]).length > 0);
});
test('stale assessments cannot be drafted or published after new evidence arrives', async () => {
  const { engine } = setup(); await engine.ingest([row('L12')]); const a=await engine.assess(normalize(row('L12')).contact_id);
  await engine.ingest([{ ...row('L12'), lead_id: 'new-session', tool_input: 'New relevant evidence' }]);
  await assert.rejects(engine.draft(a.id), /superseded/); await assert.rejects(engine.publish(a.id), /superseded/);
});
test('transient requests retry; non-transient failures stop immediately', async () => {
  let calls = 0; const sleep = async () => {};
  assert.equal(await retry(async () => { calls++; if(calls < 3) { const e=Error('transient'); e.retryable=true; throw e; } return 'ok'; }, { sleep }), 'ok');
  assert.equal(calls, 3); calls = 0;
  await assert.rejects(retry(async () => { calls++; throw Error('bad credential'); }, { sleep })); assert.equal(calls, 1);
});
