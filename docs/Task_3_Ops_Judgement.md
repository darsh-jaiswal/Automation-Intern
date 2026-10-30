# Task 3: Ops Judgement

Darsh Jaiswal · Myntmore Systems & AI Automation Intern · Round 2

**Current status:** 3a is complete. 3b has six of fifteen real agency answers and is not complete. See [collection status and evidence](task3/README.md).

## 3a. A silent bug

The database's `leads_source_check` permits only seven tool names. It omits `battle_card_generator` and `case_study_generator`, so these inserts fail with PostgreSQL check-constraint error `23514`. `postToZohoForm()` runs first without being awaited, independently of the database write. The Supabase failure is only logged; returning `data?.id` gives the caller `undefined`, so the later session save cannot link to a real lead while the interface may still show success.

I would add the two missing source values in a versioned migration, keeping the existing seven. The frontend, API validation and database must share the same source contract, including `linkedin_hook_grader` when the tenth tool ships. I would validate input, save the lead and its tool session together in a database transaction, and fail visibly unless both commit. That transaction would also create a durable CRM-sync job. A worker would await the Zoho response, record its outcome and retry temporary failures with an idempotency key. A database transaction cannot make an external Zoho request atomic.

To prevent recurrence, I would test every allowed source, a rejected unknown source, database failures and CRM retries; alert on persistent insert/sync errors; and reconcile completed tool runs against Supabase sessions and CRM records by source and session ID. I would recover missing sessions from retained request/execution logs where available, preserving original IDs and timestamps, and label unrecoverable inputs/outputs instead of inventing them. I would not blindly replay CRM submissions and create duplicate contacts.

This is an analysis of the supplied example. No production database constraint was changed as part of this written answer.

## 3b. AI search: collection method

Five neutral, unbranded client questions will be submitted unchanged to ChatGPT, Perplexity and Gemini in fresh conversations. Each prompt requests up to five agencies, a short reason and sources. Results are recorded exactly as observed, with date, visible mode/model, response URL and screenshots. Mention position means order in the answer, not a stable search-engine ranking. An unavailable answer is recorded as unavailable, never replaced by an invented result or another provider's response.

### The five identical prompts

1. Which agencies in Mumbai help B2B founders get qualified sales meetings through LinkedIn outreach? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.
2. Which agencies can improve an Indian B2B founder's LinkedIn profile and personal brand to attract business enquiries? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.
3. Which agencies help Indian B2B SaaS companies set up cold email outreach, including deliverability and lead targeting? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.
4. Which agencies help Indian manufacturers and exporters find overseas B2B buyers using LinkedIn and email outreach? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.
5. Which agencies in Mumbai build AI-powered lead generation and follow-up automation connected to Zoho CRM? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.

Five Gemini answers and Perplexity Q1 have been captured. ChatGPT access and Perplexity Q2–Q5 require browser access/sign-in. [The draft comparison](task3/Task_3_AI_Search_DRAFT.pdf) marks missing answers as unavailable rather than a negative visibility result. Three provisional website changes, grounded in the six responses and current site checks, appear in [the one-page written draft](task3/Task_3_Written_Answers_DRAFT.pdf). They must be finalised after the remaining nine runs.

## Technical references for 3a

- PostgreSQL constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL `23514` / `check_violation`: https://www.postgresql.org/docs/current/errcodes-appendix.html
- Supabase insert and returned rows/errors: https://supabase.com/docs/reference/javascript/insert
