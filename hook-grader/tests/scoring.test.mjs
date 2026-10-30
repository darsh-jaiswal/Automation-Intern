import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeHook, normalizeHook, validateSubmission, validateRewrites } from '../lib/rules.mjs';

const strong='Your sales emails are easy to ignore.\nWhat makes a buyer want to reply?';
test('six transparent rules sum to 100 and require no AI',()=>{
  const result=gradeHook(strong);
  assert.equal(result.score,100);assert.equal(result.rules.length,6);
  assert.equal(result.rules.reduce((sum,rule)=>sum+rule.weight,0),100);
  assert.ok(result.rules.every(rule=>rule.passed));
});
test('weak hook loses points with one useful explanation per failed rule',()=>{
  const result=gradeHook('Excited to share some thoughts today');
  assert.equal(result.score,30);
  assert.ok(result.rules.filter(rule=>!rule.passed).every(rule=>rule.feedback.length>10));
});
test('same hook gives identical results despite line endings and trailing spaces',()=>{
  assert.deepEqual(gradeHook(strong),gradeHook(strong.replace('\n','\r\n')+'  '));
  assert.equal(normalizeHook('  Hello   reader. \r\n\r\n Why reply?  '),'Hello reader.\nWhy reply?');
});
test('punctuation is not a substitute for reader relevance or concrete detail',()=>{
  const r=gradeHook('Wow! Amazing things are happening here.\nCan you believe it?');
  assert.equal(r.rules.find(x=>x.id==='specificity').passed,false);
});
test('submission validates contact, consent, size, two lines and stable request ID',()=>{
  const input={name:'Darsh Example',designation:'Founder',email:'person@example.com',hook:strong,consent:true,requestId:'9b11d36a-35f9-4f80-9adb-67b01b088cef',website:''};
  assert.equal(validateSubmission(input).email,'person@example.com');
  for(const change of [{email:'bad'},{consent:false},{name:''},{hook:'one\ntwo\nthree'},{hook:'x'.repeat(501)},{requestId:'anything'},{website:'spam'}])assert.throws(()=>validateSubmission({...input,...change}));
});
test('rewrite checks enforce three unique styles, brevity and safe plain language',()=>{
  const good={direct:'Your sales emails need a reason to reply.',curiosity:'What makes your sales emails worth answering?',contrast:'More sales emails can wait. Give your buyer a reason to reply.'};
  assert.deepEqual(validateRewrites(good),[]);
  assert.ok(validateRewrites({...good,direct:'Get 100 guaranteed sales leads.'}).length);
  assert.ok(validateRewrites({...good,direct:'Your sales emails bring fifty meetings every month.'}).length);
  assert.ok(validateRewrites({...good,direct:'Most LinkedIn posts say nothing.'},'Excited to share some thoughts today').length);
  assert.ok(validateRewrites({...good,direct:'Use leverage to fill your pipeline.'}).length);
  assert.ok(validateRewrites({...good,direct:'Email—send it https://evil.example'}).length);
  assert.ok(validateRewrites({...good,direct:good.curiosity}).length);
  assert.ok(validateRewrites({...good,direct:'word '.repeat(120)}).length);
});
