import type { Presentation } from './presentation';
const LIMIT = 256 * 1024 * 1024;
type SlideBytes = { bytes: ArrayBuffer; type: string };
type CachedDeck = { key: string; slides: SlideBytes[] };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('daily-screen-presentations', 1);
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(Error('Storage unavailable'));
    }, 2000);
    request.onupgradeneeded = () => request.result.createObjectStore('decks');
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
async function readDeck(key: string) {
  const db = await database();
  try {
    return await new Promise<CachedDeck | undefined>((resolve, reject) => {
      const request = db.transaction('decks').objectStore('decks').get('current');
      request.onsuccess = () => resolve(request.result?.key === key ? request.result : undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
async function saveDeck(value: CachedDeck) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('decks', 'readwrite');
      tx.objectStore('decks').put(value, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
/** A new deck replaces the previous saved deck only after every slide downloads and decodes. */
export async function preparePresentation(
  deck: Presentation,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
) {
  const key = JSON.stringify([deck.id, deck.slides]);
  const urls: string[] = [];
  const release = () => urls.forEach((url) => URL.revokeObjectURL(url));
  async function localSlide(slide: SlideBytes) {
    signal.throwIfAborted();
    const url = URL.createObjectURL(new Blob([slide.bytes], { type: slide.type }));
    urls.push(url);
    const image = new Image();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    return url;
  }
  try {
    let cached: CachedDeck | undefined;
    try {
      cached = await readDeck(key);
    } catch {
      /* Download works even with browser storage disabled. */
    }
    signal.throwIfAborted();
    if (cached?.slides.length === deck.slides.length) {
      try {
        for (const slide of cached.slides) {
          await localSlide(slide);
          onProgress(urls.length, deck.slides.length);
        }
        return { urls, persistent: true, release };
      } catch {
        release();
        urls.length = 0;
        signal.throwIfAborted();
        onProgress(0, deck.slides.length);
      }
    }
    const slides: SlideBytes[] = [];
    let totalBytes = 0;
    for (const source of deck.slides) {
      const response = await fetch(source, { signal });
      if (!response.ok || response.status === 206) throw Error('تعذر تنزيل إحدى الشرائح كاملة.');
      const reader = response.body?.getReader();
      if (!reader) throw Error('تعذر قراءة الشريحة.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        totalBytes += value.byteLength;
        if (totalBytes > LIMIT) {
          await reader.cancel();
          throw Error('حجم الشرائح يتجاوز حد التحضير: ٢٥٦ ميجابايت.');
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const slide = {
        bytes: bytes.buffer,
        type: response.headers.get('Content-Type') || 'image/jpeg',
      };
      await localSlide(slide);
      slides.push(slide);
      onProgress(slides.length, deck.slides.length);
    }
    signal.throwIfAborted();
    let persistent = false;
    try {
      await saveDeck({ key, slides });
      persistent = true;
    } catch {
      /* Keep the prepared in-memory deck playable. */
    }
    signal.throwIfAborted();
    return { urls, persistent, release };
  } catch (error) {
    release();
    throw error;
  }
}
