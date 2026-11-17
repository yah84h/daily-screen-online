/**
 * Presenting mode: short-lived TURN credentials so a phone on 4G can still send files to a TV
 * on the school Wi-Fi. TURN only relays the encrypted WebRTC stream; nothing is stored.
 * Uses Cloudflare Realtime TURN when TURN_KEY_ID + TURN_KEY_API_TOKEN are set; otherwise
 * returns STUN only (same Wi-Fi still works).
 */
const STUN = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
const fail = (message, status) => Object.assign(Error(message), { status });

export function createTurnHandler(getClients, { fetcher = fetch, env = process.env } = {}) {
  return async (event) => {
    try {
      if (event.httpMethod !== 'POST')
        return json(405, { error: { message: 'Method not allowed' } });
      if ((event.body || '').length > 2048) throw fail('الطلب كبير جدًا', 400);
      let input;
      try {
        input = JSON.parse(event.body || '{}');
      } catch {
        throw fail('طلب غير صالح', 400);
      }
      const { admin, anon } = getClients();
      if (input.token) {
        // A paired TV.
        const paired = await anon.rpc('get_screen_by_token', { p_token: String(input.token) });
        if (paired.error || paired.data?.status !== 'paired')
          throw fail('رمز جهاز العرض غير صالح', 403);
      } else {
        // A signed-in staff member's phone.
        const bearer = (event.headers?.authorization || '').replace(/^Bearer /i, '');
        const auth = await admin.auth.getUser(bearer);
        if (auth.error || !auth.data.user) throw fail('تسجيل الدخول مطلوب', 401);
        const profile = await admin
          .from('staff_profiles')
          .select('active,permissions')
          .eq('user_id', auth.data.user.id)
          .single();
        if (
          profile.error ||
          !profile.data?.active ||
          !(profile.data.permissions?.daily || profile.data.permissions?.admin)
        )
          throw fail('صلاحية المحتوى مطلوبة', 403);
      }
      const id = env.TURN_KEY_ID,
        key = env.TURN_KEY_API_TOKEN;
      if (!id || !key) return json(200, { iceServers: STUN, relay: false });
      const response = await fetcher(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: 6 * 60 * 60 }),
        },
      );
      if (!response.ok) return json(200, { iceServers: STUN, relay: false });
      const data = await response.json();
      const servers = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
      const clean = servers
        .filter((server) => server && server.urls)
        .map(({ urls, username, credential }) => ({ urls, username, credential }));
      return json(200, { iceServers: clean.length ? clean : STUN, relay: clean.length > 0 });
    } catch (error) {
      return json(error.status || 503, { error: { message: error.message || 'تعذر الاتصال' } });
    }
  };
}
