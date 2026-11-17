import { useEffect, useRef, useState } from 'react';
import '@/show.css';
import { GraduationCap } from 'lucide-react';
import { useShowHost, type ShowPlayback } from '@/lib/show';
import { useTransitionClips } from '@/lib/transitions';
import { TransitionOverlay, type TransitionPhase } from './TransitionOverlay';
import { partKey, showReadiness, showSteps } from '../../local-test/show-state.mjs';
import type { School, Template } from '@/lib/types';

type Props = {
  screenId: string;
  token?: string;
  showKey: string;
  template: Template;
  school: School;
};

/** Presenting mode on the TV. Without a paired TV (admin preview) only the standby card shows. */
export function ShowPlayer({ screenId, token = '', showKey, template, school }: Props) {
  const logo = template.schoolLogo || school.logo_url || '';
  if (!screenId || !showKey) return <Standby logo={logo} title="وضع التقديم" note="" />;
  return <LiveShow screenId={screenId} token={token} showKey={showKey} logo={logo} />;
}

/** Calm audience-facing standby: no bars, no file names. Shared with PowerPoint mode. */
export function Standby({
  logo,
  title,
  note,
  photo = '',
  loop = '',
}: {
  logo: string;
  title: string;
  note: string;
  /** The presenter's own background photo. */
  photo?: string;
  /** The school loop clip (it already shows the logo). */
  loop?: string;
}) {
  const kind = photo ? ' with-photo' : loop ? ' with-loop' : '';
  return (
    <div className={'screen show-screen show-standby' + kind} dir="rtl">
      {photo ? (
        <img className="show-standby-bg" src={photo} alt="" />
      ) : loop ? (
        <video className="show-standby-bg" src={loop} autoPlay muted loop playsInline />
      ) : null}
      <div className="show-standby-card">
        {!loop || photo ? (
          logo ? (
            <img src={logo} alt="" />
          ) : (
            <GraduationCap size={96} strokeWidth={1.4} />
          )
        ) : null}
        {title && <h1>{title}</h1>}
      </div>
      {note && <small className="show-standby-note">{note}</small>}
    </div>
  );
}

function LiveShow({
  screenId,
  token,
  showKey,
  logo,
}: {
  screenId: string;
  token: string;
  showKey: string;
  logo: string;
}) {
  const { show, urls, stored, videoCommand, reportPlayback, advance, command } = useShowHost(
    screenId,
    showKey,
    token,
  );
  const steps = showSteps(show.items);
  const step = steps[Math.min(show.step, Math.max(0, steps.length - 1))];
  const url = step ? urls[partKey(step.item, step.part)] : '';
  const ready = showReadiness(show.items, stored);
  const live = show.phase === 'live' && !!step && !!url;
  const settings = show.settings;
  const clips = useTransitionClips(true);
  const photo = show.background ? urls[partKey(show.background.id)] || '' : '';
  // Start plays the outro (from the resting logo frame) into the first file;
  // standby/end plays the intro back to the resting loop.
  const [transition, setTransition] = useState<TransitionPhase | null>(null);
  const previous = useRef(show.phase);
  useEffect(() => {
    const was = previous.current;
    previous.current = show.phase;
    if (!clips || was === show.phase) return;
    if (show.phase === 'live') setTransition('outro');
    else if (was === 'live') setTransition('intro');
  }, [show.phase, clips]);
  // Presenter clicker / keyboard plugged into the TV.
  const keys = useRef({ show, ready, last: steps.length - 1 });
  keys.current = { show, ready, last: steps.length - 1 };
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const { show: s, ready: r, last } = keys.current;
      const next = ['ArrowRight', 'ArrowDown', 'PageDown', 'Enter', ' '].includes(e.key);
      const back = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key);
      let cmd: Parameters<typeof command>[0] | null = null;
      if (s.phase === 'live') {
        if (next) cmd = { op: 'next' };
        else if (back) cmd = { op: 'previous' };
        else if (e.key === 'Home') cmd = { op: 'goto', index: 0 };
        else if (e.key === 'End') cmd = { op: 'goto', index: Math.max(0, last) };
        else if (['b', 'B', '.'].includes(e.key)) cmd = { op: 'blackout' };
      } else if (s.phase === 'paused' && next) cmd = { op: 'resume' };
      else if (s.phase === 'standby' && next && r.complete) cmd = { op: 'start' };
      if (!cmd) return;
      e.preventDefault();
      command(cmd);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [command]);
  const overlay = clips && (
    <TransitionOverlay
      clips={clips}
      phase={transition}
      onDone={(phase) => setTransition((current) => (current === phase ? null : current))}
    />
  );
  // Images move on by themselves only when auto-advance is on (and the screen isn't blacked out).
  useEffect(() => {
    if (!live || step.kind !== 'image' || !settings?.autoNext || show.blackout) return;
    const timer = setTimeout(advance, (settings.imageSeconds || 10) * 1000);
    return () => clearTimeout(timer);
  }, [
    live,
    step?.item,
    step?.part,
    step?.kind,
    settings?.autoNext,
    settings?.imageSeconds,
    show.blackout,
    show.revision,
    advance,
  ]);
  useEffect(() => {
    if (!live || step.kind !== 'video') reportPlayback(null);
  }, [live, step?.kind, step?.item, reportPlayback]);
  if (!live)
    return (
      <>
        <Standby
          logo={logo}
          title={show.title}
          photo={photo}
          loop={clips?.loop || ''}
          note={
            show.phase === 'live' && step && !url
              ? '…'
              : ready.total
                ? (ready.complete ? '● ' : '○ ') + ready.ready + '/' + ready.total
                : ''
          }
        />
        {overlay}
      </>
    );
  return (
    <div className="screen show-screen" dir="rtl">
      <div className="show-layer" key={step.item + ':' + step.part}>
        {step.kind === 'video' ? (
          <ShowVideo
            src={url}
            command={videoCommand}
            onReport={reportPlayback}
            onEnded={() => settings?.autoNext && advance()}
          />
        ) : (
          <img src={url} alt="" draggable={false} />
        )}
      </div>
      <div className={'show-blackout' + (show.blackout ? ' on' : '')} aria-hidden="true" />
      {overlay}
    </div>
  );
}

const VOLUME_KEY = 'daily-screen-show-volume';
function savedVolume() {
  try {
    const v = JSON.parse(localStorage.getItem(VOLUME_KEY) || '{}');
    return {
      volume: Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : 1,
      muted: v.muted === true,
    };
  } catch {
    return { volume: 1, muted: false };
  }
}

function ShowVideo({
  src,
  command,
  onReport,
  onEnded,
}: {
  src: string;
  command: ReturnType<typeof useShowHost>['videoCommand'];
  onReport: (p: ShowPlayback | null) => void;
  onEnded: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [mountedAt] = useState(Date.now());
  const report = useRef(onReport);
  report.current = onReport;
  const send = () => {
    const el = video.current;
    if (!el) return;
    report.current({
      time: el.currentTime || 0,
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      paused: el.paused || el.ended,
      muted: el.muted,
      volume: el.volume,
    });
  };
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const saved = savedVolume();
    element.volume = saved.volume;
    element.muted = saved.muted;
    // Kiosk launches allow sound; if a browser blocks it, play silently rather than freeze.
    element.play().catch(() => {
      element.muted = true;
      void element.play().catch(() => {});
    });
    const timer = setInterval(send, 1000);
    return () => clearInterval(timer);
  }, [src]);
  useEffect(() => {
    const el = video.current;
    if (!el || !command || command.at < mountedAt) return;
    const value = command.value;
    const play = () => void el.play().catch(() => {});
    switch (command.action) {
      case 'restart':
        el.currentTime = 0;
        play();
        break;
      case 'play':
        play();
        break;
      case 'pause':
        el.pause();
        break;
      case 'toggle':
        if (el.paused || el.ended) play();
        else el.pause();
        break;
      case 'seek':
        if (typeof value === 'number')
          el.currentTime = Math.max(0, Math.min(el.duration || 0, value));
        break;
      case 'skip':
        if (typeof value === 'number')
          el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + value));
        break;
      case 'volume':
        if (typeof value === 'number') {
          el.volume = Math.max(0, Math.min(1, value));
          if (el.volume > 0) el.muted = false;
        }
        break;
      case 'mute':
        el.muted = typeof value === 'boolean' ? value : !el.muted;
        break;
    }
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume: el.volume, muted: el.muted }));
    } catch {}
    send();
  }, [command, mountedAt]);
  return (
    <video
      ref={video}
      src={src}
      playsInline
      preload="auto"
      onPlay={send}
      onPause={send}
      onSeeked={send}
      onVolumeChange={send}
      onLoadedMetadata={send}
      onEnded={() => {
        send();
        onEnded();
      }}
    />
  );
}
