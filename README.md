# Automation Intern

Myntmore Round 2, Tasks 1 and 2 by Darsh Jaiswal: a draft-only follow-up engine and a deployed LinkedIn Hook Grader.

## Task 2: live Hook Grader

**Open:** https://myntmore-hook-grader-darsh.vercel.app

Next.js/Vercel contact-first tool with six deterministic scoring rules out of 100, three Claude structured-JSON rewrites, one Supabase row per session, and durable delivery through the existing n8n Task 1 webhook. See [Task 2 notes and Loom script](docs/Task_2_Hook_Grader.md), [verification evidence](docs/Task_2_Verification.json), and [screenshots](docs/task2/).

From `hook-grader/`: `npm ci`, configure server-only `.env.local`, then `npm run dev`. Run `npm test` and `npm run build` there. Deploy from that directory using `vercel deploy --prod`. Start `npm run relay` from this repository root to deliver queued sessions to the local n8n webhook. **Worker, n8n and relay must stay running for follow-up processing; saved sessions wait while they are offline.**

Claude usage counts and estimated costs are logged without prompts or credentials. Root `npm run usage` refreshes the local cost tracker. Earlier usage coverage is partial and remaining account credit is unknown until a billing balance is supplied.

## Task 1: lead follow-up engine

Verified against live Supabase, Anthropic and Zoho through the local n8n workflow: 20 sessions, 19 contacts, 12 validated drafts, 17 contacts synced to Zoho, zero processing errors, and a successful replay with no duplicate records/drafts/alerts. All 17 CRM records were read back and checked. The test entry and contact without email remain preserved in Supabase and intentionally skipped in CRM. See `docs/VERIFICATION.md`.

The sample contains 20 fictional tool sessions and 19 people. Original sessions are retained. Repeat visitors are grouped by normalised email (or LinkedIn URL if email is missing). Different people at one company remain separate.

## Run locally

Requires Node.js 24 or later, a Supabase project, an AI API key, and Zoho CRM OAuth credentials for CRM sync.

1. `npm ci`
2. Copy `.env.example` to `.env` and enter credentials. The local `.env` is gitignored. Set WORKER_TOKEN to a random value of at least 24 characters.
3. Run `sql/001_task_one.sql` in the project's Supabase SQL Editor. It creates only `automation_*` tables, enables RLS and grants access only to the server service role.
4. `npm test`
5. `npm run import`
6. `npm start`, then open `http://127.0.0.1:4310` and enter WORKER_TOKEN.
7. Execute the n8n workflow below, or run `npm run run` for the same engine from the CLI.
8. `npm run notes` regenerates the editable Loom notes with current database status.

No offline simulation is presented as a live run. The live CLI always requires Supabase. Tests explicitly use in-memory storage and AI/CRM doubles.

## n8n automation

Generate/import `workflows/task-one.json` into n8n (tested target: n8n 2.45.7). Use an HTTP Header Auth credential named `Automation Worker` with header `Authorization` and value `Bearer <WORKER_TOKEN>`. Assign it to all HTTP nodes and the webhook.

The manual flow imports the CSV, lists contacts, loops through people, assesses fit, drafts/validates, saves CRM text and creates Hot alerts. The authenticated webhook accepts new tool sessions, ready for Task 2. The worker and n8n run on the same computer; cloud n8n needs a separately deployed HTTPS worker, not this loopback URL.

The exported template is inactive. Publish it in n8n before expecting its production webhook to listen. The project-local instance was published and verified for Task 2. The webhook now responds after the last node, so the relay can verify downstream completion. Manual/CLI sample execution does not require publication.

`node scripts/workflow.mjs --local-credential` generates a gitignored `.local/n8n-credential.json` for CLI import. Do not commit or show that file in the Loom.

For a project-isolated local n8n install in PowerShell:

```powershell
$env:N8N_USER_FOLDER = "$PWD\.local"
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_TEMPLATES_ENABLED = 'false'
npm exec --yes --package=n8n@2.45.7 -- n8n import:credentials --input=.local/n8n-credential.json
npm exec --yes --package=n8n@2.45.7 -- n8n import:workflow --input=workflows/task-one.json
npm exec --yes --package=n8n@2.45.7 -- n8n start
```

Complete n8n's local owner setup yourself when prompted. It stores a credential, so keep the password private. Local workflow imports do not publish it or send any messages.

## Rules versus AI

Code handles normalisation, grouping, test/job-seeker exclusions, suspicious input, missing fields, final scoring, routing, validation, deduplication, retries and persistence. AI interprets the business need, selects one of four services, cites exact input/output evidence, and writes the email subject, tailored advice and invitation. Code adds verified source excerpts, greeting, approved call link and signature, then validates the assembled draft.

Scoring: base 1 + role (0–3) + business fit (0–3) + stated need (0–2) + completed tool activity (0–1). Hot: 8–10; Warm: 5–7; Not a fit: 1–4. A possible/adjacent need and a consumer-facing context are capped at 7; no evidenced relevant need is capped at 4. This prevents a senior job title alone from making a weak-fit visitor Hot. Raw points and any cap are visible. These are transparent design choices, not a measured sales-conversion model. Missing context or failed AI analysis produces a provisional score and visible review/error status, not a fabricated AI result.

Explicit test and job-seeking records receive score 1 and no draft. Suspicious prompt instructions receive a conservative score 1 and human-review status. Missing email does not reduce business fit but prevents drafting/sync. Potential service overlap is reviewed. A personal email domain is not an exclusion.

Each draft must be under 120 words including subject, contain the approved call URL exactly once, avoid dashes/jargon/unsupported numerical claims, and use verifiable source phrases from both input and output. The model gets up to three attempts. These checks are safeguards, not proof that every semantic statement is correct; human review is still required.

## Safety and recovery

- No email-send, SMS-send or chat-send endpoint exists.
- Zoho receives draft text in its lead Description, with `trigger: []` and explicit Cadence suppression for insert/update. It is not a sent email or a native Zoho email draft.
- Hot alerts are database/dashboard records and a priority marker in Zoho, not external messages.
- Immutable raw sessions and content-derived assessment IDs prevent duplicate drafts on repeated runs. New evidence invalidates old assessment IDs.
- Rate limits and network/server failures use bounded retries. Errors and review holds are visible.
- Database tables have RLS enabled and no public policies. The worker binds only to loopback and requires a bearer token for data/processing routes.
- Credentials never enter exports, Git, the operator URL or the notes document.

## Status and scope

`npm run status` reports credential presence and, when connected, current database counts. Credential presence alone is not integration verification. The dashboard shows processing and CRM status separately.

Task 2 is in `hook-grader/`. [Task 3 is complete](docs/task3/README.md): a one-page written answer, all **15 real AI answers**, original screenshots, and three website recommendations. The user's camera-on Loom recording and final submission remain. Three sourced manual company-enrichment examples are included in `docs/Company_Enrichment_Examples.md`; automatic matching/refresh is not implemented. The notes include limitations. Task 1's original verification is in `docs/VERIFICATION.md`; Task 2's live evidence is recorded separately.

## References

- [Assignment](https://docs.google.com/document/d/1bc1tH0Zq22cRrTmZvg11ozHEiyM416DlqbDCgQPxlD4/edit)
- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Supabase upserts](https://supabase.com/docs/reference/javascript/upsert)
- [n8n webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Zoho v8 upsert and Cadence suppression](https://www.zoho.com/crm/developer/docs/api/v8/upsert-records.html)
