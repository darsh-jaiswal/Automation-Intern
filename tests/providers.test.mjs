import test from 'node:test';
import assert from 'node:assert/strict';
import { Anthropic, Zoho } from '../src/providers.mjs';
import { SupabaseStore } from '../src/store.mjs';
import { validateDraft, CALL_URL } from '../src/rules.mjs';

test('Anthropic sends structured schema and interprets the actual response', async t => {
  let captured;
  t.mock.method(globalThis,'fetch',async(url,options)=>{captured={url,options};return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:'{"ok":true}'}]}),{status:200});});
  const ai=new Anthropic({anthropicKey:'test-key',model:'test-model'});
  assert.deepEqual(await ai.generate('Check',{}, {type:'OBJECT',required:['ok'],properties:{ok:{type:'BOOLEAN'}}}),{ok:true});
  assert.equal(captured.url,'https://api.anthropic.com/v1/messages');
  const body=JSON.parse(captured.options.body);assert.equal(body.output_config.format.schema.type,'object');assert.equal(body.output_config.format.schema.additionalProperties,false);assert.equal(body.output_config.format.schema.properties.ok.type,'boolean');
});
test('Anthropic truncation/refusal is a failure, not an accepted draft', async t => {
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({stop_reason:'max_tokens',content:[{type:'text',text:'{}'}]}),{status:200}));
  await assert.rejects(new Anthropic({anthropicKey:'test-key',model:'test-model'}).generate('Check',{}, {type:'OBJECT',properties:{}}),/incomplete/);
});
test('assessment schema selects source IDs and code copies exact multiline evidence',async t=>{
  let schema;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{schema=JSON.parse(options.body).output_config.format.schema;return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({business_type:'b2b',need:'possible',service:'cold_email',reason:'The visitor describes a business buyer.',input_session_id:schema.properties.input_session_id.enum[0],output_session_id:schema.properties.output_session_id.enum[0]})}]}),{status:200});});
  const ai=new Anthropic({anthropicKey:'test-key',model:'test-model'}),sessions=[{session_id:'S01',tool_input:'CNC-machined parts\nfor electric vehicle makers',tool_output:'Competitor gaps:\nlong lead times'}];
  const result=await ai.analyse({first_name:'Test'},sessions);assert.deepEqual(schema.properties.input_session_id.enum,['S01']);assert.equal(result.input_evidence,sessions[0].tool_input);assert.equal(result.output_evidence,sessions[0].tool_output);
});
test('draft assembly preserves source phrases and the approved link while normalising dashes', async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({subject:'A useful next step',advice:'Focus your outreach on a clear buyer problem — then ask a relevant question.',invitation:'Would a short conversation help?'})}]}),{status:200}));
  const ai=new Anthropic({anthropicKey:'test-key',model:'test-model',provider:'anthropic'});
  const sessions=[{tool_input:'Industry: corporate travel. Offer: offsite planning',tool_output:'DM angles generated'}];
  const draft=await ai.draft({first_name:'Pooja'},sessions,{tier:'hot',service:'linkedin_outreach',analysis:{input_evidence:'corporate travel',output_evidence:'DM angles generated'}});
  assert.deepEqual(validateDraft(draft,sessions),[]);assert.ok(draft.body.includes(CALL_URL));assert.ok(!draft.body.includes('—'));
});
test('empty AI advice or invitation cannot become a valid framed email',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({subject:'Your profile',advice:'',invitation:''})}]}),{status:200}));
  const ai=new Anthropic({anthropicKey:'test-key',model:'test-model',provider:'anthropic'});
  await assert.rejects(ai.draft({first_name:'Test'},[{tool_input:'corporate travel',tool_output:'DM angles generated'}],{tier:'warm',service:'linkedin_outreach'}),/incomplete/);
});
test('Zoho suppresses workflows and Cadences for both insert and update', async t => {
  let upsert;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(url.includes('/oauth/'))return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}),{status:200});
    upsert=JSON.parse(options.body);return new Response(JSON.stringify({data:[{status:'success',details:{id:'crm-test'}}]}),{status:200});
  });
  const crm=new Zoho({zohoAccounts:'https://accounts.zoho.in',zohoApi:'https://www.zohoapis.in',zohoClientId:'test',zohoClientSecret:'test',zohoRefresh:'test'});
  const result=await crm.upsert({id:'test',first_name:'Test',last_name:'Example',company:'Fictional',email:'test@example.test'}, {id:'a_test',score:8,tier:'hot',service:'cold_email',reason:'Test',flags:[],draft:{subject:'Draft',body:'Draft body'}});
  assert.equal(result,'crm-test');assert.deepEqual(upsert.trigger,[]);assert.deepEqual(upsert.skip_feature_execution,[{name:'cadences',action:'insert'},{name:'cadences',action:'update'}]);assert.deepEqual(upsert.duplicate_check_fields,['Email']);assert.match(upsert.data[0].Description,/DRAFT ONLY/);
});
test('Supabase permanent credentials error is surfaced without exposing keys', async t => {
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}',{status:401});});
  await assert.rejects(new SupabaseStore({supabaseUrl:'https://test-project.supabase.co',supabaseKey:'secret-test-value'}).all('sessions'),e=>!e.message.includes('secret-test-value')&&e.message.includes('401'));assert.equal(calls,1);
});
