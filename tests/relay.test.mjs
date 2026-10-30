import test from 'node:test';import assert from 'node:assert/strict';
import {selectRelayBatch,relayComplete} from '../src/relay-rules.mjs';
test('relay waits for CRM sync or intentional skip',()=>{
  const a={session_ids:['hook_a'],status:'complete',crm_status:'synced'};
  assert.equal(relayComplete(a,'hook_a'),true);
  for(const crm_status of ['pending','not_configured','error'])assert.equal(relayComplete({...a,crm_status},'hook_a'),false);
  assert.equal(relayComplete({...a,status:'needs_review',crm_status:'skipped'},'hook_a'),true);
});
test('failed queue entries back off and cannot starve later valid entries',()=>{
  const time=Date.parse('2026-10-31T02:00:00Z'),events=Array.from({length:11},(_,i)=>({id:`hook_dispatch_${i}`,created_at:'2026-10-31T00:00:00Z'}));
  const attempts=events.slice(0,10).map(e=>({id:e.id.replace('dispatch','attempt'),created_at:new Date(time-1000).toISOString()}));
  assert.deepEqual(selectRelayBatch(events,attempts,{time}).map(e=>e.id),['hook_dispatch_10']);
  const later=selectRelayBatch(events,attempts,{time:time+31000});assert.equal(later[0].id,'hook_dispatch_10');
});
