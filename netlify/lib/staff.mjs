import { createClient } from '@supabase/supabase-js';
export const ownerUsername = 'Archo';
export const response = (status, data) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(data),
});
export function clients() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY,
    anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  // Name only the missing variables (never their values), so the admin knows exactly what to fix.
  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !key && 'SUPABASE_SERVICE_ROLE_KEY',
    !anon && 'VITE_SUPABASE_ANON_KEY',
  ].filter(Boolean);
  if (missing.length)
    throw Error(
      'وظائف Netlify لا ترى المتغير: ' +
        missing.join('، ') +
        '. فعّل له نطاق Functions ثم أعد النشر.',
    );
  return {
    admin: createClient(url, key, { auth: { persistSession: false } }),
    anon: createClient(url, anon, { auth: { persistSession: false } }),
  };
}
export const cleanPermissions = (p) => ({
  admin: p?.admin === true,
  news: p?.admin === true || p?.news === true,
  daily: p?.admin === true || p?.daily === true,
});
export async function requireAdmin(event, admin) {
  const token = (event.headers.authorization || '').replace(/^Bearer /i, '');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Error('تسجيل الدخول مطلوب');
  const { data: profile } = await admin
    .from('staff_profiles')
    .select('*')
    .eq('user_id', data.user.id)
    .single();
  if (!profile?.active || profile.permissions?.admin !== true)
    throw Error('لا تملك صلاحية إدارة الحسابات');
  return profile;
}
