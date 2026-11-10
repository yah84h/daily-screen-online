import { fetchQudratLeaderboard } from '../../local-test/qudrat-pro.mjs';
import { savedSource } from '../lib/qudrat-source.mjs';
export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (event.httpMethod !== 'GET')
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  // The link saved from the admin panel wins; the environment variable stays as a fallback.
  try {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(
        await fetchQudratLeaderboard({ url: (await savedSource()) || undefined }),
      ),
    };
  } catch (error) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: error.code === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'UPSTREAM_UNAVAILABLE',
      }),
    };
  }
}
