-- Explicit owner replacement requested by the school. Posts/data stay linked to legacy user IDs.
alter table public.staff_profiles add column retired boolean not null default false;
create or replace function public.keep_full_admin() returns trigger language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(280028);
 if lower(old.username)='3looolyyy@gmail.com' and new.retired then return new;end if;
 if lower(old.username)='archo' and (not new.active or new.retired or new.permissions->>'admin' is distinct from 'true') then raise exception 'لا يمكن تعطيل المسؤول الرئيسي';end if;
 if old.active and old.permissions->>'admin'='true' and (not new.active or new.permissions->>'admin' is distinct from 'true') and not exists(select 1 from staff_profiles where user_id<>old.user_id and active and not retired and permissions->>'admin'='true') then raise exception 'يجب الاحتفاظ بمسؤول كامل';end if;return new;end $$;
update public.staff_profiles set active=false,retired=true,permissions='{"admin":false,"news":false,"daily":false}',must_change_password=false where lower(username)='3looolyyy@gmail.com';
update public.staff_profiles set must_change_password=false;
create or replace function public.staff_can(p_permission text) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from staff_profiles where user_id=auth.uid() and active and not retired and (permissions->>'admin'='true' or permissions->>p_permission='true'))$$;
create or replace function public.current_staff() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('id',user_id,'username',username,'permissions',case when permissions->>'admin'='true' then '{"admin":true,"news":true,"daily":true}'::jsonb else permissions end,'active',active,'owner',lower(username)='archo','mustChangePassword',false) from staff_profiles where user_id=auth.uid() and active and not retired$$;
create or replace function public.first_owner_bootstrap_allowed() returns boolean language sql stable security definer set search_path=public as $$select not exists(select 1 from staff_profiles where username_key='archo') and (not exists(select 1 from auth.users) or exists(select 1 from auth.users where lower(email)='3looolyyy@gmail.com'))$$;
-- Permission grants from 0007 remain service-role-only for the bootstrap function.
