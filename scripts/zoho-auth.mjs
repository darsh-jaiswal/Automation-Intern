import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { root } from '../src/config.mjs';

try {
  const auth = parseEnv(await readFile(`${root}.env.zoho`,'utf8'));
  const accounts = auth.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in';
  if(!/^https:\/\/accounts\.zoho\.(?:in|com|eu|com\.au|jp|ca|com\.cn|sa)$/.test(accounts)) throw new Error('Expected the official Zoho accounts URL for your region.');
  for(const key of ['ZOHO_CLIENT_ID','ZOHO_CLIENT_SECRET','ZOHO_GRANT_CODE']) if(!auth[key]?.trim()) throw new Error(`Fill ${key} in .env.zoho first.`);
  const response = await fetch(`${accounts}/oauth/v2/token`, {method:'POST',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:auth.ZOHO_CLIENT_ID,client_secret:auth.ZOHO_CLIENT_SECRET,code:auth.ZOHO_GRANT_CODE,grant_type:'authorization_code'})});
  const data = await response.json();
  if(!response.ok || !data.refresh_token || !data.api_domain) throw new Error(`Zoho authorization failed (${String(data.error || response.status).replace(/[^a-zA-Z0-9_]/g,'')}). If the code expired, generate a fresh code and try again.`);
  if(!/^https:\/\/www\.zohoapis\.(?:in|com|eu|com\.au|jp|ca|com\.cn|sa)$/.test(data.api_domain)) throw new Error('Zoho returned an unexpected API domain.');
  const values={ZOHO_ACCOUNTS_URL:accounts,ZOHO_API_URL:data.api_domain,ZOHO_CLIENT_ID:auth.ZOHO_CLIENT_ID,ZOHO_CLIENT_SECRET:auth.ZOHO_CLIENT_SECRET,ZOHO_REFRESH_TOKEN:data.refresh_token};
  let env=await readFile(`${root}.env`,'utf8');
  for(const [name,value] of Object.entries(values)) {
    if(/[\r\n]/.test(value)) throw new Error('Unexpected newline in OAuth response.');
    const re=new RegExp(`^${name}=[^\\r\\n]*`,'m');env=re.test(env)?env.replace(re,()=>`${name}=${value}`):`${env}\n${name}=${value}\n`;
  }
  await writeFile(`${root}.env`,env,{mode:0o600});
  console.log('Zoho refresh token saved to the gitignored .env. No credentials printed.');
} catch(e) { console.error(e.message); process.exitCode=1; }
