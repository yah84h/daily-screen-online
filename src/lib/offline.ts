import type { TvState } from './types';

/** تخزين آخر حالة للتلفزيون في IndexedDB مع تحويل الصور إلى data URLs لتعمل دون اتصال */
const DB = 'daily-screen-offline';
const STORE = 'screen';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function store<T>(value?: T): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, value ? 'readwrite' : 'readonly');
    const os = tx.objectStore(STORE);
    const r = value ? os.put(value, 'last') : os.get('last');
    r.onsuccess = () => resolve(value ?? (r.result as T));
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}

const MEDIA_KEYS = ['image', 'secondary', 'qr', 'logo', 'backgroundImage', 'logo_url'] as const;

async function toDataURL(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw Error('fetch failed');
  const blob = await r.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export async function cacheTvState(state: Extract<TvState, { status: 'paired' }>) {
  const copy = structuredClone(state);
  const objects: Record<string, unknown>[] = [copy.screen.template as Record<string, unknown>, copy.school as unknown as Record<string, unknown>];
  if (copy.post) objects.push(copy.post.content as unknown as Record<string, unknown>);
  for (const obj of objects) {
    for (const key of MEDIA_KEYS) {
      const v = obj[key];
      if (typeof v === 'string' && v && !v.startsWith('data:')) {
        try {
          obj[key] = await toDataURL(v);
        } catch {
          /* تبقى الصورة بالرابط الأصلي */
        }
      }
    }
  }
  try {
    await store(copy);
  } catch {
    /* IndexedDB غير متاح */
  }
}

export async function readTvCache() {
  try {
    return await store<Extract<TvState, { status: 'paired' }>>();
  } catch {
    return undefined;
  }
}
