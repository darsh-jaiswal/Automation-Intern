# Task 3: completed results and evidence

**Complete: 15 of 15 real AI answers captured on 31 October 2026 IST.** All five questions were asked unchanged in fresh conversations on ChatGPT, Perplexity and Gemini. No AI answer or screenshot was fabricated.

| Provider | Answers captured | Myntmore mentions | Observed setup |
| --- | --- | --- | --- |
| ChatGPT | 5/5 | Q1, position 2 | Signed-in Instant, Plus account |
| Perplexity | 5/5 | Q1, position 1; Q3, position 4 | Search; Q1 signed out, Q2-Q5 signed in on Free plan. Q2 displayed an automatic Pro free preview. |
| Gemini | 5/5 | Q1, position 1 | Signed-out Flash-Lite |

Myntmore appeared in four of the fifteen answers. It was absent from every branding (Q2), exporter (Q4) and Zoho automation (Q5) answer. This is a dated observation, not a stable rank or a controlled comparison of models; account state, mode and personalisation can affect answers.

## Submission files

- [One-page written answer: PDF](Task_3_Written_Answers.pdf) and [editable Word](Task_3_Written_Answers.docx). Covers the silent bug and three website changes.
- [15-row comparison table](Task_3_AI_Search.pdf) and [editable detailed evidence](Task_3_AI_Search.docx).
- [CSV](AI_Search_Collection_Status.csv): all fifteen results, dates, modes, response URLs and every screenshot filename.
- [Original screenshots](screenshots/). Continuation screenshots preserve longer answers. The CSV and detailed Word file list all continuations.
- [Observed answers and source URLs](observations.json), [capture status](access_status.json), and [Loom talking notes](Task_3_Loom_Notes.md).

The written answer fits one A4 page. The comparison table and screenshots are a separate evidence appendix. The supplied database bug was analysed; no production schema or Myntmore website was changed.

## Evidence limits

URLs and AI statements are recorded as provided. Gemini Q1's explicit Myntmore hyperlink contains a misspelled domain inside a Google search wrapper; it was not silently repaired. Gemini Q2 exposed citation labels but no explicit URL targets were captured. Other inline URLs and visible citation labels are recorded, although not every multi-source chip was expanded. Perplexity Q5 additionally includes all 23 source-tab URLs in the detailed Word file and observations JSON; the table records the first ten relevant source-tab entries. Retrieved source-list entries are distinguished from inline citations.

Several answers qualify agency claims as unverified. Perplexity Q5 calls three firms strong matches but also says 4Byte's Zoho CRM integration is unverified. These inconsistencies are preserved, not endorsed. The three website recommendations are grounded in the observed answers and the seven Myntmore pages recorded in observations.json; improved AI visibility is not guaranteed.

Task 3 itself made no calls using the assignment's Anthropic API key. The separate Claude cost tracker reports only recorded calls; earlier unmetered usage and remaining billing credits are unknown. Regenerate it with root `npm run usage`.
