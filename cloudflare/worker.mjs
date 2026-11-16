import process from 'node:process';
import { onRequest as driveVideo } from '../functions/api/drive-video.js';
import { handler as mediaControl } from '../netlify/functions/media-control.mjs';
import { handler as presentationControl } from '../netlify/functions/presentation-control.mjs';
import { handler as qudratPro } from '../netlify/functions/qudrat-pro.mjs';
import { handler as qudratSource } from '../netlify/functions/qudrat-source.mjs';
import { handler as staffLogin } from '../netlify/functions/staff-login.mjs';
import { handler as staffPassword } from '../netlify/functions/staff-password.mjs';
import { handler as staff } from '../netlify/functions/staff.mjs';
import { handler as techNews } from '../netlify/functions/tech-news.mjs';

/** The Netlify functions, served unchanged on Cloudflare Workers through a small event adapter. */
const handlers = {
  'media-control': mediaControl,
  'presentation-control': presentationControl,
  'qudrat-pro': qudratPro,
  'qudrat-source': qudratSource,
  'staff-login': staffLogin,
  'staff-password': staffPassword,
  staff,
  'tech-news': techNews,
};
// Same public aliases as netlify.toml.
const aliases = {
  '/api/tech-news': 'tech-news',
  '/api/qudrat-pro': 'qudrat-pro',
  '/api/qudrat-source': 'qudrat-source',
};

async function runNetlifyHandler(handler, request) {
  const url = new URL(request.url);
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const event = {
    httpMethod: request.method,
    path: url.pathname,
    rawUrl: request.url,
    headers: Object.fromEntries(request.headers), // lower-cased, like Netlify
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: hasBody ? await request.text() : null,
    isBase64Encoded: false,
  };
  const result = (await handler(event, {})) || {};
  return new Response(result.isBase64Encoded ? atob(result.body || '') : (result.body ?? null), {
    status: result.statusCode || 200,
    headers: result.headers || {},
  });
}

export default {
  async fetch(request, env) {
    // Secrets/vars from the Cloudflare dashboard → process.env, where the shared code reads them.
    for (const [key, value] of Object.entries(env))
      if (typeof value === 'string') process.env[key] = value;
    const { pathname } = new URL(request.url);
    if (pathname === '/api/drive-video') return driveVideo({ request });
    const name = aliases[pathname] || pathname.match(/^\/\.netlify\/functions\/([a-z-]+)$/)?.[1];
    if (name && handlers[name]) {
      try {
        return await runNetlifyHandler(handlers[name], request);
      } catch (error) {
        return Response.json(
          { error: { message: error?.message || 'Server error' } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    }
    return env.ASSETS.fetch(request);
  },
};
