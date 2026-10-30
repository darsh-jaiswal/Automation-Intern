import test from 'node:test';import assert from 'node:assert/strict';
import {usageRecord,recordUsage} from '../lib/usage.mjs';
test('cost estimate uses actual standard input and output tokens, with no lead content',()=>{
  const result=usageRecord({id:'msg_test',model:'claude-sonnet-4-6',usage:{input_tokens:1168,output_tokens:218}},{source:'task1',operation:'analysis'});
  assert.equal(result.estimated_cost_usd,.006774);assert.equal(result.cost_is_estimate,true);assert.equal(result.recovered,false);
  assert.equal(usageRecord({}),null);
});
test('cache writes, cache hits and one-hour cache are priced separately',()=>{
  const result=usageRecord({id:'msg_test',model:'claude-sonnet-4-6',usage:{input_tokens:1000,output_tokens:100,cache_read_input_tokens:1000,cache_creation_input_tokens:2000,cache_creation:{ephemeral_5m_input_tokens:1000,ephemeral_1h_input_tokens:1000}}});
  assert.equal(result.estimated_cost_usd,.01455);
});
test('unknown model or unsupported service tier is unpriced rather than free',()=>{
  assert.equal(usageRecord({id:'a',model:'unknown',usage:{input_tokens:100,output_tokens:100}}).estimated_cost_usd,null);
  assert.equal(usageRecord({id:'a',model:'claude-sonnet-4-6',usage:{input_tokens:100,service_tier:'batch'}}).estimated_cost_usd,null);
});
test('meter stores only usage and deduplicates by provider response ID',async()=>{
  let saved;await recordUsage({id:'msg_test',model:'claude-sonnet-4-6',usage:{input_tokens:10,output_tokens:5}},{source:'task2',env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-key'},fetcher:async(url,options)=>{saved=JSON.parse(options.body);assert.match(url,/on_conflict=id/);return new Response(null,{status:201});}});
  assert.equal(saved.id,'ai_usage_msg_test');assert.equal(saved.stage,'anthropic_usage');assert.ok(!saved.message.includes('test-key'));
});
