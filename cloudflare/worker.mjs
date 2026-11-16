import { onRequest } from '../functions/api/drive-video.js';
/** Optional Workers Static Assets deployment; Pages uses functions/api directly. */
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/drive-video') return onRequest({ request });
    return env.ASSETS.fetch(request);
  },
};
