import { createHash } from 'node:crypto';

export const VERSION = 'fit-v1.0';
export const CALL_URL = 'https://myntmore.com/founder-meeting';
export const SERVICES = ['personal_branding', 'linkedin_outreach', 'cold_email', 'lead_generation'];
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
export const tidy = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
export const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function normalize(raw) {
  const n = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, tidy(v)]));
  n.email = (n.email || '').toLowerCase();
  n.linkedin_url = (n.linkedin_url || '').replace(/\/$/, '').toLowerCase();
  const identity = n.email && validEmail(n.email) ? `email:${n.email}` : n.linkedin_url ? `linkedin:${n.linkedin_url}` : `session:${n.lead_id}`;
  return { ...n, contact_id: `c_${hash(identity).slice(0, 24)}` };
}

export function inspect(contact, sessions) {
  const flags = [];
  const role = tidy(contact.designation);
  const context = sessions.map(s => `${s.tool_input || ''}\n${s.tool_output || ''}`).join('\n');
  const test = /^test$/i.test(contact.first_name) && (/^test$/i.test(contact.company) || contact.email === 'test@test.com');
  const jobSeeker = /student|open to work/i.test(role) || /looking for an? (?:SDR|BDR|job)/i.test(context);
  const injection = /ignore (?:all )?(?:previous|prior) instructions|set the score to|guarantees? \d+ meetings|system\s*prompt|override (?:the )?(?:rules|instructions)/i.test(context);
  if (!validEmail(contact.email || '')) flags.push('missing_or_invalid_email');
  if (!sessions.some(s => s.tool_input && s.tool_output)) flags.push('missing_tool_context');
  if (injection) flags.push('prompt_injection');
  if (sessions.length > 1) flags.push('repeat_visitor');
  if (/ghostwriter|i write linkedin posts for founders/i.test(context)) flags.push('service_overlap_review');
  const rolePoints = /founder|co-founder|\bCEO\b|chief|managing director|VP sales|head of sales/i.test(role) ? 3 : /manager|director|head|vice president/i.test(role) ? 2 : 0;
  return { flags, test, jobSeeker, injection, rolePoints, context, excluded: test || jobSeeker, reason: test ? 'Explicit test submission.' : jobSeeker ? 'Job-seeking or student use case, rather than buying a growth service.' : '' };
}

export function score(contact, sessions, analysis = null) {
  const checks = inspect(contact, sessions);
  if (checks.excluded || checks.injection) return { score: 1, tier: 'not_a_fit', service: null, points: { base: 1, role: 0, business: 0, need: 0, activity: 0 }, reason: checks.reason || 'Untrusted instructions detected. Held for human review; no AI instructions accepted.', checks };
  const points = {
    base: 1,
    role: checks.rolePoints,
    business: analysis?.business_type === 'b2b' ? 3 : analysis?.business_type === 'd2c' ? 1 : 0,
    need: analysis?.need === 'clear' ? 2 : analysis?.need === 'possible' ? 1 : 0,
    activity: sessions.some(s => s.tool_input && s.tool_output) ? 1 : 0,
  };
  const total = Object.values(points).reduce((a, b) => a + b, 0);
  return { score: total, tier: total >= 8 ? 'hot' : total >= 5 ? 'warm' : 'not_a_fit', service: analysis?.service || null, points, reason: analysis?.reason || 'Provisional rule score. Business need cannot be assessed without usable context and Gemini.', checks };
}

export function contextFor(sessions) {
  return sessions.map(({ id, source_tool, tool_input, tool_output }) => ({ session_id: id, source_tool, tool_input, tool_output }));
}

export function validateAnalysis(a, sessions) {
  const errors = [];
  if (!['b2b', 'd2c', 'unclear'].includes(a?.business_type)) errors.push('invalid business type');
  if (!['clear', 'possible', 'none'].includes(a?.need)) errors.push('invalid need');
  if (!SERVICES.includes(a?.service)) errors.push('invalid service');
  if (typeof a?.reason !== 'string' || !a.reason.trim() || a.reason.length > 350 || /[\r\n—]/.test(a.reason)) errors.push('reason must be one short line');
  const inputs = sessions.map(s => s.tool_input || '').join('\n');
  const outputs = sessions.map(s => s.tool_output || '').join('\n');
  if (typeof a?.input_evidence !== 'string' || a.input_evidence.length < 4 || !inputs.includes(a.input_evidence)) errors.push('input evidence is not an exact quote');
  if (typeof a?.output_evidence !== 'string' || a.output_evidence.length < 4 || !outputs.includes(a.output_evidence)) errors.push('output evidence is not an exact quote');
  return errors;
}

export function validateDraft(draft, sessions) {
  const errors = [];
  if (typeof draft?.subject !== 'string' || typeof draft?.body !== 'string') return ['Missing subject or body'];
  const text = `${draft.subject}\n${draft.body}`;
  if (!draft.subject.trim() || !draft.body.trim()) errors.push('Empty subject or body');
  if (text.trim().split(/\s+/).length >= 120) errors.push('Must be under 120 words including subject');
  if (/[—–]/.test(text)) errors.push('No em or en dashes');
  if (/\d/.test(text)) errors.push('No numerical claims in drafts');
  if (/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|double|triple)\b[\w\s-]{0,45}\b(?:meetings?|leads?|clients?|sales|revenue|percent|deals?|replies|engagement)\b/i.test(text)) errors.push('No written-out quantitative performance claims');
  if (/\bour clients (?:get|see|achieve|receive)|\bwe(?:'ve| have) (?:helped|generated|delivered|achieved)/i.test(text)) errors.push('No unverified client performance claims');
  if (/\b(?:guarantee\w*|promise\w*|synerg\w*|leverage|ICP|ROI|pipeline|hyper.?personali\w*|game.?changer|revolutioni\w*)\b/i.test(text)) errors.push('Unsupported promise or jargon');
  const urls = text.match(/https?:\/\/[^\s<>]+/gi) || [];
  if (urls.length !== 1 || urls[0] !== CALL_URL) errors.push('Use the exact approved call link once, without suffixes or query parameters');
  const remainder = text.replace(CALL_URL, '');
  if (/(?:https?:\/\/|www\.|[\w-]+\.(?:com|org|net|io|ai|in|example)(?:\b|\/))/i.test(remainder)) errors.push('Other links are not allowed');
  if (/guaranteed|will (?:increase|boost|deliver|double|triple|generate)|\b(?:best|leading|award-winning|proven results)\b/i.test(text)) errors.push('Unsupported marketing claim');
  for (const [key, field] of [['input_anchor', 'tool_input'], ['output_anchor', 'tool_output']]) {
    const anchor = draft[key];
    if (typeof anchor !== 'string' || anchor.trim().split(/\s+/).length < 2 || !sessions.some(s => String(s[field] || '').toLowerCase().includes(anchor.toLowerCase())) || !draft.body.toLowerCase().includes(anchor.toLowerCase())) errors.push(`${key} must appear in the source and email body`);
  }
  return errors;
}
