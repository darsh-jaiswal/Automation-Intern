# Task 3 - Loom talking notes

## What I did

- I first read the bug example. Zoho receives the lead independently, but Supabase rejects two tool names missing from its allowed-source list. The code logs the error and returns no lead ID, so the session can disappear while the user sees success.
- My written fix is to update the source contract, save the lead and session together, create a durable CRM-sync job, retry with the same ID, alert on failures and reconcile counts. This is analysis of their snippet; I did not modify their production database.
- For AI visibility, I wrote five realistic client questions: LinkedIn outreach, founder branding, SaaS cold email, exporter buyer generation and Zoho-connected AI automation.
- I asked exactly the same questions in fresh chats on ChatGPT, Perplexity and Gemini. I saved the actual answers, dates, modes, source links and original screenshots. The remaining nine answers were collected through native Chrome Computer Use after the connection recovered; I handled sign-in manually.

## What I found

- Myntmore appeared in four of fifteen answers: all three LinkedIn outreach answers, plus Perplexity's SaaS cold-email answer.
- It was absent from all founder-branding, exporter and Zoho automation answers.
- These are observations from this run. Different accounts and modes can produce different results, so I do not claim permanent rankings.
- Some AI citations or claims were inaccurate or weak. For example, Gemini's Myntmore hyperlink had a typo, and several answers warned that agency results were self-reported. I kept that evidence visible.

## My first three website changes

1. Improve the existing service and audience pages with direct buyer-question answers, clear deliverables and relevant proof.
2. If Zoho automation is a real client offering, publish a specific implementation walkthrough showing the lead-to-CRM flow, failure handling and ownership.
3. Strengthen case studies with dates, baselines and approved attribution or independent references.

## What to show on screen

1. Open Task_3_Written_Answers.pdf: confirm the main answer is one page.
2. Open Task_3_AI_Search.pdf: point to the Yes/No and position columns.
3. Open perplexity-q3-2.png: show Myntmore's fourth-place mention.
4. Open the CSV or detailed Word file: show the response URL, mode and continuation screenshots.
5. Explain that no emails were sent and Task 3 made zero Claude API calls. The cost tracker is partial and the remaining Anthropic balance is unknown.
