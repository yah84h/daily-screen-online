import { supabase } from './supabase';
import { riyadhToday, type Content, type Device, type Post, type Preset, type School, type Screen, type Template, type TvState } from './types';

const fail = (e: { message: string } | null, fallback = 'تعذّر الحفظ. حاول مرة أخرى.') => {
  if (e) throw Error(e.message || fallback);
};

// ---------- بث التحديث الفوري (Realtime Broadcast) ----------
const channels = new Map<string, ReturnType<typeof supabase.channel>>();
export const screenChannel = (screenId: string) => {
  let ch = channels.get(screenId);
  if (!ch) {
    ch = supabase.channel(`screen:${screenId}`, { config: { broadcast: { self: false } } });
    channels.set(screenId, ch);
  }
  return ch;
};
export async function notifyScreen(screenId: string) {
  const ch = screenChannel(screenId);
  if (ch.state !== 'joined') await new Promise<void>((resolve) => ch.subscribe((s) => s === 'SUBSCRIBED' && resolve()));
  await ch.send({ type: 'broadcast', event: 'update', payload: { at: Date.now() } });
}

// ---------- قراءة لوحة الإدارة ----------
export type AdminData = {
  school: School;
  screen: Screen;
  current: Post | null;
  history: Post[];
  schedule: Post[];
  presets: Preset[];
  devices: Device[];
};

export async function loadAdmin(): Promise<AdminData> {
  const today = riyadhToday();
  const [school, screens, presets] = await Promise.all([
    supabase.from('school_settings').select('name,tagline,logo_url').eq('id', 1).single(),
    supabase.from('screens').select('*').order('created_at').limit(1),
    supabase.from('presets').select('*').order('sort_order').order('created_at'),
  ]);
  fail(school.error, 'تعذّر تحميل إعدادات المدرسة');
  fail(screens.error, 'تعذّر تحميل الشاشة');
  fail(presets.error);
  const screen = screens.data?.[0] as Screen | undefined;
  if (!screen) throw Error('لا توجد شاشة. شغّل ملف البذور 0002_seed.sql.');

  const [history, schedule, devices] = await Promise.all([
    supabase.from('posts').select('*').eq('screen_id', screen.id).lte('publish_at', today).order('publish_at', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    supabase.from('posts').select('*').eq('screen_id', screen.id).gt('publish_at', today).order('publish_at'),
    supabase.from('screen_devices').select('*').eq('screen_id', screen.id).order('paired_at'),
  ]);
  fail(history.error);
  fail(schedule.error);
  fail(devices.error);
  return {
    school: school.data as School,
    screen,
    current: (history.data?.[0] as Post) || null,
    history: (history.data || []) as Post[],
    schedule: (schedule.data || []) as Post[],
    presets: (presets.data || []) as Preset[],
    devices: (devices.data || []) as Device[],
  };
}

// ---------- الإجراءات ----------
export async function publish(screenId: string, content: Content, template: Partial<Template>) {
  if (!content.title?.trim()) throw Error('أضف عنوانًا أولًا.');
  const { data: user } = await supabase.auth.getUser();
  const post = await supabase.from('posts').insert({ screen_id: screenId, content, publish_at: riyadhToday(), created_by: user.user?.id }).select().single();
  fail(post.error);
  fail((await supabase.from('screens').update({ template, draft: null }).eq('id', screenId)).error);
  await notifyScreen(screenId);
  return post.data as Post;
}

export async function saveDraft(screenId: string, content: Content) {
  fail((await supabase.from('screens').update({ draft: content }).eq('id', screenId)).error);
}

export async function saveTemplate(screenId: string, template: Partial<Template>) {
  fail((await supabase.from('screens').update({ template }).eq('id', screenId)).error);
  await notifyScreen(screenId);
}

export async function schedulePost(screenId: string, content: Content, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < riyadhToday()) throw Error('اختر اليوم أو تاريخًا قادمًا.');
  if (!content.title?.trim()) throw Error('أضف عنوانًا أولًا.');
  const { data: user } = await supabase.auth.getUser();
  fail((await supabase.from('posts').insert({ screen_id: screenId, content, publish_at: date, created_by: user.user?.id })).error);
  if (date === riyadhToday()) await notifyScreen(screenId);
}

export async function deletePost(id: string, screenId: string) {
  fail((await supabase.from('posts').delete().eq('id', id)).error);
  await notifyScreen(screenId);
}

export async function savePreset(name: string, content: Content, id?: string | null) {
  const clean = name.trim().slice(0, 100);
  if (!clean) throw Error('أدخل اسم الموضوع.');
  if (id) fail((await supabase.from('presets').update({ name: clean, content }).eq('id', id)).error);
  else fail((await supabase.from('presets').insert({ name: clean, content })).error);
}

export async function deletePreset(id: string) {
  fail((await supabase.from('presets').delete().eq('id', id)).error);
}

export async function saveSchool(patch: Partial<School>) {
  fail((await supabase.from('school_settings').update(patch).eq('id', 1)).error);
}

export async function pairDevice(code: string, screenId: string, label?: string) {
  const { error } = await supabase.rpc('pair_screen', { p_code: code, p_screen_id: screenId, p_label: label ?? null });
  fail(error);
  await notifyScreen(screenId);
}

export async function unpairDevice(token: string) {
  fail((await supabase.from('screen_devices').delete().eq('token', token)).error);
}

// ---------- التلفزيون ----------
export async function requestPairing(): Promise<{ code: string; token: string }> {
  const { data, error } = await supabase.rpc('request_pairing');
  fail(error, 'تعذّر الاتصال بالخادم.');
  return data as { code: string; token: string };
}

export async function fetchTv(token: string): Promise<TvState> {
  const { data, error } = await supabase.rpc('get_screen_by_token', { p_token: token });
  fail(error, 'تعذّر الاتصال بالخادم.');
  return data as TvState;
}
