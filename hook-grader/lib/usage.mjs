// USD per million tokens, checked against Anthropic's pricing on 31 October 2026.
// These rates cover the standard, small-context models used by this assignment.
export const PRICE_SOURCE='https://platform.claude.com/docs/en/about-claude/pricing';
export function usageRecord(response,{source,operation,recordedAt=new Date().toISOString(),recovered=false}={}){
  if(!response?.id||!response.usage)return null;
  const u=response.usage,number=value=>Number.isFinite(value)&&value>=0?value:0;
  const input=number(u.input_tokens),output=number(u.output_tokens),read=number(u.cache_read_input_tokens),write=number(u.cache_creation_input_tokens);
  const longWrite=number(u.cache_creation?.ephemeral_1h_input_tokens),shortWrite=number(u.cache_creation?.ephemeral_5m_input_tokens)||Math.max(0,write-longWrite);
  const rates=/^claude-sonnet-4-6(?:-|$)/.test(response.model)?[3,15]:/^claude-haiku-4-5(?:-|$)/.test(response.model)?[1,5]:null;
  const supported=rates&&input+read+write<=200000&&(!u.service_tier||u.service_tier==='standard')&&(!u.speed||u.speed==='standard');
  const cost=supported?(input*rates[0]+output*rates[1]+read*rates[0]*.1+shortWrite*rates[0]*1.25+longWrite*rates[0]*2)/1000000*(u.inference_geo==='us'?1.1:1):null;
  return {response_id:response.id,recorded_at:recordedAt,source,operation,model:response.model,input_tokens:input,output_tokens:output,cache_read_tokens:read,cache_write_5m_tokens:shortWrite,cache_write_1h_tokens:longWrite,estimated_cost_usd:cost===null?null:Number(cost.toFixed(9)),cost_is_estimate:true,recovered,pricing_checked_on:'2026-10-31',pricing_source:PRICE_SOURCE};
}
export async function recordUsage(response,{source,operation,env=process.env,fetcher=fetch,localWrite}={}){
  const record=usageRecord(response,{source,operation});if(!record)return null;
  if(localWrite)await localWrite(record);
  const url=env.SUPABASE_URL?.replace(/\/$/,'');
  if(!url||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Usage log storage is not configured.');
  const result=await fetcher(`${url}/rest/v1/automation_events?on_conflict=id`,{method:'POST',signal:AbortSignal.timeout(12000),headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal,resolution=ignore-duplicates'},body:JSON.stringify({id:`ai_usage_${record.response_id}`,contact_id:null,stage:'anthropic_usage',level:'info',message:JSON.stringify(record),created_at:record.recorded_at})});
  if(!result.ok)throw new Error('Usage log storage failed.');
  return record;
}
