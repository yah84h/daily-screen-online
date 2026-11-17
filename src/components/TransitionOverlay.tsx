import { useEffect, useRef } from 'react';
import type { TransitionClips } from '@/lib/transitions';
import '@/transitions.css';

export type TransitionPhase = 'intro' | 'loop' | 'outro';

/**
 * Full-screen intro → loop → outro. All three clips stay mounted (already in memory),
 * so switching between them is instant; only the active one is visible and playing.
 */
export function TransitionOverlay({
  clips,
  phase,
  onDone,
}: {
  clips: TransitionClips;
  phase: TransitionPhase | null;
  /** Called when the intro or outro clip finishes. */
  onDone: (phase: 'intro' | 'outro') => void;
}) {
  const refs = {
    intro: useRef<HTMLVideoElement>(null),
    loop: useRef<HTMLVideoElement>(null),
    outro: useRef<HTMLVideoElement>(null),
  };
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    for (const name of ['intro', 'loop', 'outro'] as const) {
      const video = refs[name].current;
      if (!video) continue;
      if (name === phase) {
        video.currentTime = 0;
        void video.play().catch(() => {
          if (name !== 'loop') done.current(name); // never get stuck on a clip
        });
      } else video.pause();
    }
    // A clip that never reports "ended" (stalled decoder) must not trap the screen.
    if (phase === 'intro' || phase === 'outro') {
      const timer = setTimeout(() => done.current(phase), 6000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  return (
    <div className={'transition-overlay' + (phase ? ' active' : '')} aria-hidden="true">
      {(['intro', 'loop', 'outro'] as const).map((name) => (
        <video
          key={name}
          ref={refs[name]}
          src={clips[name]}
          muted
          playsInline
          preload="auto"
          loop={name === 'loop'}
          data-phase={name}
          className={name === phase ? 'on' : ''}
          onEnded={() => name !== 'loop' && name === phase && done.current(name)}
        />
      ))}
    </div>
  );
}
