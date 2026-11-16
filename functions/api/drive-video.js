import { driveVideoResponse } from '../../local-test/drive-video.mjs';
/** Cloudflare Pages counterpart of the Netlify proxy; preserves bounded byte ranges. */
export async function onRequest({ request }) {
  try {
    return await driveVideoResponse(request);
  } catch (error) {
    return Response.json(
      { error: error.code || 'DRIVE_UNAVAILABLE' },
      {
        status: error.status || 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
