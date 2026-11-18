import { useSyncExternalStore } from 'react';

/**
 * Browsers that block sound until someone touches the page make videos fall back to muted.
 * Those videos are remembered here and get their sound back on the first tap or key press.
 * (The kiosk launcher and the Windows player allow sound, so this never triggers there.)
 */
const blocked = new Set<HTMLMediaElement>();
const listeners = new Set<() => void>();
let listening = false;
const emit = () => listeners.forEach((fn) => fn());

function unlock() {
  for (const el of blocked) {
    el.muted = false;
    void el.play().catch(() => {});
  }
  blocked.clear();
  emit();
}

/** Mark a media element as muted only because the browser blocked sound. */
export function soundBlocked(el: HTMLMediaElement) {
  el.muted = true;
  blocked.add(el);
  if (!listening) {
    listening = true;
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }
  emit();
}

/** The element left the screen (or was unmuted another way). */
export function soundReleased(el: HTMLMediaElement) {
  if (blocked.delete(el)) emit();
}

export function useSoundBlocked() {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => {
      // Forget videos that have left the screen.
      for (const el of blocked) if (!el.isConnected) blocked.delete(el);
      return blocked.size > 0;
    },
    () => false,
  );
}
