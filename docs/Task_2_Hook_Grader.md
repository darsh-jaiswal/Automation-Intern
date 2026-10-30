# Task 2: LinkedIn Hook Grader

Live tool: https://myntmore-hook-grader-darsh.vercel.app

Built by Darsh Jaiswal. Next.js on Vercel, Supabase persistence, Claude structured JSON and the existing n8n Task 1 workflow. Janvi allowed a different AI provider; this implementation uses Claude rather than claiming to use Gemini.

## What the visitor does

1. Sees the landing page and enters name, designation and email.
2. Agrees to the storage/AI notice, then pastes one or two opening lines.
3. Gets a score out of 100, one useful sentence for every failed rule, and three rewrite options.
4. Copies a rewrite or edits the hook. No account or email sending is required.

The current Myntmore Profile Optimizer's landing page, interactive scoring preview and contact gate were reviewed as the reference pattern. This assignment uses the three required contact fields and an explicit notice explaining session storage and Claude processing.

## The six scoring rules

| Rule | Pass condition | Points |
| --- | --- | --- |
| Enough context, kept short | Eight to forty words in total. | 20 |
| Readable first line | Four to eighteen words in the first line. | 20 |
| Reader in focus | Includes you/your or a declared audience word such as founder, buyer or team. | 15 |
| Reason to read on | A question mark or declared contrast/curiosity word such as but, why or instead. | 20 |
| Concrete subject | Names a declared work/topic noun, contains a quoted example or includes a digit. | 15 |
| Plain, uncluttered copy | No selected jargon, guarantees, em/en dashes, links or hashtags. | 10 |

Each check awards either its full points or zero. Code normalises whitespace and line endings before scoring. The score is deterministic: the same normalised hook gets the same score. This is a declared writing checklist, not a measured prediction of reach, quality or sales. The noun/audience lists are heuristics and can miss specialist vocabulary.

Examples: `Your sales emails are easy to ignore. / What makes a buyer want to reply?` receives 100. `Excited to share some thoughts today` receives 30, with four failed checks. The slash here represents a line break.

## Rules versus Claude

Rules calculate every point, validate the contact and input, apply request limits, check rewrite constraints, save sessions, deduplicate requests and deliver the webhook. Claude produces only three text alternatives in a required JSON object: `direct`, `curiosity`, `contrast`. The API uses Anthropic's `output_config.format` with a JSON schema. It does not ask Claude for a score.

Rewrites use plain English, stay under 120 words each, contain no digits, numerical performance promises, selected jargon or em/en dashes, and add no links. A LinkedIn hook is not a follow-up email, so the rewrite contains no booking link; Task 1's separate follow-up draft uses only the approved founder-meeting URL. The prompt preserves the submitted topic and factual limits. Code also rejects new broad generalisations such as “most” when absent from the original. Rejected output gets up to two correction attempts; persistent failure is shown instead of fake rewrites. Automated checks cannot prove complete semantic truth, so the UI asks the author to review before posting.

Two early fictional test sessions were kept as history. Editorial inspection found broad claims in their initial rewrites and prompted stricter writing checks. The final production demonstration and screenshots are taken after that change. Replaying an earlier result that fails the current checks returns a review message rather than those rewrites.

## Where the session is stored

Supabase `automation_sessions` stores one row per request ID. Its `raw` JSON contains the submitted contact, hook, rule results, score, three rewrites, model, writing version and consent. `tool_input` and `tool_output` also expose the completed tool context to Task 1. Contact records are linked by normalised email. Existing canonical names, roles and company information are preserved; conflicting public claims are retained as raw evidence and held for review.

The app saves an initial pending row before calling Claude, then finalises that same row. Failed AI generation retains the input and score with an explicit error status. Repeated requests use the same UUID, preventing duplicate successful sessions or another AI call. A stale interrupted pending request is visible and requires a new grade; it is not silently presented as successful.

## Connection to Task 1

Vercel saves a durable `hook_webhook_pending` event in Supabase. The project relay polls that queue and POSTs the saved session to the authenticated local n8n production webhook. n8n runs the existing preserve → assess → draft → CRM/alert flow. The relay only marks delivery complete when the current assessment is final and CRM is synced or intentionally skipped. Failed records remain pending; stored attempt timestamps and backoff prevent one failing batch from blocking later sessions.

The queue bridges the public Vercel app to n8n on this computer. **The worker, n8n and relay must be running for automatic follow-up processing.** While offline, the tool still saves results and the queue waits. The local worker and n8n editor are not exposed publicly. This is an assignment deployment, not a claim of continuously hosted automation.

## Run and verify

From `Automation-Intern/hook-grader`: `npm ci`, configure server-only `.env.local` from `.env.example`, then `npm run dev`. Tests: `npm test`. Production build: `npm run build`. Deploy from this directory with `vercel deploy --prod`.

From `Automation-Intern`: start the worker with `npm start`; start the local n8n instance with its project-specific `.local` user folder and publish the imported Task 1 workflow; start `npm run relay`. To process a batch once: `node scripts/hook-relay.mjs --once`.

The explicit browser smoke test is `hook-grader/tests/browser-check.mjs`. Set `BASE_URL` to the live tool and, if needed, `PLAYWRIGHT_BROWSER_PATH` to an installed Chromium executable. It calls Claude using a fictional `.example` contact and costs API credit. Unit tests do not make live calls.

Server keys stay out of browser JavaScript. The public endpoint checks origin, JSON type, request size, contact validity, consent and a honeypot. Supabase-backed limits admit at most eight requests per IP per hour, three per email per hour and sixty globally per day. Identities are hashed in rate-limit records. These are basic abuse controls, not email-ownership verification or a complete production anti-bot system.

## Short Loom script: about two minutes

**00:00–00:20:** Open the live URL. Show the landing page, contact form and notice. “I followed Myntmore's contact-first tool pattern. The visitor enters a name, role and email before using the grader.”

**00:20–00:45:** Paste an opening and show its score and failed rules. “All scoring is code. These six checks add up to one hundred. The same opening always receives the same score; Claude cannot change it.”

**00:45–01:05:** Show the three alternatives and copy one. “Claude returns a structured JSON object with three named alternatives. I validate the writing rules and hold failed responses rather than making up a result.”

**01:05–01:30:** Open the Supabase session row and expand `raw.hook_result`. “The contact, original hook, score, rule feedback and rewrites are stored together in one session row. Retrying a successful request does not call Claude again.”

**01:30–02:00:** Show the n8n webhook execution and matching Zoho lead Description. “A saved queue passes the session through the Task 1 webhook. The local relay must be running; offline sessions wait safely. Zoho holds a follow-up draft, and nothing is sent automatically.”

Keep `.env`, credential screens and provider billing details out of the recording. The final assignment's camera-on Loom and Task 3 remain separate work.

## API usage tracking

Claude response token counts and estimated USD costs are recorded as `anthropic_usage` events without prompts, lead content or credentials. Root `npm run usage` refreshes the private local report `Claude_API_Cost_Tracker.md` in the assignment folder. Coverage before logging was added is explicitly partial. Remaining credit is unknown until an actual billing balance is supplied; token estimates are not the account invoice.
