import { Document, Packer, Paragraph, TextRun, HeadingLevel, Footer, PageNumber, Table, TableRow, TableCell, WidthType } from 'docx';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const observed = JSON.parse(await readFile(join(root, 'docs/task3/observations.json'), 'utf8'));
if (observed.rows.length !== 15 || observed.rows.some(row => row.status !== 'complete' || !['Yes', 'No'].includes(row.appears))) {
  throw new Error('All fifteen observed Task 3 answers must be complete before generating the combined recording notes.');
}
const mentions = observed.rows.filter(row => row.appears === 'Yes');
const children = [];
const p = text => children.push(new Paragraph({ text, spacing: { after: 115 } }));
const h = text => children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 230, after: 110 } }));
const sub = text => children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 170, after: 90 } }));
const table = (headers, rows) => children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [headers, ...rows].map((cells, index) => new TableRow({ children: cells.map(text => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: index === 0 })], spacing: { after: 70 } })],
  })) })),
}));
children.push(new Paragraph({ text: 'All three tasks - Loom walkthrough', heading: HeadingLevel.TITLE }));
p('Darsh Jaiswal | Myntmore Systems & AI Automation Intern | Round 2');
p('One recording guide for Tasks 1, 2 and 3. Start with the short walkthrough, then use the reference sections to prepare for questions. Aim for about five minutes; this is a suggested recording pace.');
p('Janvi allowed tools of my choice. I used Claude for the live AI features. Supabase stores the data, n8n coordinates follow-up processing, Zoho holds drafts, and the Next.js tool is deployed on Vercel.');

h('Before recording');
p('Keep the camera on. Open only the demo pages you need: the operator dashboard, the original sample rows in Supabase, the n8n workflow, a fictional Zoho lead, the live Hook Grader, and the Task 3 written answer and comparison table. Keep .env files, API-key screens and billing details out of view.');
p('The local worker, n8n and relay must be running for automatic follow-up processing. The public tool can save sessions while they are offline; those queued sessions wait. Check the current status on screen rather than assuming the services are running.');
p('Use fictional sample contacts. Reuse an existing saved Hook Grader session when possible. A fresh live grade calls Claude and can use API credit; unit tests use test doubles.');

h('Suggested five-minute walkthrough');
sub('00:00-00:15 | Introduce the assignment');
p('SHOW: the repository or operator dashboard.');
p('SAY: "I built a lead follow-up workflow, a LinkedIn Hook Grader, and an operations analysis. I used AI coding assistance, then checked the behavior with tests and live examples. Janvi allowed a different AI provider, so the live features use Claude."');
sub('00:15-00:55 | Task 1: preserve and clean the data');
p('SHOW: the twenty original CSV sessions in Supabase and the repeat-visit example L03 and L11.');
p('SAY: "I kept every original row. Repeat visits are grouped into one contact, but both sessions stay available. Test entries, job seekers and incomplete records get a reason or a review status. Nothing disappears silently."');
sub('00:55-01:25 | Task 1: explain the score');
p('SHOW: one contact with its score breakdown, source evidence and service fit.');
p('SAY: "Claude interprets the business need and suggests a suitable service with evidence. Code assigns the points and thresholds. Eight to ten is Hot, five to seven is Warm, and one to four is Not a fit. A senior job title alone cannot make a weak-fit visitor Hot."');
sub('01:25-02:00 | Task 1: draft and route');
p('SHOW: a validated email, the n8n execution and the matching fictional Zoho lead Description.');
p('SAY: "The draft uses both what the visitor typed and what the tool returned. Code checks the length, wording, evidence and approved booking link. Hot leads get a draft and an alert; Warm leads get a nurture draft; Not-a-fit leads keep their reason. Zoho stores the draft. No email is sent. Failures remain visible and can be retried."');
sub('02:00-03:15 | Task 2: demonstrate the Hook Grader');
p('SHOW: https://myntmore-hook-grader-darsh.vercel.app, the contact form, one saved hook result, its failed rules, and the three alternatives. Then show the corresponding Supabase row and n8n webhook execution.');
p('SAY: "The visitor enters a name, designation and email, accepts the notice, and pastes one or two opening lines. Six code rules calculate a score out of one hundred, so the same normalized hook gets the same score. Claude only returns three rewrites in structured JSON. The contact, hook, score, feedback and rewrites stay together in one session row. A saved queue passes the result into Task 1 through the n8n webhook. If the local services are offline, delivery waits safely."');
sub('03:15-03:45 | Task 3a: explain the silent bug');
p('SHOW: docs/task3/Task_3_Written_Answers.pdf.');
p('SAY: "The allowed-source list is missing Battle Card and Case Study, so Supabase rejects those records. Zoho runs separately, and the code only logs the database error. I would update the source list, save the lead and session together, queue CRM delivery, and make failures visible. This is my analysis of their example; I did not change their production database."');
sub('03:45-04:20 | Task 3b: show the actual AI results');
p('SHOW: docs/task3/Task_3_AI_Search.pdf and the screenshot docs/task3/screenshots/perplexity-q3-2.png.');
p(`SAY: "I asked the same five client questions in fresh chats on ChatGPT, Perplexity and Gemini and saved all fifteen answers with sources and screenshots. Myntmore appeared in ${mentions.length} of the fifteen answers: all three LinkedIn-outreach answers and Perplexity's SaaS cold-email answer. It was absent from every branding, exporter and Zoho answer. Accounts and modes differed, so these are observations from this run, not permanent rankings."`);
sub('04:20-05:00 | Recommend changes and finish');
p('SAY: "I would improve the existing service pages with direct buyer-question answers, publish a specific Zoho workflow page if that service is offered, and strengthen case studies with dates and checkable client evidence. The automation remains draft-only, the local services need to be running for follow-up, and people should review AI output before using it. Claude usage is tracked, but early unmetered calls and the remaining account balance are unknown."');

children.push(new Paragraph({ text: 'Reference notes - use these for preparation', heading: HeadingLevel.TITLE, pageBreakBefore: true }));
h('Task 1: lead follow-up engine');
p('Flow: preserve raw CSV sessions -> group contacts -> assess fit -> create and validate a draft -> save CRM context and alerts. The n8n canvas coordinates these stages. Draft text is stored in Zoho Lead Description. Workflow triggers and Cadences are suppressed on the API write.');
sub('Original sample snapshot, not current global totals');
p('The 30 October 2026 Task 1 verification recorded twenty original sessions, nineteen contacts, one Hot, thirteen Warm, five Not a fit, twelve validated drafts, four review holds, zero processing errors and seventeen CRM-synced contacts. Later Hook Grader demos add sessions and contacts. Confirm current totals before recording; these original-sample figures should not be described as current global totals.');
sub('Scoring: code versus Claude');
table(['Code rule', 'Points / behavior'], [
  ['Starting score', '1'],
  ['Decision-making role', 'Up to 3'],
  ['Business fit', 'B2B: 3; consumer-facing: 1; unclear: 0'],
  ['Relevant business need', 'Clear: 2; possible: 1; none: 0'],
  ['Completed tool session', '1'],
  ['Caps', 'Possible/adjacent need or consumer context: maximum 7. No relevant need: maximum 4.'],
  ['Routing', 'Hot: 8-10; Warm: 5-7; Not a fit: 1-4. Review holds can prevent drafting.'],
]);
p('Claude supplies the business type, need, service choice and a short reason backed by source quotes. It writes the subject, tailored advice and invitation. Code controls points, caps, exclusions, holds and routes, frames the draft with verified source excerpts, and validates the result. A failed or unknown analysis is provisional and does not become an accepted draft. This is an assignment rubric, not a measured model of sales conversion.');
sub('Messy-data examples');
table(['Sample row(s)', 'What happens and why'], [
  ['L03 + L11', 'One person, two sessions; preserve both and combine the context for one follow-up.'],
  ['L02 + L15', 'Different people at one company remain separate contacts.'],
  ['L07', 'Test entry; mark it and record the reason.'],
  ['L09 / L14', 'Student / job-seeking entry; tag the non-buyer reason.'],
  ['L05 / L18', 'Missing tool context / missing email; hold for review.'],
  ['L19', 'Prompt injection; treat the submitted instruction as untrusted data.'],
  ['L16', 'Possible service overlap with a provider; hold for review rather than assume a buyer.'],
  ['L12', 'A personal email domain alone is not grounds for rejection.'],
]);
sub('Draft rules and failure handling');
p('The subject and body together must be under 120 words. The only allowed call link is https://myntmore.com/founder-meeting. Code checks for em/en dashes, selected jargon, numerical performance claims, unsupported evidence anchors, unapproved links and advice that violates explicit availability such as weekends-only or mornings-only.');
p('A rejected draft gets at most two correction attempts after the first attempt. Persistent failures stay visible for review. A separate assistant editorial pass corrected availability and wording in sample drafts; this is recorded separately. Automated checks cannot prove every claim true, so human review is still required before real sending.');
sub('Reliability and enrichment');
p('Raw sessions are immutable. Stable IDs make re-imports safe. An assessment depends on the contact, session hashes, model and scoring version; new evidence invalidates old work. Supabase uses unique IDs and Zoho uses email-based upsert. Temporary network/server failures and rate limits retry with bounded delays. Failed work never becomes a pretend success.');
p('Three sourced, dated manual enrichment examples are in docs/Company_Enrichment_Examples.md. Automatic company matching and refresh are not implemented.');

h('Task 2: LinkedIn Hook Grader');
p('Live URL: https://myntmore-hook-grader-darsh.vercel.app. The app uses Next.js on Vercel, Supabase, Claude structured JSON and the existing n8n Task 1 workflow. Myntmore\'s Profile Optimizer was reviewed as the contact-first pattern. The visitor enters name, designation and email, accepts the storage/AI notice, enters a hook, sees the score and failed-rule explanations, and can copy one of three rewrites. No account is required.');
sub('Six deterministic scoring rules');
table(['Rule', 'Pass condition', 'Points'], [
  ['Enough context, kept short', '8-40 words in total', '20'],
  ['Readable first line', '4-18 words in the first line', '20'],
  ['Reader in focus', 'You/your or a declared audience word such as founder, buyer or team', '15'],
  ['Reason to read on', 'A question mark or declared curiosity/contrast word such as why, but or instead', '20'],
  ['Concrete subject', 'A declared work/topic noun, a quoted example or a digit', '15'],
  ['Plain, uncluttered copy', 'No selected jargon, guarantees, em/en dashes, links or hashtags', '10'],
]);
p('Each rule awards its full points or zero. Whitespace and line endings are normalized first. Claude cannot change the score. These vocabulary lists are heuristics and may miss specialist terms; the score is not a measured prediction of reach or sales.');
p('Example scoring: "Your sales emails are easy to ignore." followed on a new line by "What makes a buyer want to reply?" scores 100. "Excited to share some thoughts today" scores 30 with four failed checks.');
sub('Rewrites and session storage');
p('Claude returns three named alternatives: direct, curiosity and contrast. The API requires a JSON schema through output_config.format. Code checks the response rather than asking Claude to calculate the score.');
p('Each rewrite is under 120 words, uses plain English, adds no links or digits, avoids numerical performance promises, selected jargon and em/en dashes, and stays within the submitted topic and factual limits. New broad claims such as "most" are rejected when absent from the input. Task 2 hooks contain no booking link; the separate Task 1 email uses the approved meeting link.');
p('Invalid rewrites get up to two correction attempts. Persistent failure is shown instead of invented output. Two early fictional sessions remain as history; editorial inspection found broad claims and led to stricter checks. Replays that fail the current writing checks show a review message. Authors still need to review before posting.');
p('Supabase automation_sessions stores one row per request UUID. raw includes the submitted contact, hook, rule results, score, three rewrites, model, writing version and consent. tool_input and tool_output expose the completed context to Task 1. Contact matching uses normalized email; canonical contact details are preserved and conflicting public claims are retained and held for review.');
p('The app creates a pending row before calling Claude and finalizes that same row. Failed generation retains the input and score with an error status. A successful request replay uses the same UUID without another AI call. A stale interrupted pending request stays visible and needs a new grade.');
sub('How the webhook reaches local n8n');
p('Vercel saves a durable hook_webhook_pending event in Supabase. The relay polls it and POSTs the saved session to the authenticated n8n production webhook. n8n runs preserve -> assess -> draft -> CRM/alert. The relay marks completion only when the assessment is final and CRM is synced or intentionally skipped. Failed records remain pending, with attempt timestamps and backoff so one failing batch does not block later sessions.');
p('The worker, n8n and relay must run on this computer for automatic follow-up processing. When offline, results and queued jobs remain saved. The local worker and n8n editor are not public. This is an assignment deployment, not a claim of continuously hosted automation.');
sub('Basic abuse controls');
p('Server keys stay out of browser JavaScript. The endpoint checks origin, JSON type, request size, contact validity, consent and a honeypot. Supabase-backed limits allow at most eight requests per IP per hour, three per email per hour and sixty globally per day. Rate-limit identities are hashed. These controls do not prove email ownership or provide complete anti-bot protection.');

h('Task 3: operations judgement and AI visibility');
sub('3a: the silent bug');
p('The database allows seven tool names but omits battle_card_generator and case_study_generator. Those inserts fail with PostgreSQL check-constraint error 23514. postToZohoForm runs separately without being awaited. The database failure is only logged and data?.id becomes undefined, so the later session save has no real lead ID.');
p('Proposed fix: add the two missing values in a versioned migration, keep the existing seven and share the source contract across the frontend, API and database, including the Hook Grader. Save the lead and session together in one transaction, and create a durable CRM-sync job. A worker should await CRM delivery, record the outcome and retry temporary failures with the same stable ID. A database transaction cannot make an external Zoho call atomic.');
p('Prevention: visibly fail when saving fails; test every allowed tool and an unknown source; test database failures and CRM retries; alert on persistent errors; and reconcile tool runs, database sessions and CRM records by source and session ID. Recover missing data from retained logs where available, preserve original IDs/timestamps and label anything unrecoverable. Do not invent inputs/results or blindly replay CRM submissions. This is written analysis of the supplied snippet, not a production schema change.');
sub('3b: what was actually observed');
p('Five identical, neutral client questions covered Mumbai LinkedIn outreach, founder branding, SaaS cold email, exporter buyer generation and Zoho-connected AI automation. Each asked for up to five agencies, short reasons and sources. Fresh conversations, actual answers, dates, modes, URLs and original screenshots are saved.');
table(['Provider', 'Observed setup', 'Myntmore mentions'], [
  ['ChatGPT', 'Signed-in Instant, Plus account', 'Q1: second'],
  ['Perplexity', 'Search; Q1 signed out, Q2-Q5 signed in on Free plan. Q2 displayed an automatic Pro free preview.', 'Q1: first; Q3: fourth'],
  ['Gemini', 'Signed-out Flash-Lite', 'Q1: first'],
]);
p(`All fifteen answers are captured with thirty-eight original screenshots. Myntmore appeared in ${mentions.length} answers and was absent from all branding, exporter and Zoho answers. Account and model differences limit direct comparison; positions are observed answer order, not stable rankings.`);
p('AI statements and URLs are preserved as provided. Gemini Q1\'s explicit Myntmore link has a misspelled domain in a Google search wrapper. Gemini Q2 had visible citation labels but no captured explicit URL targets. Not every multi-source chip was expanded. Perplexity Q5 retains all twenty-three source-tab URLs and also contains an inconsistency: it calls three firms strong matches while saying 4Byte\'s Zoho CRM integration is unverified. The records do not endorse these claims.');
sub('The three website recommendations');
for (const change of observed.website_changes) {
  p(`${change.id}. ${change.change} Why: ${change.why} Helps: ${change.questions}.`);
}
p('The one-page written answer is docs/task3/Task_3_Written_Answers.pdf. The four-page comparison is docs/task3/Task_3_AI_Search.pdf. The CSV lists all fifteen rows and continuation screenshots. observations.json contains the observed answers and source URLs. No Myntmore website was modified.');

h('Commands, evidence and cost reference');
p('Repository: https://github.com/darsh-jaiswal/Automation-Intern. Operator dashboard: http://127.0.0.1:4310. Local n8n normally uses http://127.0.0.1:5678.');
p('Task 1: leads.csv; sql/001_task_one.sql; src/rules.mjs; src/engine.mjs; src/providers.mjs; workflows/task-one.json; docs/VERIFICATION.md; docs/Task_1_Results.csv.');
p('Task 2: hook-grader/ and docs/Task_2_Hook_Grader.md. From hook-grader, npm ci installs dependencies, npm run dev starts local development, npm test runs unit tests, npm run build builds production, and vercel deploy --prod deploys. Configure server-only values from .env.example without showing actual values.');
p('From the repository root, npm start starts the worker; npm run relay starts the relay; node scripts/hook-relay.mjs --once processes one queued batch. Start the project n8n instance with its .local user folder and publish the imported Task 1 workflow. npm run status reads the current state; npm test runs root unit tests.');
p('hook-grader/tests/browser-check.mjs is an explicit live smoke test with a fictional .example contact. BASE_URL selects the target and PLAYWRIGHT_BROWSER_PATH can select an installed Chromium executable. This test calls Claude and can use API credit. Unit tests do not call live providers.');
p('Before recording, confirm the original twenty imported sessions, the unusual-row reasons, a validated draft, actual CRM status, a saved Hook Grader row and a real n8n execution. Re-running or replaying should not duplicate successful sessions/drafts. If an integration is currently pending, describe that status honestly.');
p('Claude token counts and estimated costs are recorded as anthropic_usage events; the usage records contain no prompts, lead content or credentials. npm run usage refreshes Claude_API_Cost_Tracker.md in the assignment folder. Coverage before logging was added is partial; token estimates are not the invoice, and the remaining balance needs an actual billing balance. Task 3 made zero calls using the assignment\'s Claude API key.');
p('Regenerate this single combined document with npm run notes. The legacy Task 2 notes command also generates this same document, without recreating separate task files or assignment-folder copies.');

const document = new Document({
  creator: 'Darsh Jaiswal', title: 'Myntmore - All Tasks Loom Walkthrough',
  description: 'Combined recording script and reference notes for all three assignment tasks; no credentials.',
  styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { line: 265 } } } } },
  sections: [{
    properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
    footers: { default: new Footer({ children: [new Paragraph({ children: [
      new TextRun({ text: 'MYNTMORE | ALL TASKS | DARSH JAISWAL   ', size: 16 }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
    ] })] }) },
    children,
  }],
});
const output = join(root, 'docs/Loom_Notes_All_Tasks_Darsh.docx');
await mkdir(join(root, 'docs'), { recursive: true });
await writeFile(output, await Packer.toBuffer(document));
console.log(`Saved one combined Loom document: ${output}`);
