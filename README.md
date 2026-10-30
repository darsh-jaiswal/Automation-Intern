# Automation Intern

Myntmore Round 2, Task 1. Draft-only lead follow-up engine by Darsh Jaiswal.

Verified locally against live Supabase and Anthropic: 20 sessions, 19 contacts, 12 validated drafts, zero processing errors, and a successful n8n replay with no duplicate records/drafts/alerts. Zoho OAuth authorization and live CRM sync remain pending; see `docs/VERIFICATION.md`.

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

The exported workflow is inactive. Publish/activate it in n8n before expecting its production webhook to listen. Manual/CLI sample execution does not require activation.

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

Task 2, Task 3, public deployment and a recorded Loom are outside this Task 1 implementation. Three sourced manual company-enrichment examples are included in `docs/Company_Enrichment_Examples.md`; automatic matching/refresh is not implemented. The notes include an honest limitations section. See `docs/VERIFICATION.md` for the latest checks actually run.

## References

- [Assignment](https://docs.google.com/document/d/1bc1tH0Zq22cRrTmZvg11ozHEiyM416DlqbDCgQPxlD4/edit)
- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Supabase upserts](https://supabase.com/docs/reference/javascript/upsert)
- [n8n webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Zoho v8 upsert and Cadence suppression](https://www.zoho.com/crm/developer/docs/api/v8/upsert-records.html)
