export const RULE_VERSION='hook-v1.0';
export const WRITING_VERSION='hook-writing-v1.1';
export const STYLES=['direct','curiosity','contrast'];
export const normalizeHook=value=>String(value??'').normalize('NFC').replace(/\r\n?/g,'\n').split('\n').map(line=>line.trim().replace(/[\t ]+/g,' ')).filter(Boolean).join('\n');
const words=text=>text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||[];
const jargon=/\b(?:leverage|synerg\w*|ICPs?|ROI|pipeline|hyper.?personali\w*|game.?changer|revolutioni\w*|delve)\b/i;
const promise=/\b(?:guarantee\w*|promise\w*|will (?:increase|boost|deliver|double|triple|generate)|proven results|our clients (?:get|see|achieve)|we(?:'ve| have) (?:helped|generated|delivered|achieved))\b/i;
export function gradeHook(input){
  const hook=normalizeHook(input), count=words(hook).length, first=words(hook.split('\n')[0]||'').length;
  const definitions=[
    ['length','Enough context, kept short',20,count>=8&&count<=40,'Use eight to forty words so the opening has context without becoming a full post.'],
    ['opening','A readable first line',20,first>=4&&first<=18,'Keep the first line between four and eighteen words.'],
    ['reader','A reader in focus',15,/\b(?:you|your|founders?|buyers?|customers?|clients?|teams?|leaders?|marketers?|recruiters?|engineers?|designers?|managers?|sellers?|business owners?)\b/i.test(hook),'Name the reader or use “you” or “your” to make the opening relevant.'],
    ['curiosity','A reason to read on',20,/\?|\b(?:but|yet|instead|why|how|what if|most|stop|without|rather than)\b/i.test(hook),'Add a relevant question or a clear contrast that gives the reader a reason to continue.'],
    ['specificity','A concrete subject',15,/\b(?:emails?|posts?|repl(?:y|ies)|sales|meetings?|profiles?|customers?|clients?|hiring|interviews?|products?|pricing|design|code|onboarding|feedback|invoices?|budgets?|research|LinkedIn|cashews?|exports?)\b|[“"][^“”"\n]{3,}[”"]|\d/i.test(hook),'Name a concrete task, object or example instead of speaking only in generalities.'],
    ['clean','Plain, uncluttered copy',10,Boolean(hook)&&!jargon.test(hook)&&!promise.test(hook)&&!/[—–]|https?:\/\/|www\.|#\w/.test(hook),'Remove jargon, guarantees, em dashes, links and hashtags from the opening.'],
  ];
  const rules=definitions.map(([id,label,weight,passed,feedback])=>({id,label,weight,passed,earned:passed?weight:0,feedback:passed?'Passed.':feedback}));
  return {version:RULE_VERSION,score:rules.reduce((sum,r)=>sum+r.earned,0),wordCount:count,rules};
}
function invalid(message){const error=new Error(message);error.status=400;throw error;}
export function validateSubmission(value){
  if(!value||typeof value!=='object'||Array.isArray(value))invalid('Submit the contact form and your hook.');
  for(const key of ['name','designation','email','hook','requestId'])if(typeof value[key]!=='string')invalid('Please complete all required fields.');
  if(value.website)invalid('This submission could not be accepted.');
  const name=value.name.trim().replace(/\s+/g,' '),designation=value.designation.trim().replace(/\s+/g,' '),email=value.email.trim().toLowerCase(),hook=normalizeHook(value.hook);
  if(name.length<2||name.length>100||/[\r\n\u0000-\u001f]/.test(name))invalid('Enter a name between two and one hundred characters.');
  if(designation.length<2||designation.length>100||/[\r\n\u0000-\u001f]/.test(designation))invalid('Enter your role or designation.');
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))invalid('Enter a valid email address.');
  if(hook.length<10||hook.length>500||hook.split('\n').length>2||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(hook))invalid('Paste one or two lines, between ten and five hundred characters.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId))invalid('Refresh the page and try again.');
  if(value.consent!==true)invalid('Please agree to the session storage notice.');
  return {name,designation,email,hook,requestId:value.requestId.toLowerCase(),consent:true};
}
export function validateRewrites(value,hook=''){
  const errors=[];
  if(!value||Object.keys(value).sort().join(',')!==[...STYLES].sort().join(','))return ['Return exactly direct, curiosity and contrast.'];
  for(const style of STYLES){
    const text=value[style];
    if(typeof text!=='string'||!text.trim()){errors.push(`${style}: supply a nonempty rewrite.`);continue;}
    if(text.length>650||text.trim().split(/\s+/).length>=120||text.split(/\r?\n/).filter(x=>x.trim()).length>2)errors.push(`${style}: keep it to one or two lines and under one hundred and twenty words.`);
    if(/[—–\d]/.test(text)||jargon.test(text)||promise.test(text))errors.push(`${style}: remove dashes, jargon, numbers and unsupported claims.`);
    for(const phrase of ['most','always','never','everyone','everybody','nobody','a lot of','plenty of','research shows','studies show'])if(new RegExp(`\\b${phrase}\\b`,'i').test(text)&&!new RegExp(`\\b${phrase}\\b`,'i').test(hook))errors.push(`${style}: do not introduce an unsupported generalisation (${phrase}).`);
    if(/https?:\/\/|www\.|[\w-]+\.(?:com|org|net|io|ai|in|example)\b/i.test(text))errors.push(`${style}: do not include links.`);
    if(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|double|triple)\b[\w\s-]{0,45}\b(?:leads?|clients?|meetings?|sales|revenue|percent|deals?|replies|engagement)\b/i.test(text))errors.push(`${style}: do not invent numerical results.`);
  }
  const texts=STYLES.map(style=>String(value[style]||'').trim().toLowerCase());
  if(new Set(texts).size!==3)errors.push('Make the three rewrites distinct.');
  return errors;
}
