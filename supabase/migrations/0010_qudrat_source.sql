-- Apply after 0009 (0009 itself is optional for the web app). Additive; no existing data changes.
-- Server-only settings, such as the Qudrat Pro leaderboard link that carries a key.
-- RLS is on with no policies: browsers, TVs and signed-in staff cannot read this table.
-- Only Netlify functions using the service role key read or write it.
create table if not exists public.server_settings(
  key        text primary key,
  value      text not null check (char_length(value) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.server_settings enable row level security;
revoke all on public.server_settings from anon, authenticated;
