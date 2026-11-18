import { useEffect, useRef, type ReactNode } from 'react';
import type { TransitionClips } from '@/lib/transitions';
import '@/transitions.css';

/** intro = the curtain sweeps in, loop = fully covered, outro = the curtain sweeps away. */
export type TransitionPhase = 'intro' | 'loop' | 'outro';

const SWEEP_MS = 1100;
const STEP = 4; // % of height per stair step
const AMPLITUDE = 9; // % of width
const PERIOD = 32; // % of height

/** Stepped zigzag edge (in %) around x = base, top to bottom. */
function edge(base: number): [number, number][] {
  const points: [number, number][] = [];
  for (let y = -STEP; y <= 100 + STEP; y += STEP) {
    const t = (((y / PERIOD) % 1) + 1) % 1;
    const tri = t < 0.5 ? t * 2 : 2 - t * 2;
    const x = base + Math.round((tri * AMPLITUDE) / 2) * 2;
    const last = points[points.length - 1];
    if (last) points.push([x, last[1]]);
    points.push([x, y]);
  }
  return points;
}
const polygon = (points: [number, number][]) =>
  'polygon(' + points.map(([x, y]) => `${x.toFixed(2)}% ${y}%`).join(', ') + ')';
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Region covered by the curtain when its edge is at `base` (moving right → left, RTL). */
function covering(base: number) {
  const e = edge(base);
  return {
    curtain: polygon([...e, [110, 110], [110, -10]]),
    rim: polygon([...e, ...edge(base + 1.6).reverse()]),
  };
}
/** Region still covered while the curtain leaves (the uncovered part grows from the right). */
function leaving(base: number) {
  const e = edge(base);
  return {
    curtain: polygon([...e, [-10, 110], [-10, -10]]),
    rim: polygon([...e, ...edge(base - 1.6).reverse()]),
  };
}

/**
 * The school loop video as a curtain with a stepped zigzag edge. It sweeps straight over
 * whatever is on screen (no fade to black), stays while the next thing prepares, then
 * sweeps away. The loop is already in memory, so it starts instantly.
 */
export function TransitionOverlay({
  clips,
  phase,
  onDone,
  content,
}: {
  clips: TransitionClips;
  /** What the curtain carries (the chosen standby screen); defaults to the school loop. */
  content?: ReactNode;
  phase: TransitionPhase | null;
  /** Called when the curtain has fully arrived (intro) or fully left (outro). */
  onDone: (phase: 'intro' | 'outro') => void;
}) {
  const curtain = useRef<HTMLDivElement>(null);
  const rim = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const c = curtain.current,
      r = rim.current,
      v = video.current;
    if (!c || !r) return;
    const set = (shape: { curtain: string; rim: string }, visible: boolean) => {
      c.style.clipPath = shape.curtain;
      r.style.clipPath = shape.rim;
      c.style.visibility = r.style.visibility = visible ? 'visible' : 'hidden';
    };
    if (!phase) {
      set(covering(120), false);
      v?.pause();
      return;
    }
    if (phase === 'loop') {
      set(covering(-20), true);
      void v?.play().catch(() => {});
      return;
    }
    if (phase === 'intro') {
      if (v) v.currentTime = 0;
      void v?.play().catch(() => {});
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / SWEEP_MS);
      const base = 112 - ease(t) * 132; // 112% → -20%
      set(phase === 'intro' ? covering(base) : leaving(base), phase === 'intro' || t < 1);
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        if (phase === 'outro') v?.pause();
        done.current(phase);
      }
    };
    frame = requestAnimationFrame(step);
    // Never get stuck if animation frames are throttled (hidden tab).
    const safety = setTimeout(() => {
      cancelAnimationFrame(frame);
      set(phase === 'intro' ? covering(-20) : leaving(-20), phase === 'intro');
      done.current(phase);
    }, SWEEP_MS + 2500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(safety);
    };
  }, [phase]);
  return (
    <div className={'transition-overlay' + (phase ? ' active' : '')} aria-hidden="true">
      <div ref={curtain} className="transition-curtain" data-phase={phase || ''}>
        {content ?? <video ref={video} src={clips.loop} muted loop playsInline preload="auto" />}
      </div>
      <div ref={rim} className="transition-rim" />
    </div>
  );
}
