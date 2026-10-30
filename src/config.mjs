import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(`${root}.env`)) process.loadEnvFile(`${root}.env`);
export function config() {
  const provider = process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'gemini');
  return {
    supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/, '') || '',
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    geminiKey: process.env.GEMINI_API_KEY || '',
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
    provider,
    model: process.env.AI_MODEL || (provider === 'anthropic' ? process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5' : process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
    workerToken: process.env.WORKER_TOKEN || '',
    port: Number(process.env.PORT || 4310),
    zohoAccounts: process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in',
    zohoApi: process.env.ZOHO_API_URL || 'https://www.zohoapis.in',
    zohoClientId: process.env.ZOHO_CLIENT_ID || '',
    zohoClientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    zohoRefresh: process.env.ZOHO_REFRESH_TOKEN || '',
  };
}
export function readiness(c = config()) {
  return { supabase: Boolean(c.supabaseUrl && c.supabaseKey), ai: Boolean(c.provider === 'anthropic' ? c.anthropicKey : c.geminiKey), zoho: Boolean(c.zohoClientId && c.zohoClientSecret && c.zohoRefresh), worker_auth: c.workerToken.length >= 24 };
}
