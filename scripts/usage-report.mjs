import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {config,root} from '../src/config.mjs';
import {SupabaseStore} from '../src/store.mjs';
const store=new SupabaseStore(config());
const records=new Map();
for(const event of await store.all('events',{stage:'anthropic_usage'})){const row=JSON.parse(event.message);records.set(row.response_id,row);}
try{for(const line of (await readFile(`${root}.local/anthropic-usage.jsonl`,'utf8')).trim().split('\n')){if(line){const row=JSON.parse(line);records.set(row.response_id,row);}}}catch(error){if(error.code!=='ENOENT')throw error;}
const all=[...records.values()],cost=all.reduce((sum,r)=>sum+(r.estimated_cost_usd??0),0),unpriced=all.filter(r=>r.estimated_cost_usd===null).length;
let baseline=null;try{baseline=JSON.parse(await readFile(`${root}.local/credits-baseline.json`,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const afterBaseline=baseline?all.filter(r=>r.recorded_at>=baseline.recorded_at):[],since=afterBaseline.reduce((sum,r)=>sum+(r.estimated_cost_usd??0),0);
const summary={as_of:new Date().toISOString(),coverage:'Partial: calls before usage logging was added were not recorded, except explicitly recovered responses.',logged_responses:all.length,input_tokens:all.reduce((s,r)=>s+r.input_tokens,0),output_tokens:all.reduce((s,r)=>s+r.output_tokens,0),estimated_logged_cost_usd:Number(cost.toFixed(6)),unpriced_responses:unpriced,baseline,estimated_remaining_usd:baseline?.currency==='USD'&&!afterBaseline.some(r=>r.estimated_cost_usd===null)?Number(Math.max(0,baseline.amount-since).toFixed(6)):null};
await mkdir(`${root}.local`,{recursive:true});
await writeFile(`${root}.local/usage-summary.json`,JSON.stringify(summary,null,2));
const report=`# Claude API usage tracker\n\nUpdated: ${summary.as_of}\n\n- Recorded responses: ${summary.logged_responses}\n- Input tokens: ${summary.input_tokens}\n- Output tokens: ${summary.output_tokens}\n- Estimated cost of recorded calls: USD ${cost.toFixed(6)}\n- Unpriced responses: ${unpriced}\n- Remaining balance: ${summary.estimated_remaining_usd===null?'Unknown; current Anthropic billing balance is needed.':`approximately USD ${summary.estimated_remaining_usd.toFixed(6)}, based on the balance supplied and subsequent project usage.`}\n\n${summary.coverage}\n\nThese are token-based estimates, not an invoice or an authoritative account balance. Other projects, credit expiry, taxes, discounts and account adjustments are not included. The log contains no API keys, prompts or lead content.\n\nPricing source: https://platform.claude.com/docs/en/about-claude/pricing\n\nRegenerate: from Automation-Intern, run node scripts/usage-report.mjs.\n`;
await writeFile(`${root}../Claude_API_Cost_Tracker.md`,report);
console.log(JSON.stringify(summary,null,2));
