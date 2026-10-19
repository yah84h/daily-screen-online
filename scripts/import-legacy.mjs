// ترحيل بيانات النسخة المحلية (data/state.json + data/uploads) إلى Supabase
// الاستخدام:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/import-legacy.mjs /path/to/Daily-Screen-Arabic-v6
// يحتاج مفتاح service_role (من Project Settings → API) ولا يُستخدم في المتصفح أبدًا.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const [, , legacyDir] = process.argv;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!legacyDir || !url || !key) {
  console.error('الاستخدام: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-legacy.mjs <مجلد النسخة المحلية>');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const state = JSON.parse(fs.readFileSync(path.join(legacyDir, 'data', 'state.json'), 'utf8'));
const uploadsDir = path.join(legacyDir, 'data', 'uploads');
const MEDIA_KEYS = ['image', 'secondary', 'qr', 'logo', 'backgroundImage'];
const uploaded = new Map();

async function migrateMedia(value) {
  if (typeof value !== 'string' || !value) return value;
  let p = value;
  try {
    const u = new URL(value);
    p = u.pathname;
  } catch {}
  if (p === '/workspace.jpg') return '/workspace.jpg';
  if (!p.startsWith('/uploads/')) return value;
  const name = p.slice('/uploads/'.length);
  if (uploaded.has(name)) return uploaded.get(name);
  const file = path.join(uploadsDir, name);
  if (!fs.existsSync(file)) {
    console.warn('صورة مفقودة:', name);
    return '';
  }
  const bytes = fs.readFileSync(file);
  if (bytes.length > 5 * 1024 * 1024) {
    console.warn(`الصورة ${name} أكبر من 5MB (${(bytes.length / 1e6).toFixed(1)}MB) — ارفعها من اللوحة ليُضغط حجمها.`);
    uploaded.set(name, '');
    return '';
  }
  const ext = path.extname(name).slice(1).toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const dest = `legacy/${name}`;
  const { error } = await sb.storage.from('media').upload(dest, bytes, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  const publicUrl = sb.storage.from('media').getPublicUrl(dest).data.publicUrl;
  uploaded.set(name, publicUrl);
  console.log('رُفعت:', name);
  return publicUrl;
}

async function migrateContent(c) {
  if (!c) return c;
  const out = { ...c };
  delete out.date;
  out.autoDate = c.autoDate ?? true;
  for (const k of MEDIA_KEYS) if (k in out) out[k] = await migrateMedia(out[k]);
  return out;
}

const { data: screens, error: se } = await sb.from('screens').select('id').order('created_at').limit(1);
if (se) throw se;
const screenId = screens?.[0]?.id;
if (!screenId) throw Error('لا توجد شاشة. شغّل 0002_seed.sql أولًا.');

// القالب والمسودة
const template = { ...state.template };
if (template.backgroundImage) template.backgroundImage = await migrateMedia(template.backgroundImage);
const draft = await migrateContent(state.draft);
{
  const { error } = await sb.from('screens').update({ template, draft }).eq('id', screenId);
  if (error) throw error;
  console.log('القالب والمسودة: تم');
}

// المواضيع (نستبدل البذور بمواضيعك)
{
  await sb.from('presets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const rows = [];
  for (const [i, p] of (state.presets || []).entries()) rows.push({ name: p.name, content: await migrateContent(p.content), sort_order: i });
  const { error } = await sb.from('presets').insert(rows);
  if (error) throw error;
  console.log('المواضيع:', rows.length);
}

// السجل → منشورات بتواريخها الأصلية (الأحدث هو المعروض الآن)
{
  const rows = [];
  for (const h of (state.history || []).slice().reverse()) {
    rows.push({ screen_id: screenId, content: await migrateContent(h.content), publish_at: new Date(h.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }), created_at: h.createdAt });
  }
  if (rows.length) {
    const { error } = await sb.from('posts').insert(rows);
    if (error) throw error;
  }
  console.log('السجل:', rows.length);
}

// الجدولة
{
  const rows = [];
  for (const s of state.schedule || []) rows.push({ screen_id: screenId, content: await migrateContent(s.content), publish_at: s.date });
  if (rows.length) {
    const { error } = await sb.from('posts').insert(rows);
    if (error) throw error;
  }
  console.log('الجدولة:', rows.length);
}

console.log('\nاكتمل الترحيل.');
