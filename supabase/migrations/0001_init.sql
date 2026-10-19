-- ============================================================
-- الشاشة اليومية — المخطط الأساسي (مدرسة واحدة)
-- المبدأ: أي مستخدم مسجّل دخوله = مسؤول المدرسة.
-- التلفزيون لا يسجّل دخولًا؛ يصل عبر رمز ربط ثم token.
-- ملاحظة: عطّل التسجيل الذاتي من لوحة Supabase
-- (Authentication → Providers → Email → Disable sign-ups)
-- وأنشئ حسابات المسؤولين يدويًا.
-- ============================================================

create extension if not exists pgcrypto;

-- التاريخ الحالي بتوقيت الرياض (تستخدمه الجدولة)
create or replace function public.riyadh_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Riyadh')::date
$$;

-- ---------- إعدادات المدرسة (صف واحد) ----------
create table public.school_settings (
  id          int primary key default 1 check (id = 1),
  name        text not null default 'معهد النور',
  tagline     text not null default 'تعلّم، تطوّر، ألهم.',
  logo_url    text,
  updated_at  timestamptz not null default now()
);

-- ---------- الشاشات ----------
create table public.screens (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  template    jsonb not null default '{}'::jsonb,
  draft       jsonb,                       -- مسودة واحدة لكل شاشة
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- أجهزة التلفزيون المربوطة ----------
-- التلفزيون ينشئ صفًا برمز 6 أرقام، والمسؤول يربطه بشاشة.
create table public.screen_devices (
  token        text primary key default encode(gen_random_bytes(24), 'hex'),
  code         text not null unique check (code ~ '^\d{6}$'),
  screen_id    uuid references public.screens(id) on delete cascade,
  label        text,
  created_at   timestamptz not null default now(),
  paired_at    timestamptz,
  last_seen_at timestamptz
);
create index on public.screen_devices (screen_id);

-- ---------- المنشورات ----------
-- لا يوجد عمود "حالة": publish_at <= اليوم ⇒ منشور، وإلا ⇒ مجدول.
-- المحتوى الفعّال للشاشة = أحدث منشور تاريخه <= اليوم.
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  screen_id   uuid not null references public.screens(id) on delete cascade,
  content     jsonb not null,
  publish_at  date not null default public.riyadh_today(),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);
create index on public.posts (screen_id, publish_at desc, created_at desc);

-- ---------- المواضيع المحفوظة ----------
create table public.presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) <= 100),
  content     jsonb not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- تحديث updated_at تلقائيًا ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger screens_touch before update on public.screens
  for each row execute function public.touch_updated_at();
create trigger school_touch before update on public.school_settings
  for each row execute function public.touch_updated_at();

-- أي منشور جديد يحدّث updated_at للشاشة (يُستخدم كمفتاح للتخزين المؤقت على التلفزيون)
create or replace function public.bump_screen_on_post()
returns trigger language plpgsql as $$
begin
  update public.screens set updated_at = now() where id = coalesce(new.screen_id, old.screen_id);
  return coalesce(new, old);
end $$;
create trigger posts_bump after insert or delete on public.posts
  for each row execute function public.bump_screen_on_post();

-- ============================================================
-- RLS
-- ============================================================
alter table public.school_settings enable row level security;
alter table public.screens         enable row level security;
alter table public.screen_devices  enable row level security;
alter table public.posts           enable row level security;
alter table public.presets         enable row level security;

-- المسؤول (أي مستخدم مسجّل) : صلاحية كاملة
create policy "admin all" on public.school_settings for all to authenticated using (true) with check (true);
create policy "admin all" on public.screens         for all to authenticated using (true) with check (true);
create policy "admin all" on public.screen_devices  for all to authenticated using (true) with check (true);
create policy "admin all" on public.posts           for all to authenticated using (true) with check (true);
create policy "admin all" on public.presets         for all to authenticated using (true) with check (true);

-- anon : لا شيء مباشرة. التلفزيون يستخدم الدوال أدناه فقط.

-- ============================================================
-- دوال التلفزيون (security definer — تعمل رغم RLS)
-- ============================================================

-- 1) التلفزيون يطلب رمز ربط
create or replace function public.request_pairing()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_token text;
  i int := 0;
begin
  -- تنظيف الرموز القديمة غير المربوطة (أقدم من ساعة)
  delete from screen_devices where screen_id is null and created_at < now() - interval '1 hour';
  loop
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    begin
      insert into screen_devices (code) values (v_code) returning token into v_token;
      exit;
    exception when unique_violation then
      i := i + 1; if i > 20 then raise exception 'تعذّر توليد رمز. حاول مرة أخرى.'; end if;
    end;
  end loop;
  return json_build_object('code', v_code, 'token', v_token);
end $$;
revoke all on function public.request_pairing() from public;
grant execute on function public.request_pairing() to anon, authenticated;

-- 2) المسؤول يربط الرمز بشاشة
create or replace function public.pair_screen(p_code text, p_screen_id uuid, p_label text default null)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  update screen_devices
     set screen_id = p_screen_id, paired_at = now(), label = coalesce(p_label, label)
   where code = p_code and screen_id is null and created_at > now() - interval '1 hour';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'الرمز غير موجود أو انتهت صلاحيته. افتح صفحة التلفزيون من جديد.'; end if;
end $$;
revoke all on function public.pair_screen(text, uuid, text) from public;
grant execute on function public.pair_screen(text, uuid, text) to authenticated;

-- 3) التلفزيون يقرأ شاشته (ويسجّل آخر ظهور)
create or replace function public.get_screen_by_token(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare
  d screen_devices%rowtype;
  s screens%rowtype;
  p posts%rowtype;
  sch school_settings%rowtype;
begin
  select * into d from screen_devices where token = p_token;
  if not found then return json_build_object('status', 'unknown'); end if;
  update screen_devices set last_seen_at = now() where token = p_token;
  if d.screen_id is null then return json_build_object('status', 'pending', 'code', d.code); end if;

  select * into s from screens where id = d.screen_id;
  select * into sch from school_settings where id = 1;
  select * into p from posts
   where screen_id = s.id and publish_at <= riyadh_today()
   order by publish_at desc, created_at desc limit 1;

  return json_build_object(
    'status', 'paired',
    'screen', json_build_object('id', s.id, 'name', s.name, 'template', s.template, 'updated_at', s.updated_at),
    'school', json_build_object('name', sch.name, 'tagline', sch.tagline, 'logo_url', sch.logo_url),
    'post',   case when p.id is null then null else json_build_object('id', p.id, 'content', p.content, 'publish_at', p.publish_at, 'created_at', p.created_at) end,
    'version', coalesce(p.created_at, s.updated_at)::text || ':' || s.updated_at::text
  );
end $$;
revoke all on function public.get_screen_by_token(text) from public;
grant execute on function public.get_screen_by_token(text) to anon, authenticated;

-- 4) للمسؤول: المحتوى الفعّال لشاشة (نفس منطق التلفزيون)
create or replace function public.effective_post(p_screen_id uuid)
returns setof public.posts language sql stable security invoker as $$
  select * from public.posts
   where screen_id = p_screen_id and publish_at <= public.riyadh_today()
   order by publish_at desc, created_at desc limit 1
$$;

-- ============================================================
-- التخزين: حاوية الصور
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "media public read"   on storage.objects for select to public        using (bucket_id = 'media');
create policy "media admin insert"  on storage.objects for insert to authenticated with check (bucket_id = 'media');
create policy "media admin update"  on storage.objects for update to authenticated using (bucket_id = 'media');
create policy "media admin delete"  on storage.objects for delete to authenticated using (bucket_id = 'media');
