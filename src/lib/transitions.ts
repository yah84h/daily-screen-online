import { useEffect, useState } from 'react';

/** The school's intro / loop / outro clips (cut from one video: 0–3 s, 3–12 s, 12–15 s). */
export type TransitionClips = { intro: string; loop: string; outro: string };

let pending: Promise<TransitionClips | null> | null = null;

/** Downloaded once into memory so a transition never waits on the network. */
export function loadTransitionClips(): Promise<TransitionClips | null> {
  pending ||= (async () => {
    try {
      const names = ['intro', 'loop', 'outro'] as const;
      const urls = await Promise.all(
        names.map(async (name) => {
          const response = await fetch('/transitions/' + name + '.mp4');
          if (!response.ok) throw Error(name);
          return URL.createObjectURL(await response.blob());
        }),
      );
      return { intro: urls[0], loop: urls[1], outro: urls[2] };
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
