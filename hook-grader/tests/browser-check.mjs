// Explicit live smoke test: uses a fictional contact, calls Claude and saves a real session.
// Run separately from unit tests. Set BASE_URL to the deployed tool to test production.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const target=process.env.BASE_URL||'http://127.0.0.1:3000';
const dir=new URL('../../.local/task2/',import.meta.url);await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_PATH?{executablePath:process.env.PLAYWRIGHT_BROWSER_PATH}:{})});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(target,{waitUntil:'networkidle'});
  await page.screenshot({path:fileURLToPath(new URL('production-landing-desktop.png',dir)),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:fileURLToPath(new URL('production-landing-mobile.png',dir)),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:1440,height:1100});
  await page.getByLabel('Your name',{exact:true}).fill('Assignment Demo');
  await page.getByLabel('Role or designation').fill('Founder');
  await page.getByLabel('Email address').fill('hook.demo@myntmore-assignment.example');
  await page.getByLabel('I agree to save this session and have AI rewrite my hook.').check();
  await page.getByRole('button',{name:'Continue to my hook'}).click();
  await page.getByLabel('Your LinkedIn hook',{exact:true}).fill('Excited to share some thoughts today');
  const pending=page.waitForResponse(response=>response.url().endsWith('/api/grade')&&response.request().method()==='POST',{timeout:120000});
  await page.getByRole('button',{name:'Grade my hook',exact:true}).click();
  const response=await pending,result=await response.json();
  assert.equal(response.status(),200,JSON.stringify(result));assert.equal(result.status,'ready');assert.equal(result.grade.score,30);assert.equal(result.rewrites.length,3);
  const payload=response.request().postDataJSON();
  await page.locator('.results').waitFor();assert.equal(await page.locator('.rule-status.fail').count(),4);
  await page.getByRole('button',{name:'Copy Say it directly rewrite'}).click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),result.rewrites[0].text);
  await page.screenshot({path:fileURLToPath(new URL('production-results-desktop.png',dir)),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:fileURLToPath(new URL('production-results-mobile.png',dir)),fullPage:true,animations:'disabled'});
  const replay=await context.request.post(`${target}/api/grade`,{data:payload});assert.equal(replay.status(),200);
  assert.deepEqual(await replay.json(),result);
  const negative=await context.request.post(`${target}/api/grade`,{data:{}});assert.equal(negative.status(),400);
  assert.deepEqual(errors,[]);
  await writeFile(new URL('production-demo.json',dir),JSON.stringify(result,null,2));
  const proof={checked_at:new Date().toISOString(),url:target,http_status:response.status(),score:result.grade.score,failed_rules:4,rewrites:3,session_saved:result.saved,replay_same_result:true,clipboard_verified:true,mobile_overflow:false,browser_errors:errors.length,invalid_request_status:negative.status()};
  await writeFile(new URL('browser-verification.json',dir),JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof,null,2));
}finally{await browser.close();}
