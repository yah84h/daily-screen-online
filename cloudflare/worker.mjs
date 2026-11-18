import { onRequest as driveVideo } from '../functions/api/drive-video.js';
import { exposeEnv, functionFor, runFunction } from './functions.mjs';

/** Cloudflare Workers entry (wrangler.worker.jsonc). Cloudflare Pages uses functions/_middleware.js. */
export default {
  async fetch(request, env) {
    exposeEnv(env);
    const { pathname } = new URL(request.url);
    if (pathname === '/api/drive-video') return driveVideo({ request });
    const handler = functionFor(pathname);
    if (handler) return runFunction(handler, request);
    return env.ASSETS.fetch(request);
  },
};
