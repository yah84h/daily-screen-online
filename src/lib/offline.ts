import type { TvState } from "./types";

/** تخزين آخر حالة للتلفزيون في IndexedDB مع تحويل الصور إلى data URLs لتعمل دون اتصال */
const DB = "daily-screen-offline";
const STORE = "screen";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function store<T>(value?: T, key = "last"): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, value ? "readwrite" : "readonly");
    const os = tx.objectStore(STORE);
    const r = value ? os.put(value, key) : os.get(key);
    r.onsuccess = () => resolve(value ?? (r.result as T));
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}

const MEDIA_KEYS = [
  "image",
  "secondary",
  "qr",
  "logo",
  "backgroundImage",
  "logo_url",
  "schoolLogo",
  "fullMedia",
] as const;

async function toDataURL(url: string): Promise<string> {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw Error("fetch failed");
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

let generation = 0;
export async function cacheTvState(
  state: Extract<TvState, { status: "paired" }>,
  key = "last",
) {
  const current = ++generation;
  const copy = structuredClone(state);
  // Save text/layout immediately, even if a photo server is unreachable.
  try {
    await store(copy,key);
  } catch {
    return;
  }
  const objects: Record<string, unknown>[] = [
    copy.screen.template as Record<string, unknown>,
    copy.school as unknown as Record<string, unknown>,
  ];
  if (copy.post)
    objects.push(copy.post.content as unknown as Record<string, unknown>);
  for (const student of copy.screen.template.recognition?.students || [])
    objects.push(student as unknown as Record<string, unknown>);
  const downloads = objects.flatMap((obj) =>
    [...MEDIA_KEYS, "photo"].flatMap((key) => {
      const value = obj[key];
      if (typeof value !== "string" || !value || value.startsWith("data:"))
        return [];
      return [
        (async () => {
          try {
            if(key==='fullMedia' && copy.post?.content.fullType==='video') {
              const response=await fetch(value); if(response.ok) await (await caches.open('daily-screen-media')).put(value,response);
            } else obj[key] = await toDataURL(value);
          } catch {
            /* retain original URL */
          }
        })(),
      ];
    }),
  );
  await Promise.all(downloads);
  // A slow download from an older publication must not overwrite a newer screen.
  if (current === generation) {
    try {
      await store(copy,key);
    } catch {
      /* storage quota/unavailable */
    }
  }
}

export async function readTvCache(key="last") {
  try {
    return await store<Extract<TvState, { status: "paired" }>>(undefined,key);
  } catch {
    return undefined;
  }
}
