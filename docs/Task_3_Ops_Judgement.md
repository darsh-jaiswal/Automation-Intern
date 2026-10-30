# Task 3: Ops Judgement

Darsh Jaiswal · Myntmore Systems & AI Automation Intern · Round 2

**Current status:** Task 3 is complete: the bug analysis, all fifteen real AI answers with screenshots, and three evidence-based website changes. See [results and evidence](task3/README.md).

## 3a. A silent bug

The database's `leads_source_check` permits only seven tool names. It omits `battle_card_generator` and `case_study_generator`, so these inserts fail with PostgreSQL check-constraint error `23514`. `postToZohoForm()` runs first without being awaited, independently of the database write. The Supabase failure is only logged; returning `data?.id` gives the caller `undefined`, so the later session save cannot link to a real lead while the interface may still show success.

I would add the two missing source values in a versioned migration, keeping the existing seven. The frontend, API validation and database must share the same source contract, including `linkedin_hook_grader` when the tenth tool ships. I would validate input, save the lead and its tool session together in a database transaction, and fail visibly unless both commit. That transaction would also create a durable CRM-sync job. A worker would await the Zoho response, record its outcome and retry temporary failures with an idempotency key. A database transaction cannot make an external Zoho request atomic.

To prevent recurrence, I would test every allowed source, a rejected unknown source, database failures and CRM retries; alert on persistent insert/sync errors; and reconcile completed tool runs against Supabase sessions and CRM records by source and session ID. I would recover missing sessions from retained request/execution logs where available, preserving original IDs and timestamps, and label unrecoverable inputs/outputs instead of inventing them. I would not blindly replay CRM submissions and create duplicate contacts.

This is an analysis of the supplied example. No production database constraint was changed as part of this written answer.

## 3b. AI search: collection method

Five neutral, unbranded client questions were submitted unchanged to ChatGPT, Perplexity and Gemini in fresh conversations on 31 October 2026 IST. Each prompt requests up to five agencies, a short reason and sources. Results include date, visible mode/model, response URL and screenshots. ChatGPT used signed-in Instant (Plus), Gemini used signed-out Flash-Lite, and Perplexity used signed-out Search for Q1 and signed-in Search for Q2-Q5; Q2 displayed an automatic Pro free preview. These account/model differences limit comparison. Mention position means order in the answer, not a stable search-engine ranking.

### The five identical prompts

1. Which agencies in Mumbai help B2B founders get qualified sales meetings through LinkedIn outreach? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.
2. Which agencies can improve an Indian B2B founder's LinkedIn profile and personal brand to attract business enquiries? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.
3. Which agencies help Indian B2B SaaS companies set up cold email outreach, including deliverability and lead targeting? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.
4. Which agencies help Indian manufacturers and exporters find overseas B2B buyers using LinkedIn and email outreach? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.
5. Which agencies in Mumbai build AI-powered lead generation and follow-up automation connected to Zoho CRM? Please name up to five suitable agencies, give a short reason for each, and cite the sources you used. If you cannot verify an agency, say so.

All fifteen answers have been captured. Myntmore appeared in four: all three Q1 answers and Perplexity Q3. It was absent from all Q2, Q4 and Q5 answers. The [comparison table](task3/Task_3_AI_Search.pdf) records each result and its screenshot. The [one-page written answer](task3/Task_3_Written_Answers.pdf) contains 3a and the three website changes; the results table and screenshots form a separate evidence appendix. AI statements and linked URLs are recorded as provided, including errors, and are not endorsements.

## Technical references for 3a

- PostgreSQL constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL `23514` / `check_violation`: https://www.postgresql.org/docs/current/errcodes-appendix.html
- Supabase insert and returned rows/errors: https://supabase.com/docs/reference/javascript/insert
