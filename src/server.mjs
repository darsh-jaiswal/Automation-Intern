import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { config, root, readiness } from './config.mjs';
import { liveEngine } from './cli.mjs';
import { normalize, hash } from './rules.mjs';

const c = config();
let setupNonce = randomBytes(32).toString('hex');
let engine;
const getEngine = () => engine ||= liveEngine(c);
const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 131072) { const e = new Error('Request too large.'); e.status = 413; throw e; } chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { const e = new Error('Invalid JSON.'); e.status = 400; throw e; }
}
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); }
const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || '';
    if (!new RegExp(`^(?:127\\.0\\.0\\.1|localhost):${c.port}$`).test(host)) return json(res, 403, { error: 'Local requests only.' });
    const url = new URL(req.url, `http://${host}`);
    // Local, one-time configuration form. Keys are pasted directly from the service UI;
    // they are never returned to the browser, put in URLs, or printed to logs.
    if (req.method === 'GET' && url.pathname === '/setup') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", 'Referrer-Policy': 'no-referrer' });
      return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Local Supabase setup</title><link rel="stylesheet" href="/style.css"></head><body><main><section class="panel"><h1>Connect Supabase</h1><p>This writes the existing server key directly into your gitignored local .env file. The key is never displayed back.</p><form method="post" action="/setup"><input type="hidden" name="nonce" value="${setupNonce}"><label for="url">Project URL</label><input id="url" name="url" value="https://dlxjnomdwehkiwwqjwjv.supabase.co" required><label for="key">Existing secret / service-role key</label><input id="key" name="key" type="password" autocomplete="off" required><p><button>Save locally</button></p></form></section></main></body></html>`);
    }
    if (req.method === 'POST' && url.pathname === '/setup') {
      const origin = req.headers.origin;
      const sameOrigin = origin === `http://${host}` || ((!origin || origin === 'null') && req.headers['sec-fetch-site'] === 'same-origin');
      if(!sameOrigin || req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') return json(res,403,{error:'Local same-origin form only.'});
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)return json(res,413,{error:'Too large.'});chunks.push(chunk);}
      const values=new URLSearchParams(Buffer.concat(chunks).toString());
      if(!safeEqual(values.get('nonce')||'',setupNonce))return json(res,403,{error:'Expired setup form.'});
      const sbUrl=values.get('url')||'', key=values.get('key')||'';
      if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(sbUrl) || !/^(?:sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_.-]{40,})$/.test(key))return json(res,400,{error:'Expected a Supabase URL and existing backend secret/service-role key.'});
      let env=await readFile(`${root}.env`,'utf8');
      for(const [name,value] of [['SUPABASE_URL',sbUrl],['SUPABASE_SERVICE_ROLE_KEY',key]]){const re=new RegExp(`^${name}=[^\\r\\n]*`,'m');env=re.test(env)?env.replace(re,`${name}=${value}`):`${env}\n${name}=${value}\n`;process.env[name]=value;}
      await writeFile(`${root}.env`,env,{mode:0o600});Object.assign(c,config());engine=undefined;setupNonce=randomBytes(32).toString('hex');
      return json(res,200,{saved:true,supabase_configured:true,message:'Saved to the local .env file. No key returned.'});
    }
    if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(url.pathname)) {
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'" });
      return res.end(await readFile(`${root}public/${file}`));
    }
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, draft_only: true, configured: readiness(c) });
    if (c.workerToken.length < 24 || !safeEqual(req.headers.authorization || '', `Bearer ${c.workerToken}`)) return json(res, 401, { error: 'A valid worker token is required.' });
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, await getEngine().state());
    if (req.method === 'GET' && url.pathname === '/api/contacts') return json(res, 200, { contacts: await getEngine().store.all('contacts') });
    if (req.method !== 'POST') return json(res, 404, { error: 'Unknown route.' });
    // Reject browser cross-origin writes, including same-site cross-port attacks.
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return json(res, 403, { error: 'Cross-origin writes are not permitted.' });
    const input = await body(req);
    const result = await getEngine().exclusive(async () => {
      if (url.pathname === '/api/import') return getEngine().importCsv(`${root}leads.csv`);
      if (url.pathname === '/api/run') return getEngine().run();
      if (url.pathname === '/api/assess') return getEngine().assess(input.contact_id);
      if (url.pathname === '/api/draft') return getEngine().draft(input.assessment_id);
      if (url.pathname === '/api/publish') return getEngine().publish(input.assessment_id);
      if (url.pathname === '/api/sessions') {
        if (typeof input.source_tool !== 'string' || typeof input.tool_input !== 'string' || typeof input.tool_output !== 'string' || !input.email || !input.first_name) { const e = new Error('Session requires source_tool, first_name, email, tool_input and tool_output.'); e.status = 400; throw e; }
        const raw = { ...input, lead_id: input.lead_id || `web_${hash(input).slice(0, 24)}` };
        const imported = await getEngine().ingest([raw]);
        return { ...imported, contact_id: normalize(raw).contact_id };
      }
      const e = new Error('Unknown route.'); e.status = 404; throw e;
    });
    json(res, 200, result);
  } catch (e) { json(res, e.status || 503, { error: e.message }); }
});
server.listen(c.port, '127.0.0.1', () => console.log(`Draft-only operator dashboard: http://127.0.0.1:${c.port}`));
