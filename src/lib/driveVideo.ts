import { parseDriveLink, DRIVE_CHUNK } from '../../local-test/drive-video.mjs';
export { parseDriveLink };
export function drivePlaybackURL(link: string) {
  const parsed = parseDriveLink(link);
  if (!parsed) throw Error('رابط Google Drive غير صالح');
  return (
    '/api/drive-video?id=' +
    encodeURIComponent(parsed.id) +
    (parsed.resourcekey ? '&resourcekey=' + encodeURIComponent(parsed.resourcekey) : '')
  );
}
const LIMIT = 512 * 1024 * 1024;
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('daily-screen-drive-video', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('videos');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
async function stored(url: string): Promise<Blob | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('videos').objectStore('videos').get(url);
      request.onsuccess = () => {
        const value = request.result;
        resolve(
          value instanceof Blob
            ? value
            : value?.bytes instanceof ArrayBuffer
              ? new Blob([value.bytes], { type: value.type || 'video/mp4' })
              : null,
        );
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
async function remember(url: string, blob: Blob) {
  const bytes = await blob.arrayBuffer();
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      const store = tx.objectStore('videos');
      store.clear();
      store.put({ bytes, type: blob.type }, url);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function clearDriveVideoCache() {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      tx.objectStore('videos').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function driveError(code: string) {
  return (
    (
      {
        INVALID_DRIVE_LINK: 'رابط Google Drive غير صالح.',
        DRIVE_NOT_PUBLIC:
          'تعذر قراءة الفيديو. اجعل المشاركة «أي شخص لديه الرابط» واسمح بالتنزيل، واستخدم MP4 أو WEBM.',
        DRIVE_QUOTA: 'وصل الملف إلى حد التنزيل في Google Drive. حاول لاحقًا.',
        DRIVE_RANGE_UNAVAILABLE:
          'لم يسمح Drive بتشغيل هذا الملف على أجزاء. جرّب ملف MP4 آخر مع السماح بالتنزيل.',
        OFFLINE_ONLY: 'الخادم في وضع دون اتصال؛ يحتاج فيديو Drive إلى الإنترنت أول مرة.',
      } as Record<string, string>
    )[code] || 'تعذر تحميل فيديو Drive. تحقق من الاتصال وصلاحيات الملف ثم أعد المحاولة.'
  );
}
export async function cacheDriveVideo(
  url: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<{ blob: Blob; persistent: boolean; cached: boolean }> {
  try {
    const blob = await stored(url);
    signal.throwIfAborted();
    if (blob) {
      onProgress(blob.size, blob.size);
      return { blob, persistent: true, cached: true };
    }
  } catch {
    signal.throwIfAborted();
  }
  const blob = await downloadDriveMedia(url, signal, onProgress);
  let persistent = false;
  try {
    await remember(url, blob);
    persistent = true;
  } catch {
    /* Prepared media can still play when storage is full. */
  }
  signal.throwIfAborted();
  return { blob, persistent, cached: false };
}
/** Fully download Drive's bounded range responses without replacing the saved video cache. */
export async function downloadDriveMedia(
  url: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<Blob> {
  const chunks: BlobPart[] = [];
  let offset = 0;
  let total = 0;
  let type = 'video/mp4';
  do {
    signal.throwIfAborted();
    const response = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: { Range: `bytes=${offset}-${offset + DRIVE_CHUNK - 1}` },
    });
    if (response.status !== 206) {
      let code = 'DRIVE_UNAVAILABLE';
      try {
        code = (await response.json()).error || code;
      } catch {}
      throw Error(driveError(code));
    }
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
    if (
      !range ||
      Number(range[1]) !== offset ||
      Number(range[2]) < offset ||
      Number(range[2]) >= Number(range[3]) ||
      (total && total !== Number(range[3]))
    )
      throw Error('استجابة الفيديو غير مكتملة. أعد المحاولة.');
    total = Number(range[3]);
    if (total > LIMIT) {
      await response.body?.cancel();
      throw Error(
        'التحضير الكامل يدعم فيديو حتى ٥١٢ ميجابايت. اختر التخزين المؤقت القصير أو التشغيل المباشر لهذا الملف.',
      );
    }
    type = response.headers.get('Content-Type') || type;
    const reader = response.body?.getReader();
    if (!reader) throw Error('تعذر قراءة الفيديو');
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > DRIVE_CHUNK || offset + length > total) {
        await reader.cancel();
        throw Error('حجم الفيديو غير متوقع');
      }
      chunks.push(value);
      onProgress(offset + length, total);
    }
    if (length !== Number(range[2]) - offset + 1) throw Error('انقطع تنزيل الفيديو. أعد المحاولة.');
    offset += length;
  } while (offset < total);
  signal.throwIfAborted();
  return new Blob(chunks, { type });
}
