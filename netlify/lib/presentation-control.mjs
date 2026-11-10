import { presentationStep } from '../../local-test/presentation-state.mjs';
const fail = (message, status) => Object.assign(Error(message), { status });
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
export function createPresentationHandler(getClients) {
  return async (event) => {
    try {
      if (event.httpMethod !== 'POST')
        return json(405, { error: { message: 'Method not allowed' } });
      if ((event.body || '').length > 4096) throw fail('الطلب كبير جدًا', 400);
      let input;
      try {
        input = JSON.parse(event.body || '{}');
      } catch {
        throw fail('طلب غير صالح', 400);
      }
      if (!input.screen || !input.deck) throw fail('حدد الشاشة والعرض', 400);
      const { admin, anon } = getClients();
      if (input.token) {
        const result = await anon.rpc('get_screen_by_token', { p_token: String(input.token) });
        if (
          result.error ||
          result.data?.status !== 'paired' ||
          result.data.screen.id !== input.screen
        )
          throw fail('رمز جهاز العرض غير صالح', 403);
      } else {
        const bearer = (event.headers?.authorization || event.headers?.Authorization || '').replace(
          /^Bearer /i,
          '',
        );
        const auth = await admin.auth.getUser(bearer);
        if (auth.error || !auth.data.user) throw fail('تسجيل الدخول مطلوب', 401);
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
          throw fail('صلاحية المحتوى مطلوبة', 403);
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        const screen = await admin
          .from('screens')
          .select('id,template')
          .eq('id', input.screen)
          .single();
        if (screen.error) throw fail('الشاشة غير موجودة', 404);
        const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
        const selected = await admin
          .from('posts')
          .select('id,content')
          .eq('screen_id', input.screen)
          .lte('publish_at', day)
          .order('publish_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (selected.error) throw fail('تعذر قراءة العرض', 502);
        const post = selected.data,
          deck = post?.content?.presentation;
        if (
          screen.data.template?.displayMode !== 'presentation' ||
          deck?.id !== input.deck ||
          !deck.slides?.length
        )
          throw fail('انشر هذا العرض على الشاشة أولًا.', 409);
        const raw = post.content.presentationPlayback,
          revision = Number.isSafeInteger(raw?.revision) ? raw.revision : 0;
        const current =
          raw?.deck === deck.id
            ? {
                slide: Math.max(0, Math.min(deck.slides.length - 1, Number(raw.slide) || 0)),
                black: raw.black === true,
              }
            : { slide: 0, black: false };
        if (input.action === 'state')
          return json(200, { ...current, deck: deck.id, count: deck.slides.length, revision });
        const next = {
          ...presentationStep(current, input.action, deck.slides.length, input.index, input.black),
          deck: deck.id,
          revision: revision + 1,
        };
        let update = admin
          .from('posts')
          .update({ content: { ...post.content, presentationPlayback: next } })
          .eq('id', post.id);
        update =
          raw?.revision == null
            ? update.is('content->presentationPlayback->>revision', null)
            : update.eq('content->presentationPlayback->>revision', String(raw.revision));
        const saved = await update.select('id');
        if (saved.error) throw fail('تعذر حفظ موضع العرض', 502);
        if (saved.data?.length)
          return json(200, {
            slide: next.slide,
            black: next.black,
            deck: deck.id,
            count: deck.slides.length,
            revision: next.revision,
          });
      }
      throw fail('حاول مجددًا؛ تغيّر العرض أثناء التنقل.', 409);
    } catch (error) {
      return json(error.status || 503, {
        error: { message: error.message || 'تعذر التحكم بالعرض' },
      });
    }
  };
}
