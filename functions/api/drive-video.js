import { driveVideoResponse } from '../../local-test/drive-video.mjs';
/** Cloudflare counterpart of the Netlify proxy; preserves bounded byte ranges.
 * Cloudflare's edge swaps a Worker's 502 body for a plain "error code: 502" page, which hides
 * the JSON error code the player needs, so upstream failures are reported as 424 instead. */
export async function onRequest({ request }) {
  try {
    return await driveVideoResponse(request);
  } catch (error) {
    return Response.json(
      { error: error.code || 'DRIVE_UNAVAILABLE' },
      {
        status: !error.status || error.status === 502 ? 424 : error.status,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
