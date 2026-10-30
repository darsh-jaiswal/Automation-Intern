import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/grade/route.js';
const request=(body,extra={})=>new Request('http://localhost:3000/api/grade',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json',...extra},body});
test('matching browser origin uses actual Host rather than internal Next URL',async()=>{
  const response=await POST(request('{}'));assert.equal(response.status,400);assert.match((await response.json()).error,/required/);
});
test('cross-origin and non-HTTP origins are rejected before storage or AI',async()=>{
  for(const origin of ['https://evil.example','null','file:///tmp/a'])assert.equal((await POST(request('{}',{origin}))).status,403);
});
test('invalid JSON, non-JSON and oversized bodies are rejected',async()=>{
  assert.equal((await POST(request('{'))).status,400);
  assert.equal((await POST(request('{}',{'content-type':'text/plain'}))).status,415);
  assert.equal((await POST(request('a'.repeat(16385)))).status,413);
});
