// Pure helpers for TV stability and remote control. No imports, so node tests can load this file directly.

/** Delay before the next poll: the normal interval on success, doubling on failure up to a cap, with ±20% jitter. */
export function backoffDelay(
  failures: number,
  base = 5_000,
  max = 60_000,
  random = Math.random,
): number {
  if (failures <= 0) return base;
  const raw = Math.min(max, base * 2 ** Math.min(failures, 10));
  return Math.round(raw * (0.8 + random() * 0.4));
}

/** Counts events inside a sliding time window. */
export function createWindowCounter(windowMs: number) {
  let times: number[] = [];
  return {
    add(now = Date.now()) {
      times = times.filter((t) => now - t < windowMs);
      times.push(now);
      return times.length;
    },
    count(now = Date.now()) {
      times = times.filter((t) => now - t < windowMs);
      return times.length;
    },
    reset() {
      times = [];
    },
  };
}

export type TvCommandName = 'reload' | 'restart' | 'blackout' | 'wake' | 'ping';
export type TvCommand = {
  id: string;
  name: TvCommandName;
  /** tokenTag() of the device, or 'all' for every TV paired to the screen. */
  target: string;
  at: number;
};

const NAMES: TvCommandName[] = ['reload', 'restart', 'blackout', 'wake', 'ping'];

/** Validate an untrusted command payload and decide whether this TV must act on it. */
export function acceptCommand(
  raw: unknown,
  token: string,
  seen: Set<string>,
  now = Date.now(),
  maxAgeMs = 10 * 60_000,
): TvCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<TvCommand>;
  if (typeof c.id !== 'string' || !c.id || seen.has(c.id)) return null;
  if (!NAMES.includes(c.name as TvCommandName)) return null;
  if (c.target !== 'all' && c.target !== tokenTag(token)) return null;
  if (typeof c.at !== 'number' || now - c.at > maxAgeMs || c.at - now > 60_000) return null;
  seen.add(c.id);
  return c as TvCommand;
}

/** Short, display-safe token identifier (never show the full secret token). */
export const tokenTag = (token: string) => (token ? token.slice(0, 6) : '');

export type DeviceStatus = {
  tag: string;
  version: string;
  mode: string;
  online: boolean;
  blackout: boolean;
  failures: number;
  errors: { at: number; message: string }[];
  startedAt: number;
  at: number;
  userAgent?: string;
};
