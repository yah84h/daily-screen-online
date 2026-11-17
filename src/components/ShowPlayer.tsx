import { useEffect, useRef, useState } from 'react';
import '@/show.css';
import { GraduationCap } from 'lucide-react';
import { useShowHost } from '@/lib/show';
import { partKey, showReadiness, showSteps } from '../../local-test/show-state.mjs';
import type { School, Template } from '@/lib/types';

type Props = { screenId: string; showKey: string; template: Template; school: School };

/** Presenting mode on the TV. Without a paired TV (admin preview) only the standby card shows. */
export function ShowPlayer({ screenId, showKey, template, school }: Props) {
  const logo = template.schoolLogo || school.logo_url || '';
  if (!screenId || !showKey) return <Standby logo={logo} title="وضع التقديم" note="" />;
  return <LiveShow screenId={screenId} showKey={showKey} logo={logo} />;
}

function Standby({ logo, title, note }: { logo: string; title: string; note: string }) {
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
  showKey,
  logo,
}: {
  screenId: string;
  showKey: string;
  logo: string;
}) {
  const { show, urls, stored, videoCommand } = useShowHost(screenId, showKey);
  const steps = showSteps(show.items);
  const step = steps[Math.min(show.step, Math.max(0, steps.length - 1))];
  const url = step ? urls[partKey(step.item, step.part)] : '';
  const ready = showReadiness(show.items, stored);
  if (show.phase !== 'live' || !step || !url)
    return (
      <Standby
        logo={logo}
        title={show.title}
        note={
          show.phase === 'live' && step && !url
            ? 'جارٍ تجهيز هذا الملف…'
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
          <ShowVideo src={url} command={videoCommand} />
        ) : (
          <img src={url} alt="" draggable={false} />
        )}
      </div>
    </div>
  );
}

function ShowVideo({
  src,
  command,
}: {
  src: string;
  command: ReturnType<typeof useShowHost>['videoCommand'];
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [mountedAt] = useState(Date.now());
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.muted = false;
    // Kiosk launches allow sound; if a browser blocks it, play silently rather than freeze.
    element.play().catch(() => {
      element.muted = true;
      void element.play().catch(() => {});
    });
  }, [src]);
  useEffect(() => {
    const element = video.current;
    if (!element || !command || command.at < mountedAt) return;
    if (command.action === 'restart') {
      element.currentTime = 0;
      void element.play().catch(() => {});
    } else if (element.paused || element.ended) void element.play().catch(() => {});
    else element.pause();
  }, [command, mountedAt]);
  return <video ref={video} src={src} playsInline preload="auto" />;
}
