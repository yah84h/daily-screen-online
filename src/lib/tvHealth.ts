import { supabase } from './supabase';
import { screenChannel } from './api';
import { tokenTag, type DeviceStatus, type TvCommand, type TvCommandName } from './tvWatchdog';

declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

// ---------- Error log on this device (kept across reloads) ----------
const LOG_KEY = 'tv-health-log';
const MAX_LOG = 20;
type LogEntry = { at: number; message: string };

function readLog(): LogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    return Array.isArray(v) ? v.slice(-MAX_LOG) : [];
  } catch {
    return [];
  }
}
let log: LogEntry[] = readLog();

export function recordError(error: unknown) {
  const message = String((error as Error)?.message || error || 'خطأ غير معروف').slice(0, 300);
  const last = log[log.length - 1];
  if (last && last.message === message && Date.now() - last.at < 5_000) return; // de-duplicate bursts
  log = [...log, { at: Date.now(), message }].slice(-MAX_LOG);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {}
}
export const errorLog = () => log;

let installed = false;
/** Catch uncaught errors so they show up in the admin health panel. */
export function installGlobalErrorLog(onError?: () => void) {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => {
    recordError(e.error || e.message);
    onError?.();
  });
  window.addEventListener('unhandledrejection', (e) => {
    recordError(e.reason);
    onError?.();
  });
}

// ---------- Status reporting ----------
const startedAt = Date.now();
let rpcDisabledUntil = 0;

export function buildStatus(p: {
  token: string;
  mode: string;
  online: boolean;
  blackout: boolean;
  failures: number;
}): DeviceStatus {
  return {
    tag: tokenTag(p.token),
    version: APP_VERSION,
    mode: p.mode,
    online: p.online,
    blackout: p.blackout,
    failures: p.failures,
    errors: log.slice(-5),
    startedAt,
    at: Date.now(),
    userAgent: navigator.userAgent.slice(0, 160),
  };
}

/**
 * Send this TV's status: instantly over Realtime broadcast (always works), and into
 * screen_devices.status through the tv_report_status RPC when that migration is installed.
 */
export async function publishStatus(screenId: string, token: string, status: DeviceStatus) {
  const ch = screenChannel(screenId);
  if (ch.state === 'joined')
    void ch.send({ type: 'broadcast', event: 'status', payload: status }).catch(() => {});
  if (Date.now() < rpcDisabledUntil) return;
  const { error } = await supabase.rpc('tv_report_status', { p_token: token, p_status: status });
  // Migration not installed yet → try again in 10 minutes instead of every heartbeat.
  if (error) rpcDisabledUntil = Date.now() + 10 * 60_000;
}

// ---------- Admin side: send commands ----------
export async function sendTvCommand(screenId: string, target: string, name: TvCommandName) {
  const cmd: TvCommand = {
    id: crypto.randomUUID?.() || String(Math.random()).slice(2),
    name,
    target,
    at: Date.now(),
  };
  const ch = screenChannel(screenId);
  if (ch.state !== 'joined') {
    // subscribe() may only be called once per channel; otherwise just wait for the join.
    if (ch.state === 'closed') ch.subscribe();
    for (let i = 0; i < 30 && (ch.state as string) !== 'joined'; i++)
      await new Promise((r) => setTimeout(r, 100));
  }
  if (ch.state !== 'joined') throw Error('تعذّر الوصول إلى قناة الشاشة. تحقق من الاتصال.');
  const r = await ch.send({ type: 'broadcast', event: 'command', payload: cmd });
  if (r !== 'ok') throw Error('لم يُرسل الأمر. حاول مرة أخرى.');
  return cmd;
}

// ---------- Admin side: live status from TVs ----------
const statusListeners = new Map<string, Set<(s: DeviceStatus) => void>>();
/** Listen to status broadcasts from the TVs of one screen. Returns an unsubscribe function. */
export function onTvStatus(screenId: string, cb: (s: DeviceStatus) => void) {
  let set = statusListeners.get(screenId);
  if (!set) {
    const listeners = new Set<(s: DeviceStatus) => void>();
    set = listeners;
    statusListeners.set(screenId, listeners);
    const ch = screenChannel(screenId);
    ch.on('broadcast', { event: 'status' }, (m) => {
      const s = m.payload as DeviceStatus;
      if (s && typeof s.tag === 'string') listeners.forEach((l) => l(s));
    });
    if (ch.state === 'closed') ch.subscribe();
  }
  set.add(cb);
  return () => void set.delete(cb);
}
