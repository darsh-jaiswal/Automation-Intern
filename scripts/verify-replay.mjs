import { readFile, writeFile } from 'node:fs/promises';
import { root } from '../src/config.mjs';
import { hash } from '../src/rules.mjs';

const bytes=await readFile(`${root}.local/n8n-idempotency.log`);
const text=bytes[0]===255&&bytes[1]===254?bytes.toString('utf16le'):bytes.toString('utf8');
const start=text.search(/\{\s*"/);
if(start<0)throw new Error('No execution JSON found in the local n8n log.');
let depth=0,inString=false,escaped=false,end=-1;
for(let i=start;i<text.length;i++){
  const c=text[i];
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;}
  else if(c==='"')inString=true;
  else if(c==='{')depth++;
  else if(c==='}'&&--depth===0){end=i+1;break;}
}
const execution=JSON.parse(text.slice(start,end));
const runs=execution.data?.resultData?.runData||execution.resultData?.runData||execution.runData;
if(!runs)throw new Error(`Unknown execution shape: ${Object.keys(execution).join(', ')}`);
const after=runs['Review final results']?.at(-1)?.data?.main?.[0]?.[0]?.json;
if(!after?.assessments)throw new Error('The final results node did not return database state.');
const before=JSON.parse(await readFile(`${root}.local/latest-live-results.json`,'utf8'));
const signature=state=>hash({sessions:state.sessions.map(s=>[s.id,s.payload_hash]).sort(),contacts:state.contacts.map(c=>c.id).sort(),assessments:state.assessments.map(a=>[a.id,a.draft,a.created_at]).sort(),alerts:state.alerts.map(a=>a.id).sort()});
const result={recorded_at:new Date().toISOString(),same_sessions_contacts_drafts_and_alerts:signature(before)===signature(after),summary:after.summary,workflow_nodes:Object.keys(runs)};
if(!result.same_sessions_contacts_drafts_and_alerts)throw new Error('Replay changed sessions, contacts, drafts or alerts. Inspect locally before claiming idempotency.');
await writeFile(`${root}.local/replay-verification.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({same_sessions_contacts_drafts_and_alerts:result.same_sessions_contacts_drafts_and_alerts,summary:result.summary},null,2));
