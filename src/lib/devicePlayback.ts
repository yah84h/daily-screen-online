import { useSyncExternalStore } from 'react';
type DevicePlayback = {
  paused: boolean;
  volume: number;
  downloadsPaused: boolean;
  remoteActive?: boolean;
};
const listeners = new Set<() => void>();
let state: DevicePlayback = { paused: false, volume: 1, downloadsPaused: false };
try {
  const saved = JSON.parse(localStorage.getItem('daily-screen-master-playback') || '{}');
  state.volume = Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 1;
} catch {
  /* Browser storage is optional. */
}
export function changeDevicePlayback(patch: Partial<DevicePlayback>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem('daily-screen-master-playback', JSON.stringify({ volume: state.volume }));
  } catch {
    /* Keep controls usable without storage. */
  }
  listeners.forEach((listener) => listener());
}
export function useDevicePlayback() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
