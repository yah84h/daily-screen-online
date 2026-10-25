-- Run after 0005. The named owner retains full-admin access and all existing passwords are unchanged.
-- Other existing accounts receive permissions from the owner in /users.
create table public.staff_profiles(user_id uuid primary key references auth.users(id) on delete cascade,username text not null,username_key text generated always as(lower(username)) stored unique,permissions jsonb not null default '{"admin":false,"news":false,"daily":false}',active boolean not null default true,created_at timestamptz not null default now());
alter table public.staff_profiles enable row level security;
insert into public.staff_profiles(user_id,username,permissions) select id,coalesce(email,id::text),case when lower(email)='3looolyyy@gmail.com' then '{"admin":true,"news":true,"daily":true}'::jsonb else '{"admin":false,"news":false,"daily":false}'::jsonb end from auth.users on conflict do nothing;
create or replace function public.staff_can(p_permission text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from staff_profiles where user_id=auth.uid() and active and (permissions->>'admin'='true' or permissions->>p_permission='true')) $$;
revoke all on function public.staff_can(text) from public;grant execute on function public.staff_can(text) to authenticated;
create policy "own profile" on public.staff_profiles for select to authenticated using(user_id=auth.uid() or public.staff_can('admin'));
create or replace function public.current_staff() returns jsonb language sql stable security definer set search_path=public as $$ select jsonb_build_object('id',user_id,'username',username,'permissions',case when permissions->>'admin'='true' then '{"admin":true,"news":true,"daily":true}'::jsonb else permissions end,'active',active,'owner',lower(username)='3looolyyy@gmail.com') from staff_profiles where user_id=auth.uid() and active $$;
revoke all on function public.current_staff() from public;grant execute on function public.current_staff() to authenticated;
create or replace function public.keep_full_admin() returns trigger language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(280028);
 if lower(old.username)='3looolyyy@gmail.com' and (new.active=false or new.permissions->>'admin' is distinct from 'true') then raise exception 'لا يمكن تعطيل المسؤول الرئيسي'; end if;
 if old.active and old.permissions->>'admin'='true' and (not new.active or new.permissions->>'admin' is distinct from 'true') and not exists(select 1 from staff_profiles where user_id<>old.user_id and active and permissions->>'admin'='true') then raise exception 'يجب الاحتفاظ بمسؤول كامل';end if;return new;end $$;
create trigger keep_full_admin before update on public.staff_profiles for each row execute function public.keep_full_admin();
-- Remove previous broad policies before adding role checks.
drop policy "admin all" on public.school_settings;drop policy "admin all" on public.screens;drop policy "admin all" on public.screen_devices;drop policy "admin all" on public.posts;drop policy "admin all" on public.presets;
create policy "staff read" on public.school_settings for select to authenticated using(public.staff_can('news') or public.staff_can('daily'));
create policy "owner update" on public.school_settings for update to authenticated using(public.staff_can('admin')) with check(public.staff_can('admin'));
create policy "staff read" on public.screens for select to authenticated using(public.staff_can('news') or public.staff_can('daily'));
create policy "staff update" on public.screens for update to authenticated using(public.staff_can('news') or public.staff_can('daily')) with check(public.staff_can('news') or public.staff_can('daily'));
create policy "admin insert" on public.screens for insert to authenticated with check(public.staff_can('admin'));
create policy "admin delete" on public.screens for delete to authenticated using(public.staff_can('admin'));
create policy "staff read" on public.screen_devices for select to authenticated using(public.staff_can('news') or public.staff_can('daily'));
create policy "admin edit" on public.screen_devices for all to authenticated using(public.staff_can('admin')) with check(public.staff_can('admin'));
create policy "staff read" on public.posts for select to authenticated using(public.staff_can('news') or public.staff_can('daily'));
create policy "daily edit" on public.posts for all to authenticated using(public.staff_can('daily')) with check(public.staff_can('daily'));
create policy "staff read" on public.presets for select to authenticated using(public.staff_can('news') or public.staff_can('daily'));
create policy "daily edit" on public.presets for all to authenticated using(public.staff_can('daily')) with check(public.staff_can('daily'));
drop policy "media admin insert" on storage.objects;drop policy "media admin update" on storage.objects;drop policy "media admin delete" on storage.objects;
create policy "staff media insert" on storage.objects for insert to authenticated with check(bucket_id='media' and public.staff_can('daily'));
create policy "staff media update" on storage.objects for update to authenticated using(bucket_id='media' and public.staff_can('daily')) with check(bucket_id='media' and public.staff_can('daily'));
create policy "staff media delete" on storage.objects for delete to authenticated using(bucket_id='media' and public.staff_can('admin'));
create or replace function public.preserve_screen_news() returns trigger language plpgsql as $$ declare wanted jsonb;begin
 if coalesce(current_setting('app.news_update',true),'')='1' then
  if not public.staff_can('news') then raise exception 'لا تملك صلاحية الأخبار';end if;
  wanted=new.template->'news';new.template=jsonb_set(old.template,'{news}',wanted,true);new.name=old.name;new.draft=old.draft;return new;
 end if;
 if not public.staff_can('admin') then
  if not public.staff_can('daily') then raise exception 'لا تملك صلاحية المحتوى';end if;
  if new.name is distinct from old.name then raise exception 'لا تملك صلاحية إعداد الشاشة';end if;
  new.id=old.id;new.created_at=old.created_at;wanted=new.template->'mediaSlideshow';new.template=old.template;
  if wanted is not null then new.template=jsonb_set(new.template,'{mediaSlideshow}',wanted,true);end if;
 end if;
 if old.template?'news' then new.template=jsonb_set(new.template,'{news}',old.template->'news',true);else new.template=new.template-'news';end if;return new;
end $$;
-- The existing RPC's authenticated check is tightened to the news role. Its update runs through the trigger above.
create or replace function public.save_screen_news(p_screen_id uuid,p_news jsonb,p_pin text default '') returns jsonb language plpgsql security invoker set search_path=public as $$ declare result jsonb;begin
 if not public.staff_can('news') then raise exception 'لا تملك صلاحية الأخبار';end if;
 if jsonb_typeof(p_news->'items') is distinct from 'array' or jsonb_array_length(p_news->'items')>30 then raise exception 'قائمة الأخبار غير صحيحة';end if;
 if exists(select 1 from jsonb_array_elements(p_news->'items') x where jsonb_typeof(x->'text') is distinct from 'string' or length(trim(x->>'text')) not between 1 and 300) then raise exception 'تحقق من نص الخبر';end if;
 perform set_config('app.news_update','1',true);update screens set template=jsonb_set(template,'{news}',p_news,true) where id=p_screen_id returning template->'news' into result;if result is null then raise exception 'الشاشة غير موجودة';end if;return result;end $$;
create or replace function public.pair_screen(p_code text,p_screen_id uuid,p_label text default null) returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.staff_can('admin') then raise exception 'صلاحية المسؤول مطلوبة';end if;
 update screen_devices set screen_id=p_screen_id,label=p_label,paired_at=now() where code=p_code and screen_id is null and created_at>now()-interval '1 hour';if not found then raise exception 'رمز الربط غير صحيح أو انتهت صلاحيته';end if;end $$;

drop trigger preserve_news on public.screens;
create trigger preserve_news before update on public.screens for each row execute function public.preserve_screen_news();
