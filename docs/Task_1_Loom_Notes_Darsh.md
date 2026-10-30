# Task 1 / Loom walkthrough notes

Darsh Jaiswal · Myntmore Systems & AI Automation Intern · Round 2

## What is built

A draft-only lead follow-up engine: original CSV sessions go into Supabase, repeat visits are grouped by person, code and AI assess fit, validated email drafts are saved, and Hot leads get a visible alert. An n8n workflow coordinates each processing stage. Zoho stores the draft text inside the lead Description; it does not send an email.

## Current verification status

Generated: 2026-10-30T17:54:10.978Z. AI provider: anthropic. Model: claude-sonnet-4-6. Supabase configured: true; AI configured: true; Zoho configured: true. A configured credential is not proof that the integration works.

Latest database summary: {"contacts":19,"hot":1,"warm":13,"not_a_fit":5,"drafts":12,"review":4,"errors":0,"crm_synced":17}

Automated tests use test doubles, not real AI responses. A live Anthropic structured-JSON smoke test has passed. Confirm the current Supabase and Zoho results on screen before recording.

## Task 1 segment / about two and a half minutes

00:00–00:20 | Open the operator dashboard and Supabase session table. Say: “I started by reading every sample row. I keep the original twenty sessions so there is a clear record of every decision.”

00:20–00:45 | Show Karan’s two sessions, L03 and L11. Say: “These are repeat visits by the same person, not two separate people. I preserve both tool sessions and use their combined context for one follow-up. Two people at the same company remain separate contacts.”

00:45–01:10 | Show test, job seeker, missing information and injection examples. Say: “I mark test and job-seeking entries with a reason. Missing contact details and incomplete tool results are held for review. The malicious input asking for a perfect score is treated as untrusted data.”

01:10–01:40 | Open a completed Hot or Warm contact. Show its score breakdown, original input/output and email draft. Say: “AI interprets the business need and writes a relevant draft. Code calculates the score and checks the writing rules. The draft uses evidence from both what the visitor typed and what the tool returned.”

01:40–02:00 | Open the matching Zoho lead if sync is verified. Show the draft in Description and the priority marker. Say: “The CRM holds the draft and its context. No message is sent. Workflow triggers and Cadences are suppressed on the API write.” If Zoho is not verified, state that honestly and show the pending status instead.

02:00–02:30 | Show the n8n canvas and execution. Say: “The visible stages import, assess, draft and save. Re-running does not duplicate the original sessions or validated drafts. Failed API calls have a visible status and can be retried.”

## Scoring rules / explain these simply

Every record starts at one point. Decision-making role adds up to three. Business fit adds up to three: B2B three, consumer-facing one, unclear zero. A clear relevant need adds two; a possible need one. A completed tool session adds one. A possible/adjacent need or consumer-facing context is capped at seven; no relevant need is capped at four. This prevents a senior title alone from making a weak-fit visitor Hot. Raw points and caps are visible. Hot is eight to ten; Warm is five to seven; Not a fit is one to four. These are declared assignment rules, not a proven prediction of sales conversion.

AI supplies business type, need, service choice and a short reason backed by exact source quotes. It writes the email subject, tailored advice and invitation. Code frames the email with verified source excerpts, greeting, approved call link and signature, then validates the result. Code also supplies the points, thresholds, exclusions and review holds. Unknown or failed AI analysis is shown as provisional and does not produce an accepted draft.

## Messy-data examples to remember

L03 + L11: one contact, two sessions. L02 + L15: separate contacts at one company. L07: test. L09: student. L14: looking for work. L05: missing tool context. L18: missing email. L19: prompt injection. L16: possible service overlap with a ghostwriting provider, held for review rather than assumed to be a buyer. L12: a personal email domain is not a reason for rejection.

## Draft checks and their limits

The subject and body together must contain fewer than one hundred and twenty words. Code rejects numerical performance claims, em/en dashes, selected jargon, unapproved links, unsupported evidence anchors and suggestions outside explicit weekends-only or mornings-only availability. A rejected draft is corrected at most twice after the first attempt. Persistent failures are visible. An assistant editorial pass corrected availability and wording in the sample drafts and is recorded separately. These checks do not prove every semantic claim is true; the draft stays subject to human review before any real sending.

## Reliability choices

Raw sessions are immutable. Stable IDs make re-imports safe. Assessment IDs depend on the contact, all session hashes, model and scoring version. New evidence invalidates old work. Supabase writes use unique IDs; Zoho uses email-based upsert. HTTP rate limits and temporary server/network failures retry with bounded delays. Errors never become pretend successful results.

## Where the work lives

Private repository: https://github.com/darsh-jaiswal/Automation-Intern

Dashboard: http://127.0.0.1:4310. Source data: leads.csv. Database migration: sql/001_task_one.sql. Business logic: src/rules.mjs and src/engine.mjs. AI and CRM adapters: src/providers.mjs. n8n export: workflows/task-one.json. Tests: tests/*.test.mjs.

## Before pressing Record

Run npm test. Check npm run status. Start the worker with npm start. Start n8n and execute the sample workflow. Verify twenty preserved sessions, nineteen contacts, every unusual row explained, draft validation results, and the actual Zoho sync status. Re-run once to demonstrate deduplication. Keep .env, API-key pages and credential screens out of the recording.

## What to say about the AI change

“Janvi allowed tools of my choice. I used Anthropic for this implementation because I had a working testing key. The provider is isolated behind an adapter, so the same workflow can use Gemini without rewriting the business rules.” Never describe Anthropic output as Gemini output.

## Honest limitations / finish with these

The worker runs locally and n8n must be on the same computer. Three sourced manual company-enrichment examples are included in docs/Company_Enrichment_Examples.md; automatic company matching and enrichment refreshes are not implemented. Historical facts are explicitly dated. AI scores reflect a stated rubric rather than a measured conversion model. Human review is still necessary before sending any draft. If Supabase, n8n or Zoho has not been verified live, explicitly identify that integration as pending.