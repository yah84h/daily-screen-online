import { supabase } from './supabase';
const LIMIT = 512 * 1024 * 1024;
const CHUNK = 16 * 1024;
export const peerLimit = LIMIT;
export type PeerSignal = { session: string; type: string; sdp?: RTCSessionDescriptionInit };
/** Device tokens stay private: broadcast payloads use AES-GCM and a separate hashed channel name. */
export async function peerSignaling(token: string, receive: (signal: PeerSignal) => void) {
  if (!token) throw Error('اختر جهازًا مرتبطًا أولًا.');
  const digest = async (purpose: string) =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(purpose + token));
  const key = await crypto.subtle.importKey(
    'raw',
    await digest('peer-encryption:'),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
  const channelName = Array.from(new Uint8Array(await digest('peer-channel:')))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  const channel = supabase.channel('peer-transfer:' + channelName);
  channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
    try {
      if (typeof payload?.data !== 'string' || payload.data.length > 100000) return;
      const raw = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));
      const decoded = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: raw.slice(0, 12) },
        key,
        raw.slice(12),
      );
      const message = JSON.parse(new TextDecoder().decode(decoded));
      if (Math.abs(Date.now() - message.at) > 120000) return;
      receive(message.signal);
    } catch {
      /* Ignore unauthenticated messages. */
    }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('تعذر الاتصال بخدمة الربط.')), 12000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          reject(Error('تعذر الاتصال بخدمة الربط.'));
        }
      });
    });
  } catch (error) {
    await channel.unsubscribe();
    throw error;
  }
  return {
    async send(signal: PeerSignal) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = new Uint8Array(
        await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          new TextEncoder().encode(JSON.stringify({ at: Date.now(), signal })),
        ),
      );
      const bytes = new Uint8Array(iv.length + encrypted.length);
      bytes.set(iv);
      bytes.set(encrypted, iv.length);
      const result = await channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { data: btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join('')) },
      });
      if (result !== 'ok') throw Error('تعذر إرسال رسالة الربط.');
    },
    close: () => channel.unsubscribe(),
  };
}
export function newPeer() {
  return new RTCPeerConnection({
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
  });
}
export async function completeDescription(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') return peer.localDescription!;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      if (peer.localDescription?.sdp.includes('a=candidate:')) resolve();
      else reject(Error('تعذر تجهيز الاتصال. قد تحتاج الشبكة إلى TURN.'));
    }, 15000);
    const check = () => {
      if (peer.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', check);
    };
    peer.addEventListener('icegatheringstatechange', check);
    check();
  });
  return peer.localDescription!;
}
export function validatePeerFile(value: unknown): { name: string; size: number; mime: string } {
  const file = value as { name: string; size: number; mime: string };
  if (
    !file ||
    typeof file.name !== 'string' ||
    file.name.length > 200 ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    file.size > LIMIT ||
    !['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mime)
  )
    throw Error('اختر فيديو MP4 أو WEBM أو MOV بحجم أقصى ٥١٢ ميجابايت.');
  return file;
}
export async function sendPeerFile(
  channel: RTCDataChannel,
  file: File,
  progress: (n: number) => void,
  signal: AbortSignal,
) {
  validatePeerFile({ name: file.name, size: file.size, mime: file.type });
  channel.bufferedAmountLowThreshold = 256 * 1024;
  channel.send(JSON.stringify({ type: 'file', name: file.name, size: file.size, mime: file.type }));
  for (let offset = 0; offset < file.size; offset += CHUNK) {
    signal.throwIfAborted();
    while (channel.bufferedAmount > 1024 * 1024) {
      if (channel.readyState !== 'open') throw Error('انقطع الاتصال أثناء النقل.');
      await new Promise((resolve) => setTimeout(resolve, 20));
      signal.throwIfAborted();
    }
    if (channel.readyState !== 'open') throw Error('انقطع الاتصال أثناء النقل.');
    const bytes = await file.slice(offset, offset + CHUNK).arrayBuffer();
    signal.throwIfAborted();
    channel.send(bytes);
    progress(Math.min(file.size, offset + CHUNK) / file.size);
  }
  channel.send(JSON.stringify({ type: 'end' }));
}
export async function peerStore(screen: string, file?: { blob: Blob; name: string }) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('daily-screen-peer-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    return await new Promise<{ blob: Blob; name: string } | undefined>((resolve, reject) => {
      const tx = db.transaction('files', file ? 'readwrite' : 'readonly'),
        store = tx.objectStore('files');
      const request = file ? store.put(file, screen) : store.get(screen);
      tx.oncomplete = () => resolve(file || request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
