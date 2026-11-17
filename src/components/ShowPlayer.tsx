import { useEffect, useRef, useState } from 'react';
import '@/show.css';
import { GraduationCap } from 'lucide-react';
import { useShowHost, type ShowPlayback } from '@/lib/show';
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
export function Standby({ logo, title, note }: { logo: string; title: string; note: string }) {
  return (
    <div className="screen show-screen show-standby" dir="rtl">
      <div className="show-standby-card">
        {logo ? <img src={logo} alt="" /> : <GraduationCap size={96} strokeWidth={1.4} />}
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
  const { show, urls, stored, videoCommand, reportPlayback, advance } = useShowHost(
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
      <Standby
        logo={logo}
        title={show.title}
        note={
          show.phase === 'live' && step && !url
            ? '…'
            : ready.total
              ? (ready.complete ? '● ' : '○ ') + ready.ready + '/' + ready.total
              : ''
        }
      />
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
