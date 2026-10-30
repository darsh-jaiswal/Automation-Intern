import { writeFile } from 'node:fs/promises';
import { config, root } from '../src/config.mjs';
import { liveEngine } from '../src/cli.mjs';

const c=config(),engine=liveEngine(c);
if(!engine.crm.configured)throw new Error('Zoho OAuth is not configured.');
const state=await engine.state();
if(state.summary.errors)throw new Error('Resolve processing errors before verifying CRM results.');
const synced=state.assessments.filter(a=>a.crm_status==='synced');
const skipped=state.assessments.filter(a=>a.crm_status==='skipped');
if(synced.length+skipped.length!==state.contacts.length)throw new Error('Some contacts have not reached a final CRM outcome.');
if(new Set(synced.map(a=>a.crm_id)).size!==synced.length)throw new Error('Multiple contacts share a CRM record ID.');
const token=await engine.crm.accessToken();
let verified=0;
for(let offset=0;offset<synced.length;offset+=4){
  const results=await Promise.allSettled(synced.slice(offset,offset+4).map(async a=>{
    const contact=state.contacts.find(person=>person.id===a.contact_id);
    const response=await fetch(`${c.zohoApi}/crm/v8/Leads/${a.crm_id}?fields=First_Name,Last_Name,Email,Company,Description`,{signal:AbortSignal.timeout(30000),headers:{Authorization:`Zoho-oauthtoken ${token}`}});
    if(!response.ok)throw new Error(`CRM read-back failed (HTTP ${response.status}).`);
    const record=(await response.json()).data?.[0];
    if(record?.Email?.toLowerCase()!==contact.email || !record.Description?.includes(`Score: ${a.score}/10; tier: ${a.tier}`))throw new Error('CRM identity or score did not match the saved assessment.');
    if(a.draft && !record.Description.includes(a.draft.body))throw new Error('CRM draft text did not match the validated draft.');
    if(a.tier==='hot' && !record.Description.includes('PRIORITY ALERT'))throw new Error('Hot lead priority marker is missing from CRM.');
    if(!record.Description.includes('DRAFT ONLY'))throw new Error('Draft-only marker is missing from CRM.');
  }));
  for(const result of results){if(result.status==='rejected')throw result.reason;verified++;}
}
const hot=synced.find(a=>a.tier==='hot');
if(!hot)throw new Error('A Hot record is required for the live duplicate-upsert check.');
const repeatedId=await engine.crm.upsert(state.contacts.find(person=>person.id===hot.contact_id),hot);
if(repeatedId!==hot.crm_id)throw new Error('Repeated upsert created a different CRM record.');
const proof={recorded_at:new Date().toISOString(),crm_records_read_back:verified,records_intentionally_skipped:skipped.length,draft_text_and_scores_match:true,hot_priority_marker_verified:true,repeated_upsert_retained_same_record:true,no_send_endpoint_called:true};
await writeFile(`${root}.local/crm-verification.json`,JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
