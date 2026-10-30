import test from 'node:test';
import assert from 'node:assert/strict';
import { processSubmission, generateRewrites, SessionStore } from '../lib/server.mjs';
const input={name:'Example Founder',designation:'Founder',email:'example@example.com',hook:'Your sales emails are easy to ignore.\nWhat makes a buyer want to reply?',consent:true,requestId:'9b11d36a-35f9-4f80-9adb-67b01b088cef'};
const rewrites=[{style:'direct',text:'Your sales emails need a reason to reply.'},{style:'curiosity',text:'What makes your sales emails worth answering?'},{style:'contrast',text:'More sales emails can wait. Give your buyer a reason to reply.'}];
class FakeStore{
  constructor(){this.rows=new Map();this.queueIds=new Set();this.limits=0;}
  async get(id){return structuredClone(this.rows.get(id)||null);}
  async limit(){this.limits++;}
  async contact(){return {id:'c_example',conflict:false};}
  async save(raw,contactId,importedAt,{ignore=false}={}){if(ignore&&this.rows.has(raw.lead_id))return [];const row={id:raw.lead_id,contact_id:contactId,imported_at:importedAt,raw:structuredClone(raw)};this.rows.set(row.id,row);return [row];}
  async queue(id){this.queueIds.add(id);}
}
test('one successful session stores contact, hook, score and three rewrites; replay calls AI once',async()=>{
  const store=new FakeStore();let calls=0;const generate=async()=>{calls++;return rewrites;};
  const first=await processSubmission(input,{store,generate});
  const repeated=await processSubmission(input,{store,generate});
  assert.equal(first.grade.score,100);assert.equal(first.rewrites.length,3);assert.deepEqual(first,repeated);
  assert.equal(calls,1);assert.equal(store.rows.size,1);assert.equal(store.queueIds.size,1);assert.equal(store.limits,1);
  assert.equal((await store.get(first.sessionId)).raw.tool_input,input.hook);
});
test('AI failure retains the deterministic score and session, and queues an incomplete result for review',async()=>{
  const store=new FakeStore(),result=await processSubmission(input,{store,generate:async()=>{throw Error('private provider response');}});
  assert.equal(result.status,'rewrite_error');assert.equal(result.grade.score,100);assert.equal(result.rewrites.length,0);
  assert.ok(!JSON.stringify(result).includes('private provider response'));
  assert.equal(store.queueIds.size,1);assert.equal((await store.get(result.sessionId)).raw.tool_output,'');
});
test('cached older rewrites that fail current writing rules are withheld for review',async()=>{
  const store=new FakeStore();await processSubmission(input,{store,generate:async()=>rewrites});
  store.rows.get(`hook_${input.requestId}`).raw.hook_result.rewrites[0].text='Most LinkedIn posts say nothing.';
  const result=await processSubmission(input,{store,generate:async()=>{throw Error('Replay must not call AI.');}});
  assert.equal(result.status,'rewrite_error');assert.equal(result.rewrites.length,0);assert.match(result.message,/editorial review/);
});
test('reusing a request ID for different input is rejected and cannot replace original evidence',async()=>{
  const store=new FakeStore();await processSubmission(input,{store,generate:async()=>rewrites});
  await assert.rejects(()=>processSubmission({...input,hook:'Something else entirely'},{store}),{status:409});
  assert.equal((await store.get(`hook_${input.requestId}`)).raw.tool_input,input.hook);
});
test('concurrent repeated submission waits rather than making a second AI call',async()=>{
  const store=new FakeStore();let unblock,called=0;
  const running=processSubmission(input,{store,generate:()=>{called++;return new Promise(resolve=>{unblock=resolve;});}});
  while(!unblock)await new Promise(resolve=>setImmediate(resolve));
  const waiting=await processSubmission(input,{store,generate:async()=>{called++;return rewrites;}});
  assert.equal(waiting.status,'pending');assert.equal(called,1);unblock(rewrites);await running;
});
test('public form does not overwrite existing canonical name or role',async()=>{
  const calls=[],env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-key',RATE_LIMIT_SECRET:'s'.repeat(32)};
  const store=new SessionStore(env,async(url,options)=>{calls.push({url,options});return Response.json(options.method==='GET'?[{id:'existing',first_name:'Real',last_name:'Person',designation:'Manager',email:input.email,company:'Original'}]:[{}]);});
  const contact=await store.contact(input);
  assert.equal(contact.conflict,true);assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');
});
test('Claude request uses structured JSON schema and validator correction without an AI score',async()=>{
  let calls=0;
  const actual=await generateRewrites(input.hook,{rules:[]},{env:{ANTHROPIC_API_KEY:'test-key'},fetcher:async(url,options)=>{
    const body=JSON.parse(options.body);assert.equal(body.output_config.format.type,'json_schema');assert.deepEqual(body.output_config.format.schema.required,['direct','curiosity','contrast']);
    calls++;return Response.json({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(calls===1?{direct:'Get fifty meetings every month.',curiosity:rewrites[1].text,contrast:rewrites[2].text}:Object.fromEntries(rewrites.map(x=>[x.style,x.text])))}]});
  }});
  assert.equal(calls,2);assert.deepEqual(actual,rewrites);
});
test('rate slots are claimed atomically and identifiers are hashed',async()=>{
  const seen=new Set(),env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-key',RATE_LIMIT_SECRET:'s'.repeat(32)};
  const store=new SessionStore(env,async(url,options)=>{const row=JSON.parse(options.body);assert.ok(!row.id.includes(input.email));const exists=seen.has(row.id);seen.add(row.id);return Response.json(exists?[]:[row]);});
  await store.claimLimit('email',input.email,2,'hour');await store.claimLimit('email',input.email,2,'hour');
  await assert.rejects(()=>store.claimLimit('email',input.email,2,'hour'),{status:429});assert.equal(seen.size,2);
});
