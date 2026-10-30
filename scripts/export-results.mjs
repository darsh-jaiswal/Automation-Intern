import { writeFile, mkdir } from 'node:fs/promises';
import { root } from '../src/config.mjs';
import { liveEngine } from '../src/cli.mjs';

const state=await liveEngine().state();
const columns=['lead_id','source_tool','name','email','company','contact_id','related_sessions','score','tier','service','processing_status','review_flags','reason','draft_subject','draft_body','crm_status'];
const cell=value=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
const rows=state.sessions.sort((a,b)=>a.id.localeCompare(b.id)).map(session=>{
  const contact=state.contacts.find(c=>c.id===session.contact_id), a=state.assessments.find(a=>a.contact_id===session.contact_id);
  const related=state.sessions.filter(s=>s.contact_id===session.contact_id).map(s=>s.id).sort();
  return {lead_id:session.id,source_tool:session.source_tool,name:`${contact.first_name} ${contact.last_name}`,email:contact.email,company:contact.company,contact_id:contact.id,related_sessions:related.join(' + '),score:a?.score,tier:a?.tier,service:a?.service,processing_status:a?.status||'pending',review_flags:a?.flags.join(', '),reason:(a?.reason||'Awaiting assessment.')+(related.length>1?' Repeat visit retained and combined; one contact and one draft.':''),draft_subject:a?.draft?.subject||'',draft_body:a?.draft?.body||'',crm_status:a?.crm_status||'pending'};
});
await writeFile(`${root}docs/Task_1_Results.csv`,[columns.map(cell).join(','),...rows.map(row=>columns.map(column=>cell(row[column])).join(','))].join('\r\n')+'\r\n');
await mkdir(`${root}.local`,{recursive:true});
await writeFile(`${root}.local/latest-live-results.json`,JSON.stringify({recorded_at:new Date().toISOString(),...state},null,2));
console.log(JSON.stringify({exported_rows:rows.length,summary:state.summary},null,2));
