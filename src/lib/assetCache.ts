import { downloadDriveMedia, drivePlaybackURL, parseDriveLink } from './driveVideo';
const FILE_LIMIT = 512 * 1024 * 1024;
const CACHE_LIMIT = 2 * 1024 * 1024 * 1024;
type Saved = { bytes: ArrayBuffer; type: string; updated: number };
function openCacheDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('daily-screen-show-media', 1);
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(Error('Storage unavailable'));
    }, 2000);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => {
      clearTimeout(timer);
      if (expired) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
  });
}
async function readStoredAsset(url: string) {
  const db = await openCacheDatabase();
  try {
    return await new Promise<Saved | undefined>((resolve, reject) => {
      const r = db.transaction('assets').objectStore('assets').get(url);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
async function saveStoredAsset(url: string, blob: Blob) {
  const value: Saved = {
    bytes: await blob.arrayBuffer(),
    type: blob.type,
    updated: Date.now(),
  };
  const db = await openCacheDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      const request = store.getAll();
      request.onsuccess = () => {
        const keys = store.getAllKeys();
        keys.onsuccess = () => {
          let size = value.bytes.byteLength;
          const records = request.result
            .map((record: Saved, i: number) => ({ record, key: keys.result[i] }))
            .filter((item) => item.key !== url)
            .sort((a, b) => b.record.updated - a.record.updated);
          for (const item of records) {
            size += item.record.bytes.byteLength;
            if (size > CACHE_LIMIT) store.delete(item.key);
          }
          store.put(value, url);
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function removeShowAsset(url: string) {
  const db = await openCacheDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').delete(url);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function clearShowCache() {
  const db = await openCacheDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function prepareAsset(
  url: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
  kind?: 'audio',
) {
  let saved: Saved | undefined;
  try {
    saved = await readStoredAsset(url);
  } catch {
    /* Session cache still works without IndexedDB. */
  }
  signal.throwIfAborted();
  if (saved?.bytes instanceof ArrayBuffer) {
    onProgress(saved.bytes.byteLength, saved.bytes.byteLength);
    return { blob: new Blob([saved.bytes], { type: saved.type }), persistent: true };
  }
  let blob: Blob;
  if (parseDriveLink(url))
    blob = await downloadDriveMedia(
      drivePlaybackURL(url) + (kind === 'audio' ? '&audio=1' : ''),
      signal,
      onProgress,
    );
  else {
    blob = await downloadDirectAsset(url, signal, onProgress);
  }
  signal.throwIfAborted();
  let persistent = false;
  try {
    await saveStoredAsset(url, blob);
    persistent = true;
  } catch {
    /* Fully prepared for this session even if quota is exhausted. */
  }
  signal.throwIfAborted();
  return { blob, persistent };
}
export const SHOW_LIMIT = CACHE_LIMIT;

/** Stream direct downloads so the size limit also applies when Content-Length is missing. */
async function downloadDirectAsset(
  url: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok || response.status === 206)
    throw Error('تعذر تنزيل الملف كاملًا. تحقق من الرابط وصلاحيات التنزيل.');
  const total = Number(response.headers.get('Content-Length')) || 0;
  if (total > FILE_LIMIT) {
    await response.body?.cancel();
    throw Error('حد الملف الواحد للتحضير ٥١٢ ميجابايت.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error('تعذر قراءة الملف.');
  const chunks: BlobPart[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    if (loaded > FILE_LIMIT) {
      await reader.cancel();
      throw Error('حد الملف الواحد للتحضير ٥١٢ ميجابايت.');
    }
    chunks.push(value);
    onProgress(loaded, total);
  }
  if (!loaded) throw Error('الملف فارغ.');
  return new Blob(chunks, { type: response.headers.get('Content-Type') || '' });
}
