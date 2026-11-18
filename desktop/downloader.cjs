// Downloads TV media (Google Drive links or direct URLs) to disk, once, and remembers them.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

/** Google Drive id + resourcekey from a share link or the site's /api/drive-video proxy URL. */
function driveTarget(input, base) {
  let u;
  try {
    u = new URL(input, base);
  } catch {
    return null;
  }
  let id = null;
  if (u.hostname === 'drive.google.com')
    id =
      u.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)/)?.[1] ||
      (['/open', '/uc'].includes(u.pathname) ? u.searchParams.get('id') : null);
  else if (u.pathname === '/api/drive-video') id = u.searchParams.get('id');
  if (!id || !DRIVE_ID.test(id)) return null;
  return { id, resourcekey: u.searchParams.get('resourcekey') || '' };
}

function driveDownloadURL({ id, resourcekey }) {
  const t = new URL('https://drive.usercontent.google.com/download');
  t.searchParams.set('id', id);
  t.searchParams.set('export', 'download');
  t.searchParams.set('confirm', 't');
  if (resourcekey) t.searchParams.set('resourcekey', resourcekey);
  return t;
}

/** Large files get a "can't scan for viruses" HTML form; resubmit it with its hidden fields. */
function confirmFormURL(html) {
  const action = html.match(/<form[^>]+action="([^"]+)"/i)?.[1];
  if (!action) return null;
  const u = new URL(action.replace(/&amp;/g, '&'));
  for (const m of html.matchAll(/<input[^>]+type="hidden"[^>]*>/gi)) {
    const name = m[0].match(/name="([^"]+)"/)?.[1];
    const value = m[0].match(/value="([^"]*)"/)?.[1] ?? '';
    if (name) u.searchParams.set(name, value);
  }
  return u;
}

const EXT = {
  'video/mp4': '.mp4',
  'video/x-m4v': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function createDownloader({ dir, fetcher = fetch, limitBytes = 20 * 1024 ** 3 }) {
  fs.mkdirSync(dir, { recursive: true });
  const indexFile = path.join(dir, 'index.json');
  let index = {};
  try {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  } catch {}
  const inflight = new Map();
  const saveIndex = () => fsp.writeFile(indexFile, JSON.stringify(index, null, 1));
  const keyOf = (url, base) => {
    const d = driveTarget(url, base);
    return d ? 'drive:' + d.id : new URL(url, base).href;
  };

  async function download(url, base, kind, onProgress) {
    const drive = driveTarget(url, base);
    let target = drive ? driveDownloadURL(drive) : new URL(url, base);
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetcher(target, { redirect: 'follow' });
      const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (drive && type === 'text/html') {
        const next = confirmFormURL(await response.text());
        if (!next) throw Object.assign(Error('DRIVE_NOT_PUBLIC'), { code: 'DRIVE_NOT_PUBLIC' });
        target = next;
        continue;
      }
      break;
    }
    if (!response.ok)
      throw Object.assign(Error('HTTP ' + response.status), {
        code: response.status === 429 ? 'DRIVE_QUOTA' : drive ? 'DRIVE_NOT_PUBLIC' : 'HTTP_ERROR',
      });
    let type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (type === 'text/html')
      throw Object.assign(Error('DRIVE_NOT_PUBLIC'), { code: 'DRIVE_NOT_PUBLIC' });
    if (!type || type === 'application/octet-stream')
      type = kind === 'audio' ? 'audio/mpeg' : kind === 'image' ? 'image/jpeg' : 'video/mp4';
    const total = Number(response.headers.get('content-length')) || 0;
    const name = crypto.createHash('sha256').update(keyOf(url, base)).digest('hex').slice(0, 32);
    const file = name + (EXT[type] || '.bin');
    const temp = path.join(dir, file + '.part');
    const out = fs.createWriteStream(temp);
    let loaded = 0;
    let lastReport = 0;
    try {
      for await (const chunk of response.body) {
        loaded += chunk.byteLength;
        if (loaded > limitBytes) throw Error('FILE_TOO_LARGE');
        if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
        if (Date.now() - lastReport > 250) {
          lastReport = Date.now();
          onProgress?.(loaded, total);
        }
      }
      await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
    } catch (error) {
      out.destroy();
      await fsp.rm(temp, { force: true });
      throw error;
    }
    if (!loaded) {
      await fsp.rm(temp, { force: true });
      throw Error('EMPTY_FILE');
    }
    if (total && loaded !== total) {
      await fsp.rm(temp, { force: true });
      throw Error('INCOMPLETE_DOWNLOAD');
    }
    await fsp.rename(temp, path.join(dir, file));
    onProgress?.(loaded, loaded);
    return { file, size: loaded, type, saved: Date.now() };
  }

  return {
    dir,
    /** Returns the saved entry, downloading it first if needed. Concurrent calls share one download. */
    async prepare(url, { base, kind, onProgress } = {}) {
      const key = keyOf(url, base);
      const entry = index[key];
      if (entry && fs.existsSync(path.join(dir, entry.file))) {
        onProgress?.(entry.size, entry.size);
        return entry;
      }
      if (!inflight.has(key))
        inflight.set(
          key,
          download(url, base, kind, onProgress)
            .then(async (saved) => {
              index[key] = saved;
              await saveIndex();
              return saved;
            })
            .finally(() => inflight.delete(key)),
        );
      return inflight.get(key);
    },
    async forget(url, base) {
      const key = keyOf(url, base);
      const entry = index[key];
      delete index[key];
      await saveIndex();
      if (entry) await fsp.rm(path.join(dir, entry.file), { force: true });
    },
    fileFor(name) {
      if (!/^[a-f0-9]{32}\.[a-z0-9]+$/.test(name)) return null;
      const entry = Object.values(index).find((e) => e.file === name);
      return entry ? { path: path.join(dir, name), ...entry } : null;
    },
  };
}

module.exports = { createDownloader, driveTarget, confirmFormURL };
