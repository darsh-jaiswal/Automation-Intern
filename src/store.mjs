import { retry } from './providers.mjs';
const TABLES = new Set(['sessions', 'contacts', 'assessments', 'alerts', 'events']);
export class SupabaseStore {
  constructor(config) {
    if (!config.supabaseUrl || !config.supabaseKey) throw new Error('Supabase URL and service role/secret key are required.');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)) throw new Error('Expected an HTTPS Supabase project URL.');
    this.config = config;
  }
  async query(table, { method = 'GET', rows, filters = {}, ignoreDuplicates = false } = {}) {
    if (!TABLES.has(table)) throw new Error('Unknown application table.');
    const params = new URLSearchParams({ select: '*' });
    for (const [key, value] of Object.entries(filters)) params.set(key, `eq.${value}`);
    if (method === 'POST') params.set('on_conflict', 'id');
    return retry(async () => {
      let response;
      try { response = await fetch(`${this.config.supabaseUrl}/rest/v1/automation_${table}?${params}`, {
        method, signal: AbortSignal.timeout(30000),
        headers: { apikey: this.config.supabaseKey, Authorization: `Bearer ${this.config.supabaseKey}`, 'Content-Type': 'application/json', Prefer: `return=representation,resolution=${ignoreDuplicates ? 'ignore' : 'merge'}-duplicates` },
        ...(rows ? { body: JSON.stringify(rows) } : {}),
      }); } catch { const e = new Error(`Supabase ${table} network failure or timeout.`); e.retryable = true; throw e; }
      if (!response.ok) { const e = new Error(`Supabase ${table} operation failed (HTTP ${response.status}). Check migration and credentials.`); e.retryable = response.status === 429 || response.status >= 500; throw e; }
      return response.json();
    });
  }
  async all(table, filters = {}) {
    // The assignment is small. Explicitly fail rather than silently truncate a larger dataset.
    const rows = await this.query(table, { filters });
    if (rows.length >= 1000) throw new Error('Dataset reached the API row limit; add pagination before processing more records.');
    return rows;
  }
  async get(table, id) { return (await this.all(table, { id }))[0] || null; }
  async put(table, row, options = {}) { return this.query(table, { method: 'POST', rows: row, ...options }); }
}

// Used only by automated tests. The live CLI and dashboard never fall back to it.
export class MemoryStore {
  constructor() { this.tables = Object.fromEntries([...TABLES].map(t => [t, new Map()])); }
  async all(table, filters = {}) { return [...this.tables[table].values()].filter(r => Object.entries(filters).every(([k,v]) => r[k] === v)); }
  async get(table, id) { return this.tables[table].get(id) || null; }
  async put(table, row, { ignoreDuplicates = false } = {}) { const existing = await this.get(table, row.id); if (!existing || !ignoreDuplicates) this.tables[table].set(row.id, structuredClone({ ...existing, ...row })); return [await this.get(table, row.id)]; }
}
