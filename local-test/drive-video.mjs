export const DRIVE_CHUNK = 4 * 1024 * 1024;
const fileId = /^[A-Za-z0-9_-]{10,200}$/;
export function parseDriveLink(input) {
  try {
    const u = new URL(input);
    if (
      u.protocol !== 'https:' ||
      u.hostname !== 'drive.google.com' ||
      u.username ||
      u.password ||
      u.port
    )
      return null;
    const id =
      u.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ||
      (['/open', '/uc'].includes(u.pathname) ? u.searchParams.get('id') : null);
    const resourcekey = u.searchParams.get('resourcekey') || '';
    if (!id || !fileId.test(id) || (resourcekey && !/^[A-Za-z0-9_-]{1,200}$/.test(resourcekey)))
      return null;
    return {
      id,
      resourcekey,
      url:
        `https://drive.google.com/file/d/${id}/view` +
        (resourcekey ? '?resourcekey=' + encodeURIComponent(resourcekey) : ''),
    };
  } catch {
    return null;
  }
}
function fail(code, status = 502) {
  throw Object.assign(Error(code), { code, status });
}
export async function driveVideoResponse(request, { fetcher = fetch } = {}) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id'),
    key = url.searchParams.get('resourcekey') || '';
  if (!id || !fileId.test(id) || (key && !/^[A-Za-z0-9_-]{1,200}$/.test(key)))
    fail('INVALID_DRIVE_LINK', 400);
  if (!['GET', 'HEAD'].includes(request.method)) fail('METHOD_NOT_ALLOWED', 405);
  const range = request.headers.get('range') || 'bytes=0-';
  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) fail('INVALID_RANGE', 416);
  const start = Number(match[1]),
    requestedEnd = match[2] ? Number(match[2]) : start + DRIVE_CHUNK - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start)
    fail('INVALID_RANGE', 416);
  const end = Math.min(requestedEnd, start + DRIVE_CHUNK - 1);
  let target = new URL('https://drive.usercontent.google.com/download');
  target.searchParams.set('id', id);
  target.searchParams.set('export', 'download');
  target.searchParams.set('confirm', 't');
  if (key) target.searchParams.set('resourcekey', key);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
  let upstream;
  for (let i = 0; i < 6; i++) {
    if (
      target.protocol !== 'https:' ||
      target.port ||
      target.username ||
      target.password ||
      !(
        ['drive.google.com', 'drive.usercontent.google.com'].includes(target.hostname) ||
        target.hostname.endsWith('.googleusercontent.com')
      )
    )
      fail('DRIVE_REDIRECT_REJECTED');
    upstream = await fetcher(target, {
      redirect: 'manual',
      signal,
      headers: { Range: `bytes=${start}-${end}`, 'Accept-Encoding': 'identity' },
      method: 'GET',
    });
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      await upstream.body?.cancel();
      if (!location) fail('DRIVE_UNAVAILABLE');
      target = new URL(location, target);
      continue;
    }
    break;
  }
  if (!upstream || [301, 302, 303, 307, 308].includes(upstream.status)) fail('DRIVE_UNAVAILABLE');
  if (upstream.status === 416) {
    const cr = upstream.headers.get('content-range');
    await upstream.body?.cancel();
    return new Response(null, { status: 416, headers: cr ? { 'Content-Range': cr } : {} });
  }
  const mime = (upstream.headers.get('content-type') || '').split(';')[0].toLowerCase(),
    audio = url.searchParams.get('audio') === '1';
  if (
    !upstream.ok ||
    !(
      audio
        ? [
            'audio/mpeg',
            'audio/mp3',
            'audio/mp4',
            'audio/x-m4a',
            'audio/wav',
            'audio/x-wav',
            'audio/ogg',
            'audio/webm',
            'audio/flac',
            'application/ogg',
            'application/octet-stream',
          ]
        : ['video/mp4', 'video/webm', 'video/quicktime', 'application/octet-stream']
    ).includes(mime)
  ) {
    await upstream.body?.cancel();
    fail(
      upstream.status === 429 ? 'DRIVE_QUOTA' : 'DRIVE_NOT_PUBLIC',
      upstream.status === 429 ? 429 : 502,
    );
  }
  const cr = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(upstream.headers.get('content-range') || '');
  if (
    upstream.status !== 206 ||
    !cr ||
    Number(cr[1]) !== start ||
    Number(cr[2]) > end ||
    Number(cr[2]) < start ||
    Number(cr[3]) <= Number(cr[2])
  ) {
    await upstream.body?.cancel();
    fail('DRIVE_RANGE_UNAVAILABLE');
  }
  const length = Number(cr[2]) - start + 1;
  const headers = {
    'Content-Type':
      mime === 'application/octet-stream' ? (audio ? 'audio/mpeg' : 'video/mp4') : mime,
    'Content-Range': upstream.headers.get('content-range'),
    'Content-Length': String(length),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (request.method === 'HEAD') {
    await upstream.body?.cancel();
    return new Response(null, { status: 206, headers });
  }
  // Bound every response even if an upstream server sends more than its announced range.
  let count = 0;
  const limited = new TransformStream({
    transform(chunk, controller) {
      count += chunk.byteLength;
      if (count > length) throw Error('DRIVE_LENGTH_MISMATCH');
      controller.enqueue(chunk);
    },
    flush() {
      if (count !== length) throw Error('DRIVE_LENGTH_MISMATCH');
    },
  });
  return new Response(upstream.body.pipeThrough(limited), { status: 206, headers });
}
