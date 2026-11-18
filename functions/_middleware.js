import { exposeEnv, functionFor, runFunction } from '../cloudflare/functions.mjs';

/** Cloudflare Pages: serve the Netlify functions (/.netlify/functions/*, /api aliases).
 * Without this, Pages answered them with the SPA's index.html (or an empty 405 for POST),
 * which the app reported as "Unexpected end of JSON input". */
export async function onRequest(context) {
  const handler = functionFor(new URL(context.request.url).pathname);
  if (!handler) return context.next();
  exposeEnv(context.env);
  return runFunction(handler, context.request);
}
