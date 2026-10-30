import { config, root, readiness } from './config.mjs';
import { SupabaseStore } from './store.mjs';
import { Gemini, Anthropic, Zoho } from './providers.mjs';
import { Engine } from './engine.mjs';
export function liveEngine(c = config()) {
  if (!['anthropic', 'gemini'].includes(c.provider)) throw new Error('AI_PROVIDER must be anthropic or gemini.');
  return new Engine({ store: new SupabaseStore(c), ai: c.provider === 'anthropic' ? new Anthropic(c) : new Gemini(c), crm: new Zoho(c), model: `${c.provider}:${c.model}` });
}
if (process.argv[1]?.endsWith('cli.mjs')) {
  try {
    const command = process.argv[2];
    const c = config();
    if (command === 'status') {
      const configured = readiness(c);
      console.log(JSON.stringify({ configured, ...(configured.supabase ? { summary: (await liveEngine(c).state()).summary } : {}) }, null, 2));
    } else {
      const engine = liveEngine(c);
      const result = await engine.exclusive(() => command === 'import' ? engine.importCsv(`${root}leads.csv`) : command === 'run' ? engine.run() : Promise.reject(new Error('Use import, run or status.')));
      console.log(JSON.stringify(result, null, 2));
      if (result.errors || result.crm_synced === 0 && command === 'run') process.exitCode = 2;
    }
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
