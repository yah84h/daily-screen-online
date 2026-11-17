/**
 * Presenting mode ("وضع التقديم").
 *
 * The show never touches the database or cloud storage:
 * - files go phone → TV directly over WebRTC (signalling only goes through realtime broadcast),
 * - Drive/https links are downloaded by the TV itself,
 * - the TV keeps every file in its own IndexedDB and owns the show state.
 * The phone is a remote: it sends commands signed with the screen's `showKey`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isLocalBackend } from './supabase';
import { parseDriveLink, drivePlaybackURL, downloadDriveMedia } from './driveVideo';
import {
  emptyShow,
  partKey,
  showReduce,
  showReadiness,
  findPartOwner,
  type Show,
  type ShowCommand,
  type ShowItem,
} from '../../local-test/show-state.mjs';

export type { Show, ShowItem, ShowCommand };
export type ShowProgress = Record<string, { loaded: number; total: number; error?: string }>;
/** What the TV is playing right now (sent to the phone for the live remote). */
export type ShowPlayback = {
  time: number;
  duration: number;
  paused: boolean;
  muted: boolean;
  volume: number;
};
export type ShowStatus = {
  show: Show;
  stored: Record<string, boolean>;
  progress: ShowProgress;
  playback?: ShowPlayback | null;
  storage?: { usage: number; quota: number } | null;
  at: number;
};
export type VideoCommand = {
  op: 'video';
  action: 'toggle' | 'play' | 'pause' | 'restart' | 'seek' | 'skip' | 'volume' | 'mute';
  value?: number | boolean;
};
type Message =
  | { t: 'hello'; key: string }
  | { t: 'cmd'; key: string; id: string; cmd: ShowCommand | VideoCommand }
  | { t: 'ack'; id: string; error?: string }
  | ({ t: 'status' } & ShowStatus)
  | {
      t: 'rtc';
      key?: string;
      session: string;
      to: 'tv' | 'phone';
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };

const STUN: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
let iceCache: { at: number; config: RTCConfiguration } | null = null;
/**
 * STUN for same-network sends, plus TURN relay servers (when configured) so a phone on
 * mobile data can still reach the TV. TURN relays the encrypted stream; it stores nothing.
 */
async function iceServers(token = ''): Promise<RTCConfiguration> {
  if (iceCache && Date.now() - iceCache.at < 60 * 60 * 1000) return iceCache.config;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!token && !isLocalBackend) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = 'Bearer ' + data.session.access_token;
    }
    const response = await fetch(isLocalBackend ? '/local/turn' : '/.netlify/functions/turn', {
      method: 'POST',
      headers,
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.iceServers)) throw Error('no ice');
    const config: RTCConfiguration = {
      iceServers: data.iceServers,
      ...(data.policy === 'relay' ? { iceTransportPolicy: 'relay' as const } : {}),
    };
    iceCache = { at: Date.now(), config };
    return config;
  } catch {
    return { iceServers: isLocalBackend ? [] : STUN };
  }
}
const CHUNK = 64 * 1024;
export const SHOW_FILE_LIMIT = 2 * 1024 * 1024 * 1024;

/* ---------------------------- channel ---------------------------- */

function openChannel(screen: string, onMessage: (message: Message) => void) {
  const channel = supabase
    .channel('show:' + screen, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'msg' }, ({ payload }: { payload: Message }) => onMessage(payload));
  let ready: Promise<void> = new Promise((resolve) =>
    channel.subscribe((state: string) => state === 'SUBSCRIBED' && resolve()),
  );
  return {
    send: async (message: Message) => {
      await ready;
      await channel.send({ type: 'broadcast', event: 'msg', payload: message });
    },
    close: () => {
      ready = Promise.resolve();
      void channel.unsubscribe();
    },
  };
}

/* ---------------------------- TV storage ---------------------------- */

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('daily-screen-show', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files');
      request.result.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function tx<T>(
  store: 'files' | 'meta',
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await database();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const request = run(t.objectStore(store));
      t.oncomplete = () => resolve(request ? request.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || Error('تعذر الحفظ على الجهاز'));
    });
  } finally {
    db.close();
  }
}
const loadShow = () => tx<Show>('meta', 'readonly', (s) => s.get('show'));
const saveShow = (show: Show) => tx('meta', 'readwrite', (s) => void s.put(show, 'show'));
const fileKeys = async () =>
  ((await tx<IDBValidKey[]>('files', 'readonly', (s) => s.getAllKeys())) || []).map(String);
const readFile = (key: string) => tx<Blob>('files', 'readonly', (s) => s.get(key));
const writeFile = (key: string, blob: Blob) =>
  tx('files', 'readwrite', (s) => void s.put(blob, key));
const deleteFile = (key: string) => tx('files', 'readwrite', (s) => void s.delete(key));

/** A stored file only counts once the TV has actually decoded it. */
async function verify(blob: Blob, kind: 'image' | 'video') {
  const url = URL.createObjectURL(blob);
  try {
    if (kind === 'image') {
      const image = new Image();
      image.src = url;
      await image.decode();
      return;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('timeout')), 20000);
      video.onloadeddata = () => (clearTimeout(timer), resolve());
      video.onerror = () => (clearTimeout(timer), reject(Error('decode')));
      video.src = url;
    });
    video.removeAttribute('src');
    video.load();
  } catch {
    throw Error('هذا الملف لا يعمل على التلفزيون. استخدم MP4 أو WebM أو JPG/PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
const partKind = (item: ShowItem) => (item.kind === 'video' ? 'video' : 'image');

/* ---------------------------- TV host ---------------------------- */

export type ShowHost = {
  show: Show;
  urls: Record<string, string>;
  stored: Record<string, boolean>;
  progress: ShowProgress;
  videoCommand: { action: VideoCommand['action']; value?: number | boolean; at: number } | null;
  /** The TV's video reports its position/volume here. */
  reportPlayback: (playback: ShowPlayback | null) => void;
  /** Automatic next step (video ended, image time is up). */
  advance: () => void;
  /** Commands from the TV's own keyboard / presenter clicker. */
  command: (cmd: ShowCommand | VideoCommand) => void;
};

/** Runs on the TV: receives files and commands, keeps the show on the device. */
export function useShowHost(screen: string, key: string, token = ''): ShowHost {
  const [show, setShow] = useState<Show>(emptyShow());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<ShowProgress>({});
  const [videoCommand, setVideoCommand] = useState<ShowHost['videoCommand']>(null);
  const live = useRef({ show, urls, progress });
  live.current = { show, urls, progress };
  const handles = useRef({
    report: (_playback: ShowPlayback | null) => {},
    advance: () => {},
    command: (_cmd: ShowCommand | VideoCommand) => {},
  });
  const stored = Object.fromEntries(Object.keys(urls).map((k) => [k, true]));

  useEffect(() => {
    if (!screen || !key) return;
    let active = true,
      watchers = 0;
    const objectUrls = new Map<string, string>();
    const downloads = new Map<string, AbortController>();
    const peers = new Map<string, RTCPeerConnection>();
    const pendingIce = new Map<string, RTCIceCandidateInit[]>();
    let playback: ShowPlayback | null = null,
      storage: ShowStatus['storage'] = null;
    const status = (): ShowStatus => ({
      show: live.current.show,
      stored: Object.fromEntries([...objectUrls.keys()].map((k) => [k, true])),
      progress: live.current.progress,
      playback,
      storage,
      at: Date.now(),
    });
    const measure = async () => {
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate) storage = { usage: estimate.usage || 0, quota: estimate.quota || 0 };
      } catch {}
    };
    let lastStatus = 0,
      statusTimer: ReturnType<typeof setTimeout> | null = null;
    const broadcast = (soon = false) => {
      if (!active) return;
      if (statusTimer) return;
      const wait = soon ? Math.max(0, 400 - (Date.now() - lastStatus)) : 0;
      statusTimer = setTimeout(() => {
        statusTimer = null;
        lastStatus = Date.now();
        void channel.send({ t: 'status', ...status() }).catch(() => {});
      }, wait);
    };
    const setProg = (item: string, value: ShowProgress[string] | null) => {
      const next = { ...live.current.progress };
      if (value) next[item] = value;
      else delete next[item];
      live.current.progress = next;
      setProgress(next);
      broadcast(true);
    };
    const publishUrls = () => setUrls(Object.fromEntries(objectUrls));
    const store = async (item: ShowItem, part: number, blob: Blob) => {
      await verify(blob, partKind(item));
      await writeFile(partKey(item.id, part), blob);
      const k = partKey(item.id, part);
      if (objectUrls.has(k)) URL.revokeObjectURL(objectUrls.get(k)!);
      objectUrls.set(k, URL.createObjectURL(blob));
      publishUrls();
      void measure();
    };
    const commit = (next: Show) => {
      live.current.show = next;
      setShow(next);
      void saveShow(next).catch(() => {});
      broadcast();
    };
    const forget = async (item: ShowItem) => {
      downloads.get(item.id)?.abort();
      for (let part = 0; part < (item.kind === 'deck' ? item.parts : 1); part++) {
        const k = partKey(item.id, part);
        if (objectUrls.has(k)) URL.revokeObjectURL(objectUrls.get(k)!);
        objectUrls.delete(k);
        await deleteFile(k).catch(() => {});
      }
      setProg(item.id, null);
      publishUrls();
    };
    const download = async (item: ShowItem) => {
      if (item.source !== 'link' || objectUrls.has(partKey(item.id)) || downloads.has(item.id))
        return;
      const controller = new AbortController();
      downloads.set(item.id, controller);
      try {
        let tick = 0;
        const report = (loaded: number, total: number) => {
          if (Date.now() - tick < 500) return;
          tick = Date.now();
          setProg(item.id, { loaded, total });
        };
        let blob: Blob;
        if (parseDriveLink(item.url))
          // The Drive proxy answers in bounded ranges; this downloader stitches them together.
          blob = await downloadDriveMedia(
            drivePlaybackURL(item.url) + (item.kind === 'image' ? '&image=1' : ''),
            controller.signal,
            report,
          );
        else {
          const response = await fetch(item.url, { signal: controller.signal });
          if (!response.ok || !response.body) throw Error('تعذر تنزيل الرابط.');
          const total = Number(response.headers.get('Content-Length')) || item.size || 0;
          const reader = response.body.getReader();
          const chunks: BlobPart[] = [];
          let loaded = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.byteLength;
            if (loaded > SHOW_FILE_LIMIT) throw Error('الملف أكبر من ٢ جيجابايت.');
            report(loaded, total);
          }
          blob = new Blob(chunks, { type: response.headers.get('Content-Type') || '' });
        }
        await store(item, 0, blob);
        setProg(item.id, null);
      } catch (error) {
        if (!controller.signal.aborted)
          setProg(item.id, { loaded: 0, total: 0, error: (error as Error).message });
      } finally {
        downloads.delete(item.id);
      }
    };
    const apply = async (cmd: ShowCommand | VideoCommand) => {
      if (cmd.op === 'video') {
        setVideoCommand({ action: cmd.action, value: cmd.value, at: Date.now() });
        return;
      }
      const before = live.current.show;
      const next = showReduce(before, cmd);
      if (next === before) return;
      if (cmd.op === 'remove' || cmd.op === 'clear')
        for (const item of before.items)
          if (!next.items.some((kept) => kept.id === item.id)) await forget(item);
      if (before.background && before.background.id !== next.background?.id)
        await forget(findPartOwner(before, before.background.id)!);
      commit(next);
      if (cmd.op === 'add') {
        const item = next.items[next.items.length - 1];
        if (item.source === 'link') void download(item);
      }
    };
    /* Receiving files from the phone. */
    const receive = (session: string, pc: RTCPeerConnection) => {
      pc.ondatachannel = ({ channel: dc }) => {
        dc.binaryType = 'arraybuffer';
        let header: { item: string; part: number; size: number; type: string } | null = null;
        let chunks: ArrayBuffer[] = [];
        let received = 0,
          tick = 0;
        dc.onmessage = async ({ data }) => {
          if (typeof data === 'string') {
            const message = JSON.parse(data);
            if (message.t === 'part') {
              const item = findPartOwner(live.current.show, message.item);
              if (!item || message.size > SHOW_FILE_LIMIT) {
                dc.send(JSON.stringify({ t: 'error', message: 'ملف غير متوقع' }));
                return;
              }
              header = message;
              chunks = [];
              received = 0;
            }
            return;
          }
          if (!header) return;
          chunks.push(data);
          received += data.byteLength;
          const item = findPartOwner(live.current.show, header!.item);
          const parts = item?.kind === 'deck' ? item.parts : 1;
          if (item && Date.now() - tick > 500) {
            tick = Date.now();
            setProg(item.id, {
              loaded: header.part * 1 + received / Math.max(1, header.size),
              total: parts,
            });
          }
          if (received < header.size) return;
          const done = header;
          header = null;
          try {
            if (!item) throw Error('حُذف الملف أثناء الإرسال');
            await store(item, done.part, new Blob(chunks, { type: done.type }));
            chunks = [];
            if (done.part + 1 >= parts) setProg(item.id, null);
            dc.send(JSON.stringify({ t: 'got', item: done.item, part: done.part }));
          } catch (error) {
            const message = (error as Error).message;
            if (item) setProg(item.id, { loaded: 0, total: 0, error: message });
            dc.send(JSON.stringify({ t: 'error', message }));
          }
        };
      };
      pc.onicecandidate = ({ candidate }) =>
        candidate &&
        void channel.send({ t: 'rtc', session, to: 'phone', candidate: candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) peers.delete(session);
      };
    };
    const onMessage = async (message: Message) => {
      if (!active || !message || typeof message !== 'object') return;
      if (message.t === 'hello' && message.key === key) {
        watchers = Date.now();
        broadcast();
        return;
      }
      if (message.t === 'cmd' && message.key === key) {
        watchers = Date.now();
        let error: string | undefined;
        try {
          await apply(message.cmd);
        } catch (e) {
          error = (e as Error).message;
        }
        void channel.send({ t: 'ack', id: message.id, error }).catch(() => {});
        return;
      }
      if (message.t === 'rtc' && message.to === 'tv') {
        if (message.sdp) {
          if (message.key !== key) return;
          peers.get(message.session)?.close();
          const pc = new RTCPeerConnection(await iceServers(token));
          peers.set(message.session, pc);
          receive(message.session, pc);
          await pc.setRemoteDescription(message.sdp);
          for (const candidate of pendingIce.get(message.session) || [])
            await pc.addIceCandidate(candidate).catch(() => {});
          pendingIce.delete(message.session);
          await pc.setLocalDescription(await pc.createAnswer());
          void channel.send({
            t: 'rtc',
            session: message.session,
            to: 'phone',
            sdp: pc.localDescription!.toJSON(),
          });
        } else if (message.candidate) {
          const pc = peers.get(message.session);
          if (pc?.remoteDescription) await pc.addIceCandidate(message.candidate).catch(() => {});
          else
            pendingIce.set(message.session, [
              ...(pendingIce.get(message.session) || []),
              message.candidate,
            ]);
        }
      }
    };
    const channel = openChannel(screen, (m) => void onMessage(m));
    handles.current.report = (next) => {
      playback = next;
      // Live position only matters while someone holds the remote.
      if (Date.now() - watchers < 60000) broadcast(true);
    };
    // Presenter clicker / keyboard on the TV itself.
    handles.current.command = (cmd) => void apply(cmd).catch(() => {});
    handles.current.advance = () =>
      void apply({ op: 'advance' }).catch(() => {
        /* nothing to advance */
      });
    const heartbeat = setInterval(() => {
      if (Date.now() - watchers < 60000) void measure().then(() => broadcast());
    }, 10000);
    (async () => {
      try {
        void navigator.storage?.persist?.();
        const saved = { ...emptyShow(), ...((await loadShow()) || {}) };
        await measure();
        const keys = new Set(await fileKeys());
        const owners = saved.background
          ? [...saved.items, findPartOwner(saved, saved.background.id)!]
          : saved.items;
        for (const item of owners)
          for (let part = 0; part < (item.kind === 'deck' ? item.parts : 1); part++) {
            const k = partKey(item.id, part);
            if (!keys.has(k)) continue;
            const blob = await readFile(k);
            if (blob && active) objectUrls.set(k, URL.createObjectURL(blob));
          }
        if (!active) return;
        live.current.show = saved;
        setShow(saved);
        publishUrls();
        broadcast();
        for (const item of saved.items) void download(item);
      } catch {
        /* Storage unavailable: the show still works in memory for this session. */
      }
    })();
    return () => {
      active = false;
      clearInterval(heartbeat);
      if (statusTimer) clearTimeout(statusTimer);
      downloads.forEach((controller) => controller.abort());
      peers.forEach((pc) => pc.close());
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      channel.close();
    };
  }, [screen, key, token]);
  const reportPlayback = useCallback((p: ShowPlayback | null) => handles.current.report(p), []);
  const advance = useCallback(() => handles.current.advance(), []);
  const command = useCallback(
    (cmd: ShowCommand | VideoCommand) => handles.current.command(cmd),
    [],
  );
  return { show, urls, stored, progress, videoCommand, reportPlayback, advance, command };
}

/* ---------------------------- phone remote ---------------------------- */

export type SendProgress = Record<string, { sent: number; total: number; error?: string }>;

/** Runs on the phone: commands, live status and direct file sending. */
export function useShowRemote(screen: string, key: string) {
  const [status, setStatus] = useState<ShowStatus | null>(null);
  const [sending, setSending] = useState<SendProgress>({});
  const channelRef = useRef<ReturnType<typeof openChannel> | null>(null);
  const acks = useRef(new Map<string, (error?: string) => void>());
  const rtc = useRef(new Map<string, (message: Extract<Message, { t: 'rtc' }>) => void>());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!screen || !key) return;
    const channel = openChannel(screen, (message) => {
      if (message?.t === 'status') setStatus({ ...message, at: Date.now() });
      else if (message?.t === 'ack') {
        acks.current.get(message.id)?.(message.error);
        acks.current.delete(message.id);
      } else if (message?.t === 'rtc' && message.to === 'phone')
        rtc.current.get(message.session)?.(message);
    });
    channelRef.current = channel;
    const hello = () => void channel.send({ t: 'hello', key }).catch(() => {});
    hello();
    const timer = setInterval(() => {
      hello();
      setNow(Date.now());
    }, 15000);
    return () => {
      clearInterval(timer);
      channel.close();
      channelRef.current = null;
    };
  }, [screen, key]);

  const send = useCallback(
    (cmd: ShowCommand | VideoCommand) =>
      new Promise<void>((resolve, reject) => {
        const channel = channelRef.current;
        if (!channel) return reject(Error('غير متصل بالشاشة'));
        const id = crypto.randomUUID();
        const timer = setTimeout(() => {
          acks.current.delete(id);
          reject(Error('التلفزيون لا يرد. تأكد أنه يعمل على وضع التقديم.'));
        }, 12000);
        acks.current.set(id, (error) => {
          clearTimeout(timer);
          if (error) reject(Error(error));
          else resolve();
        });
        void channel.send({ t: 'cmd', key, id, cmd }).catch((error) => {
          clearTimeout(timer);
          acks.current.delete(id);
          reject(error);
        });
      }),
    [key],
  );

  /** Streams files straight to the TV. `parts` are the item's files in order. */
  const sendFiles = useCallback(
    async (item: ShowItem, parts: Blob[]) => {
      const channel = channelRef.current;
      if (!channel) throw Error('غير متصل بالشاشة');
      const total = parts.reduce((sum, part) => sum + part.size, 0);
      const update = (value: SendProgress[string] | null) =>
        setSending((current) => {
          const next = { ...current };
          if (value) next[item.id] = value;
          else delete next[item.id];
          return next;
        });
      update({ sent: 0, total });
      const session = crypto.randomUUID();
      const pc = new RTCPeerConnection(await iceServers());
      try {
        const dc = pc.createDataChannel('file', { ordered: true });
        dc.binaryType = 'arraybuffer';
        dc.bufferedAmountLowThreshold = 1024 * 1024;
        rtc.current.set(session, (message) => {
          if (message.sdp) void pc.setRemoteDescription(message.sdp);
          else if (message.candidate) void pc.addIceCandidate(message.candidate).catch(() => {});
        });
        pc.onicecandidate = ({ candidate }) =>
          candidate &&
          void channel.send({ t: 'rtc', session, to: 'tv', candidate: candidate.toJSON() });
        await pc.setLocalDescription(await pc.createOffer());
        await channel.send({
          t: 'rtc',
          key,
          session,
          to: 'tv',
          sdp: pc.localDescription!.toJSON(),
        });
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () =>
              reject(
                Error(
                  'تعذر الاتصال بالتلفزيون. تأكد أن التلفزيون متصل بالإنترنت ثم أعد المحاولة، أو استخدم رابط Google Drive.',
                ),
              ),
            25000,
          );
          dc.onopen = () => (clearTimeout(timer), resolve());
        });
        let waiting: ((error?: string) => void) | null = null;
        dc.onmessage = ({ data }) => {
          const message = JSON.parse(data);
          if (message.t === 'got') waiting?.();
          if (message.t === 'error') waiting?.(message.message || 'تعذر الحفظ على التلفزيون');
        };
        dc.onclose = () => waiting?.('انقطع الاتصال بالتلفزيون');
        let sent = 0;
        for (let part = 0; part < parts.length; part++) {
          const blob = parts[part];
          const ack = new Promise<void>((resolve, reject) => {
            waiting = (error) => {
              waiting = null;
              if (error) reject(Error(error));
              else resolve();
            };
          });
          dc.send(
            JSON.stringify({ t: 'part', item: item.id, part, size: blob.size, type: blob.type }),
          );
          for (let offset = 0; offset < blob.size; offset += CHUNK) {
            if (dc.bufferedAmount > 8 * CHUNK * 16)
              await new Promise<void>((resolve) =>
                dc.addEventListener('bufferedamountlow', () => resolve(), { once: true }),
              );
            if (dc.readyState !== 'open') throw Error('انقطع الاتصال بالتلفزيون');
            const chunk = await blob.slice(offset, offset + CHUNK).arrayBuffer();
            dc.send(chunk);
            sent += chunk.byteLength;
            update({ sent, total });
          }
          await ack;
        }
        update(null);
      } catch (error) {
        update({ sent: 0, total, error: (error as Error).message });
        throw error;
      } finally {
        rtc.current.delete(session);
        setTimeout(() => pc.close(), 1000);
      }
    },
    [key],
  );

  const online = !!status && now - status.at < 45000;
  const readiness = status ? showReadiness(status.show.items, status.stored) : null;
  return { status, online, readiness, sending, send, sendFiles };
}
