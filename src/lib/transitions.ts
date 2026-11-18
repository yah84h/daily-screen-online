import { useEffect, useState } from 'react';

/** The school loop clip (3–12 s of the school video): standby background and transition curtain. */
export type TransitionClips = { loop: string };

let pending: Promise<TransitionClips | null> | null = null;

/** Downloaded once into memory so a transition never waits on the network. */
export function loadTransitionClips(): Promise<TransitionClips | null> {
  pending ||= (async () => {
    try {
      const response = await fetch('/transitions/loop.mp4');
      if (!response.ok) throw Error('loop');
      return { loop: URL.createObjectURL(await response.blob()) };
    } catch {
      pending = null; // try again next time
      return null;
    }
  })();
  return pending;
}

export function useTransitionClips(enabled: boolean) {
  const [clips, setClips] = useState<TransitionClips | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadTransitionClips().then((value) => active && setClips(value));
    return () => {
      active = false;
    };
  }, [enabled]);
  return enabled ? clips : null;
}
