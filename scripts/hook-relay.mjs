import { config } from '../src/config.mjs';
import { SupabaseStore } from '../src/store.mjs';
import { liveEngine } from '../src/cli.mjs';
import { selectRelayBatch, relayComplete } from '../src/relay-rules.mjs';

const c=config(),store=new SupabaseStore(c),engine=liveEngine(c);
const webhook='http://127.0.0.1:5678/webhook/automation-intern-session';
async function relay(){
  const [pending,attempts]=await Promise.all([store.all('events',{stage:'hook_webhook_pending'}),store.all('events',{stage:'hook_webhook_attempt'})]);
  const events=selectRelayBatch(pending,attempts);
  let delivered=0,failed=0;
  for(const event of events){
    const id=event.id.replace(/^hook_dispatch_/,'');
    const attempt={id:`hook_attempt_${id}`,contact_id:event.contact_id,stage:'hook_webhook_attempt',level:'info',message:'Attempting saved hook delivery.',created_at:new Date().toISOString()};
    await store.put('events',attempt);
    try{
      const session=await store.get('sessions',id);
      if(!session||session.source_tool!=='linkedin_hook_grader'||session.raw.hook_result?.status==='pending')throw new Error('Saved hook result is not ready.');
      const response=await fetch(webhook,{method:'POST',signal:AbortSignal.timeout(300000),headers:{Authorization:`Bearer ${c.workerToken}`,'Content-Type':'application/json'},body:JSON.stringify(session.raw)});
      if(!response.ok)throw new Error(`Task 1 webhook returned HTTP ${response.status}.`);
      await response.arrayBuffer();
      const work=await engine.work(session.contact_id),assessment=await store.get('assessments',work.id);
      if(!relayComplete(assessment,id))throw new Error('Task 1 processing has not reached a final saved outcome.');
      await store.put('events',{...event,stage:'hook_webhook_delivered',level:'info'});
      delivered++;
    }catch(error){
      failed++;
      await store.put('events',{...attempt,level:'error',message:'Delivery failed; retained for retry.'});
      // Fixed message: never log submitted content, authorization headers or provider bodies.
      console.error('A queued session remains pending. Check the local worker, published n8n webhook and Task 1 dashboard.');
    }
  }
  if(events.length)console.log(JSON.stringify({queued:events.length,delivered,still_pending:failed}));
  return failed;
}
if(process.argv.includes('--once')){if(await relay())process.exitCode=1;}
else{
  console.log('Hook relay running. Pending Supabase sessions are delivered to the local n8n webhook. No messages are sent.');
  let stopped=false;process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
  while(!stopped){try{await relay();}catch{console.error('Queue read failed; the relay will retry.');}if(!stopped)await new Promise(resolve=>setTimeout(resolve,10000));}
}
