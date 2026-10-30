-- Dedicated assignment tables. No changes to unrelated Supabase data.
begin;
create table if not exists public.automation_contacts (
  id text primary key,
  first_name text not null default '', last_name text not null default '',
  designation text not null default '', email text not null default '',
  company text not null default '', company_website text not null default '',
  linkedin_url text not null default '', updated_at timestamptz not null default now()
);
create table if not exists public.automation_sessions (
  id text primary key,
  contact_id text not null references public.automation_contacts(id),
  source_tool text not null, created_at text not null default '',
  tool_input text not null default '', tool_output text not null default '',
  raw jsonb not null, payload_hash text not null,
  imported_at timestamptz not null default now()
);
create index if not exists automation_sessions_contact_idx on public.automation_sessions(contact_id);
create table if not exists public.automation_assessments (
  id text primary key, contact_id text not null references public.automation_contacts(id),
  version text not null, model text not null, session_ids jsonb not null,
  score integer not null check(score between 1 and 10),
  tier text not null check(tier in ('hot','warm','not_a_fit')),
  service text, reason text not null, points jsonb not null, flags jsonb not null,
  status text not null, analysis jsonb, draft jsonb, validation jsonb,
  crm_status text not null default 'pending', crm_id text,
  error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists automation_assessments_contact_idx on public.automation_assessments(contact_id);
create table if not exists public.automation_alerts (
  id text primary key, assessment_id text not null references public.automation_assessments(id),
  contact_id text not null references public.automation_contacts(id), message text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.automation_events (
  id text primary key, contact_id text, stage text not null,
  level text not null, message text not null, created_at timestamptz not null default now()
);
-- No anon/authenticated policies. Only the server service role can access lead data.
alter table public.automation_contacts enable row level security;
alter table public.automation_sessions enable row level security;
alter table public.automation_assessments enable row level security;
alter table public.automation_alerts enable row level security;
alter table public.automation_events enable row level security;
revoke all on public.automation_contacts, public.automation_sessions, public.automation_assessments, public.automation_alerts, public.automation_events from anon, authenticated;
grant select, insert, update on public.automation_contacts, public.automation_sessions, public.automation_assessments, public.automation_alerts, public.automation_events to service_role;
commit;
