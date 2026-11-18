-- TV health reporting for the admin panel (remote control works without this, over Realtime broadcast).
-- Each TV reports its status (app version, mode, recent errors) every 30 seconds.
alter table public.screen_devices
  add column if not exists status    jsonb,
  add column if not exists status_at timestamptz;

create or replace function public.tv_report_status(p_token text, p_status jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Ignore oversized payloads so one broken TV cannot bloat the table.
  if p_status is null or octet_length(p_status::text) > 8192 then return; end if;
  update screen_devices
     set status = p_status, status_at = now(), last_seen_at = now()
   where token = p_token and screen_id is not null;
end $$;
revoke all on function public.tv_report_status(text, jsonb) from public;
grant execute on function public.tv_report_status(text, jsonb) to anon, authenticated;
