import { mediaControlStep, playbackState } from '../../local-test/media-control-state.mjs';
const fail = (message, status) => Object.assign(Error(message), { status });
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
export function createMediaControlHandler(getClients) {
  return async (event) => {
    try {
      if (event.httpMethod !== 'POST')
        return json(405, { error: { message: 'Method not allowed' } });
      if ((event.body || '').length > 8192) throw fail('الطلب كبير جدًا.', 400);
      let input;
      try {
        input = JSON.parse(event.body || '{}');
      } catch {
        throw fail('طلب غير صالح.', 400);
      }
      if (!input.screen) throw fail('حدد الشاشة.', 400);
      const { admin, anon } = getClients();
      let device = null;
      if (input.token) {
        const paired = await anon.rpc('get_screen_by_token', { p_token: String(input.token) });
        if (
          paired.error ||
          paired.data?.status !== 'paired' ||
          paired.data.screen.id !== input.screen
        )
          throw fail('رمز جهاز العرض غير صالح.', 403);
        const selected = await admin
          .from('screen_devices')
          .select('id,label')
          .eq('token', input.token)
          .eq('screen_id', input.screen)
          .single();
        if (selected.error || !selected.data) throw fail('جهاز العرض غير مرتبط.', 403);
        device = selected.data;
      } else {
        const bearer = (event.headers?.authorization || event.headers?.Authorization || '').replace(
          /^Bearer /i,
          '',
        );
        const auth = await admin.auth.getUser(bearer);
        if (auth.error || !auth.data.user) throw fail('تسجيل الدخول مطلوب.', 401);
        const profile = await admin
          .from('staff_profiles')
          .select('active,permissions,must_change_password')
          .eq('user_id', auth.data.user.id)
          .single();
        if (
          profile.error ||
          !profile.data?.active ||
          profile.data.must_change_password ||
          !(profile.data.permissions?.daily || profile.data.permissions?.admin)
        )
          throw fail('صلاحية المحتوى مطلوبة.', 403);
      }
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
      for (let attempt = 0; attempt < 4; attempt++) {
        const selected = await admin
          .from('posts')
          .select('id,content')
          .eq('screen_id', input.screen)
          .lte('publish_at', day)
          .order('publish_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (selected.error) throw fail('تعذر قراءة الشاشة.', 502);
        const post = selected.data;
        if (!post) throw fail('انشر محتوى على الشاشة أولًا.', 409);
        const raw = post.content.mediaPlayback;
        let previous = raw;
        if (!previous) {
          const history = await admin
            .from('posts')
            .select('content')
            .eq('screen_id', input.screen)
            .lte('publish_at', day)
            .not('content->mediaPlayback', 'is', null)
            .order('publish_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (history.error) throw fail('تعذر قراءة إعدادات التشغيل.', 502);
          previous = history.data?.content?.mediaPlayback;
        }
        if (!device && input.action === 'state' && input.watch) input.action = 'watch';
        if (input.action === 'state') return json(200, playbackState(previous));
        const next = mediaControlStep(previous, input, device);
        let update = admin
          .from('posts')
          .update({ content: { ...post.content, mediaPlayback: next } })
          .eq('id', post.id);
        update =
          raw?.revision == null
            ? update.is('content->mediaPlayback->>revision', null)
            : update.eq('content->mediaPlayback->>revision', String(raw.revision));
        const saved = await update.select('id');
        if (saved.error) throw fail('تعذر حفظ أمر التشغيل.', 502);
        if (saved.data?.length) return json(200, next);
      }
      throw fail('تغيرت الشاشة أثناء التحكم؛ أعد المحاولة.', 409);
    } catch (error) {
      return json(error.status || 503, {
        error: { message: error.message || 'تعذر التحكم بالوسائط.' },
      });
    }
  };
}
