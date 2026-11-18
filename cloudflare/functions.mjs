import { handler as mediaControl } from '../netlify/functions/media-control.mjs';
import { handler as presentationControl } from '../netlify/functions/presentation-control.mjs';
import { handler as qudratPro } from '../netlify/functions/qudrat-pro.mjs';
import { handler as qudratSource } from '../netlify/functions/qudrat-source.mjs';
import { handler as staffLogin } from '../netlify/functions/staff-login.mjs';
import { handler as staffPassword } from '../netlify/functions/staff-password.mjs';
import { handler as staff } from '../netlify/functions/staff.mjs';
import { handler as techNews } from '../netlify/functions/tech-news.mjs';
import { handler as turn } from '../netlify/functions/turn.mjs';

/** The Netlify functions, served unchanged on Cloudflare (Workers or Pages) through a small adapter. */
const handlers = {
  'media-control': mediaControl,
  'presentation-control': presentationControl,
  'qudrat-pro': qudratPro,
  'qudrat-source': qudratSource,
  'staff-login': staffLogin,
  'staff-password': staffPassword,
  staff,
  'tech-news': techNews,
  turn,
};
// Same public aliases as netlify.toml.
const aliases = {
  '/api/tech-news': 'tech-news',
  '/api/qudrat-pro': 'qudrat-pro',
  '/api/qudrat-source': 'qudrat-source',
};

/** Shared code reads secrets from process.env; works with or without nodejs_compat. */
export function exposeEnv(env) {
  globalThis.process ??= { env: {} };
  globalThis.process.env ??= {};
  for (const [key, value] of Object.entries(env || {}))
    if (typeof value === 'string') globalThis.process.env[key] = value;
}

export function functionFor(pathname) {
  const name = aliases[pathname] || pathname.match(/^\/\.netlify\/functions\/([a-z-]+)$/)?.[1];
  return name && handlers[name] ? handlers[name] : null;
}

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
  const body = result.isBase64Encoded
    ? Uint8Array.from(atob(result.body || ''), (c) => c.charCodeAt(0))
    : (result.body ?? null);
  return new Response(body, { status: result.statusCode || 200, headers: result.headers || {} });
}

export async function runFunction(handler, request) {
  try {
    return await runNetlifyHandler(handler, request);
  } catch (error) {
    return Response.json(
      { error: { message: error?.message || 'Server error' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
