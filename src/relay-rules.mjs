export function selectRelayBatch(events,attempts,{time=Date.now(),size=10}={}){
  const byId=new Map(attempts.map(event=>[event.id.replace(/^hook_attempt_/,''),event]));
  return events.map(event=>({event,attempt:byId.get(event.id.replace(/^hook_dispatch_/,''))})).filter(({attempt})=>!attempt||time-Date.parse(attempt.created_at)>=30000).sort((a,b)=>Date.parse(a.attempt?.created_at||a.event.created_at)-Date.parse(b.attempt?.created_at||b.event.created_at)).slice(0,size).map(item=>item.event);
}
export function relayComplete(assessment,sessionId){return Boolean(assessment&&assessment.session_ids.includes(sessionId)&&['complete','needs_review'].includes(assessment.status)&&['synced','skipped'].includes(assessment.crm_status));}
