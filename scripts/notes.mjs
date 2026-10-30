import { Document, Packer, Paragraph, TextRun, HeadingLevel, Footer, PageNumber } from 'docx';
import { writeFile, copyFile } from 'node:fs/promises';
import { config, root, readiness } from '../src/config.mjs';
import { liveEngine } from '../src/cli.mjs';
const c=config(); const ready=readiness(c); let summary=null;
if(ready.supabase){ try {summary=(await liveEngine(c).state()).summary;}catch{ /* The document explicitly records that live verification is pending below. */ } }
const status=summary?JSON.stringify(summary):'Supabase live run has not been verified yet. Do not describe the cloud workflow as complete until verified.';
const sections=[
['TITLE','Task 1 / Loom walkthrough notes'],
['SUBTITLE','Darsh Jaiswal · Myntmore Systems & AI Automation Intern · Round 2'],
['H','What is built'],
['P','A draft-only lead follow-up engine: original CSV sessions go into Supabase, repeat visits are grouped by person, code and AI assess fit, validated email drafts are saved, and Hot leads get a visible alert. An n8n workflow coordinates each processing stage. Zoho stores the draft text inside the lead Description; it does not send an email.'],
['H','Current verification status'],
['P',`Generated: ${new Date().toISOString()}. AI provider: ${c.provider}. Model: ${c.model}. Supabase configured: ${ready.supabase}; AI configured: ${ready.ai}; Zoho configured: ${ready.zoho}. A configured credential is not proof that the integration works.`],
['P',`Latest database summary: ${status}`],
['P','Automated tests use test doubles, not real AI responses. A live Anthropic structured-JSON smoke test has passed. Confirm the current Supabase and Zoho results on screen before recording.'],
['H','Task 1 segment / about two and a half minutes'],
['P','00:00–00:20 | Open the operator dashboard and Supabase session table. Say: “I started by reading every sample row. I keep the original twenty sessions so there is a clear record of every decision.”'],
['P','00:20–00:45 | Show Karan’s two sessions, L03 and L11. Say: “These are repeat visits by the same person, not two separate people. I preserve both tool sessions and use their combined context for one follow-up. Two people at the same company remain separate contacts.”'],
['P','00:45–01:10 | Show test, job seeker, missing information and injection examples. Say: “I mark test and job-seeking entries with a reason. Missing contact details and incomplete tool results are held for review. The malicious input asking for a perfect score is treated as untrusted data.”'],
['P','01:10–01:40 | Open a completed Hot or Warm contact. Show its score breakdown, original input/output and email draft. Say: “AI interprets the business need and writes a relevant draft. Code calculates the score and checks the writing rules. The draft uses evidence from both what the visitor typed and what the tool returned.”'],
['P','01:40–02:00 | Open the matching Zoho lead if sync is verified. Show the draft in Description and the priority marker. Say: “The CRM holds the draft and its context. No message is sent. Workflow triggers and Cadences are suppressed on the API write.” If Zoho is not verified, state that honestly and show the pending status instead.'],
['P','02:00–02:30 | Show the n8n canvas and execution. Say: “The visible stages import, assess, draft and save. Re-running does not duplicate the original sessions or validated drafts. Failed API calls have a visible status and can be retried.”'],
['H','Scoring rules / explain these simply'],
['P','Every record starts at one point. Decision-making role adds up to three. Business fit adds up to three: B2B three, consumer-facing one, unclear zero. A clear relevant need adds two; a possible need one. A completed tool session adds one. Total: one to ten. Hot is eight to ten; Warm is five to seven; Not a fit is one to four. These are declared assignment rules, not a proven prediction of sales conversion.'],
['P','AI supplies business type, need, service choice and a short reason backed by exact source quotes. Code supplies the points, thresholds, exclusions and review holds. Unknown or failed AI analysis is shown as provisional and does not produce an accepted draft.'],
['H','Messy-data examples to remember'],
['P','L03 + L11: one contact, two sessions. L02 + L15: separate contacts at one company. L07: test. L09: student. L14: looking for work. L05: missing tool context. L18: missing email. L19: prompt injection. L16: possible service overlap with a ghostwriting provider, held for review rather than assumed to be a buyer. L12: a personal email domain is not a reason for rejection.'],
['H','Draft checks and their limits'],
['P','The subject and body together must contain fewer than one hundred and twenty words. Code rejects numerical performance claims, em/en dashes, selected jargon, unapproved links and unsupported evidence anchors. A rejected draft is corrected at most twice after the first attempt. Persistent failures are visible. These checks do not prove every semantic claim is true; the draft stays subject to human review.'],
['H','Reliability choices'],
['P','Raw sessions are immutable. Stable IDs make re-imports safe. Assessment IDs depend on the contact, all session hashes, model and scoring version. New evidence invalidates old work. Supabase writes use unique IDs; Zoho uses email-based upsert. HTTP rate limits and temporary server/network failures retry with bounded delays. Errors never become pretend successful results.'],
['H','Where the work lives'],
['P','Private repository: https://github.com/darsh-jaiswal/Automation-Intern'],
['P','Dashboard: http://127.0.0.1:4310. Source data: leads.csv. Database migration: sql/001_task_one.sql. Business logic: src/rules.mjs and src/engine.mjs. AI and CRM adapters: src/providers.mjs. n8n export: workflows/task-one.json. Tests: tests/*.test.mjs.'],
['H','Before pressing Record'],
['P','Run npm test. Check npm run status. Start the worker with npm start. Start n8n and execute the sample workflow. Verify twenty preserved sessions, nineteen contacts, every unusual row explained, draft validation results, and the actual Zoho sync status. Re-run once to demonstrate deduplication. Keep .env, API-key pages and credential screens out of the recording.'],
['H','What to say about the AI change'],
['P','“Janvi allowed tools of my choice. I used Anthropic for this implementation because I had a working testing key. The provider is isolated behind an adapter, so the same workflow can use Gemini without rewriting the business rules.” Never describe Anthropic output as Gemini output.'],
['H','Honest limitations / finish with these'],
['P','The worker runs locally and n8n must be on the same computer. The bonus enrichment on three real companies is not implemented. AI scores reflect a stated rubric rather than a measured conversion model. Human review is still necessary before sending any draft. If Supabase, n8n or Zoho has not been verified live, explicitly identify that integration as pending.'],
];
const children=sections.map(([kind,text])=>new Paragraph({...(kind==='TITLE'?{heading:HeadingLevel.TITLE}:kind==='H'?{heading:HeadingLevel.HEADING_1}:{}),spacing:{after:kind==='H'?120:180},children:[new TextRun({text,...(kind==='SUBTITLE'?{color:'68796D',size:22}:{} )})]}));
const doc=new Document({creator:'Darsh Jaiswal',title:'Myntmore Task 1 - Loom Walkthrough Notes',description:'Implementation and live-verification notes, no credentials',styles:{default:{document:{run:{font:'Aptos',size:22,color:'193D32'},paragraph:{spacing:{line:280}}}},paragraphStyles:[{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Aptos Display',size:28,bold:true,color:'245B47'},paragraph:{spacing:{before:240,after:120}}}]},sections:[{properties:{page:{margin:{top:1000,bottom:1000,left:1100,right:1100}}},footers:{default:new Footer({children:[new Paragraph({children:[new TextRun({text:'MYNTMORE / TASK 1 · DARSH JAISWAL    ',size:16,color:'68796D'}),new TextRun({children:[PageNumber.CURRENT],size:16})]})]})},children}]});
const output=`${root}docs/Task_1_Loom_Notes_Darsh.docx`;await writeFile(output,await Packer.toBuffer(doc));
await writeFile(`${root}docs/Task_1_Loom_Notes_Darsh.md`,sections.map(([kind,text])=>`${kind==='TITLE'?'# ':kind==='H'?'## ':''}${text}`).join('\n\n'));
await copyFile(output,`${root}../Task_1_Loom_Notes_Darsh.docx`);
console.log('Editable Loom notes saved in docs/ and the assignment folder.');
