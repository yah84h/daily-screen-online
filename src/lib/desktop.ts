/** Bridge to the Windows player (desktop/). Absent in normal browsers, where nothing changes. */
type DesktopBridge = {
  version: string;
  prepareMedia(
    url: string,
    options: {
      kind?: 'audio' | 'video' | 'image';
      onProgress?: (loaded: number, total: number) => void;
    },
  ): Promise<{ url: string; size: number; type: string }>;
  forgetMedia(url: string, options?: { explicit: boolean }): Promise<void>;
  clearMediaCache?(): Promise<void>;
};
declare global {
  interface Window {
    ezaatiDesktop?: DesktopBridge;
  }
}
export const desktop: DesktopBridge | undefined =
  typeof window !== 'undefined' ? window.ezaatiDesktop : undefined;

/** Downloads to the player's disk folder and returns a local streaming URL, or null in a browser. */
export async function desktopMedia(
  url: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
  kind?: 'audio' | 'video' | 'image',
) {
  if (!desktop) return null;
  signal.throwIfAborted();
  const result = await Promise.race([
    desktop.prepareMedia(url, { kind, onProgress }),
    new Promise<never>((_, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
    ),
  ]);
  signal.throwIfAborted();
  return result;
}
