import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { loopAppearance } from '@/lib/loopAppearance';
import { Screen } from './Screen';
import { initialContent, type Content } from '@/lib/types';
import '@/show.css';
import { GraduationCap } from 'lucide-react';
import { useShowHost, type ShowPlayback } from '@/lib/show';
import { soundBlocked } from '@/lib/sound';
import { useTransitionClips } from '@/lib/transitions';
import { TransitionOverlay, type TransitionPhase } from './TransitionOverlay';
import { endRule, partKey, showReadiness, showSteps } from '../../local-test/show-state.mjs';
import type { School, Template } from '@/lib/types';

type Props = {
  screenId: string;
  token?: string;
  showKey: string;
  template: Template;
  school: School;
  content?: Content;
};

/** Presenting mode on the TV. Without a paired TV (admin preview) only the standby card shows. */
export function ShowPlayer({ screenId, token = '', showKey, template, school, content }: Props) {
  const logo = template.schoolLogo || school.logo_url || '';
  if (!screenId || !showKey) return <Standby logo={logo} title="وضع التقديم" note="" />;
  // Palette colors for the classes-background wallpaper option.
  const palette = Object.fromEntries(
    Object.entries(loopAppearance(template.loopAppearance)).map(([k, v]) => ['--loop-' + k, v]),
  ) as CSSProperties;
  return (
    <LiveShow
      screenId={screenId}
      token={token}
      showKey={showKey}
      logo={logo}
      palette={palette}
      classes={
        // The classes background exactly as set in «الخلفية والساعة».
        <Screen
          content={content || initialContent}
          template={{ ...template, displayMode: 'loop', rotation: { enabled: false } as never }}
          school={school}
          large
        />
      }
    />
  );
}

/** Calm audience-facing standby: no bars, no file names. Shared with PowerPoint mode. */
export function Standby({
  logo,
  title,
  note,
  photo = '',
  photoKind = 'image',
  loop = '',
  classes,
}: {
  logo: string;
  title: string;
  note: string;
  /** The presenter's own full-screen background: photo / GIF, or a video that loops. */
  photo?: string;
  photoKind?: 'image' | 'video';
  /** The school loop clip (it already shows the logo). */
  loop?: string;
  /** The classes background (clock, classes, boards) as set in «الخلفية والساعة». */
  classes?: ReactNode;
}) {
  if (classes) return <>{classes}</>;
  const kind = photo ? ' with-photo' : loop ? ' with-loop' : '';
  return (
    <div
      className={'screen show-screen show-standby' + kind + (title ? ' has-title' : '')}
      dir="rtl"
    >
      {photo ? (
        photoKind === 'video' ? (
          <video className="show-standby-bg" src={photo} autoPlay muted loop playsInline />
        ) : (
          <img className="show-standby-bg" src={photo} alt="" />
        )
      ) : loop ? (
        <video className="show-standby-bg" src={loop} autoPlay muted loop playsInline />
      ) : null}
      <div className="show-standby-card">
        {!loop && !photo ? (
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
  classes,
}: {
  screenId: string;
  token: string;
  showKey: string;
  logo: string;
  palette?: CSSProperties;
  classes: ReactNode;
}) {
  const { show, urls, stored, progress, videoCommand, reportPlayback, command } = useShowHost(
    screenId,
    showKey,
    token,
  );
  const steps = showSteps(show.items);
  const step = steps[Math.min(show.step, Math.max(0, steps.length - 1))];
  const url = step ? urls[partKey(step.item, step.part)] : '';
  const ready = showReadiness(show.items, stored);
  // A break item shows the standby (starter) screen in the middle of the show.
  const onBreak = show.phase === 'live' && step?.kind === 'break';
  const live = show.phase === 'live' && !!step && !!url && !onBreak;
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
  // Reaching a break: curtain over the last file, then the starter screen; leaving it: reveal.
  const wasBreak = useRef(onBreak);
  useEffect(() => {
    const was = wasBreak.current;
    wasBreak.current = onBreak;
    if (!clips || was === onBreak || show.phase !== 'live') return;
    setTransition(onBreak ? 'intro' : 'outro');
  }, [onBreak, clips, show.phase]);
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
  // The curtain carries the chosen standby screen (not the old logo loop unless it is chosen).
  const standbyKind = show.background?.kind;
  const curtainContent =
    standbyKind === 'wallpaper' ? (
      classes
    ) : photo ? (
      standbyKind === 'video' ? (
        <video className="curtain-fill" src={photo} autoPlay muted loop playsInline />
      ) : (
        <img className="curtain-fill" src={photo} alt="" />
      )
    ) : undefined;
  const overlay = clips && (
    <TransitionOverlay
      clips={clips}
      content={curtainContent}
      phase={transition}
      onDone={(phase) => {
        // Between files: once the curtain covers the old file, sweep it away over the new one.
        if (phase === 'intro' && switching.current) {
          switching.current = false;
          setTransition('outro');
        } else if (phase === 'intro')
          // Let the standby's own video draw its first frame before the curtain lifts.
          setTimeout(() => setTransition((current) => (current === 'intro' ? null : current)), 450);
        else setTransition((current) => (current === phase ? null : current));
      }}
    />
  );
  // The current file's end rule (per file, or the show's auto-advance).
  const item = step ? show.items.find((entry) => entry.id === step.item) : undefined;
  const lastPart = !!step && (!steps[show.step + 1] || steps[show.step + 1].item !== step.item);
  const rule = lastPart ? endRule(show, item) : settings?.autoNext ? 'next' : 'stay';
  const finish = useCallback(() => command({ op: 'finish' }), [command]);
  // Images (and PowerPoint slides) move on by themselves after their time when a rule says so.
  useEffect(() => {
    if (onBreak && rule !== 'stay') {
      const timer = setTimeout(finish, (settings?.imageSeconds || 10) * 1000);
      return () => clearTimeout(timer);
    }
    if (!live || step.kind !== 'image' || rule === 'stay' || show.blackout) return;
    const timer = setTimeout(finish, (settings?.imageSeconds || 10) * 1000);
    return () => clearTimeout(timer);
  }, [
    live,
    step?.item,
    step?.part,
    step?.kind,
    rule,
    settings?.imageSeconds,
    show.blackout,
    show.revision,
    finish,
    onBreak,
  ]);
  // Keep the last file on screen while the curtain sweeps over it (end / back to standby).
  // What is on screen. The last file stays under the curtain while it sweeps in
  // (back to standby, end, or switching to another file).
  const held = useRef<{ step: NonNullable<typeof step>; url: string } | null>(null);
  const wasLive = useRef(false);
  const switching = useRef(false);
  // A different file (video / photo / whole PowerPoint) → curtain in, then out over the new one.
  // Slides inside one PowerPoint keep the quick fade.
  if (
    clips &&
    live &&
    wasLive.current &&
    held.current &&
    held.current.step.item !== step.item &&
    !switching.current &&
    transition === null
  ) {
    switching.current = true;
    setTransition('intro');
  }
  if (live && !switching.current) held.current = { step, url };
  wasLive.current = live;
  const shown = switching.current
    ? held.current
    : live
      ? { step, url }
      : transition === 'intro'
        ? held.current
        : null;
  useEffect(() => {
    if (!live || step.kind !== 'video') reportPlayback(null);
  }, [live, step?.kind, step?.item, reportPlayback]);
  // Before the show: a full preparation page, then a short "ready" moment, then the standby.
  const [readyAt, setReadyAt] = useState(0);
  useEffect(() => {
    if (ready.complete) setReadyAt((at) => at || Date.now());
    else setReadyAt(0);
  }, [ready.complete]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!readyAt) return;
    const timer = setTimeout(() => tick((n) => n + 1), 4000);
    return () => clearTimeout(timer);
  }, [readyAt]);
  const preparing =
    show.phase === 'standby' &&
    show.settings?.loadingPage !== false &&
    ready.total > 0 &&
    (!ready.complete || Date.now() - readyAt < 4000);
  if (preparing)
    return (
      <LoadingPage
        title={show.title}
        logo={logo}
        items={show.items}
        stored={stored}
        progress={progress}
        done={ready.complete}
      />
    );
  if (!shown)
    return (
      <>
        <Standby
          logo={logo}
          title={show.title}
          photo={photo}
          photoKind={show.background?.kind === 'video' ? 'video' : 'image'}
          classes={show.background?.kind === 'wallpaper' ? classes : undefined}
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
      <div
        // Under a curtain the curtain does the reveal: no extra fade from black.
        className={'show-layer' + (transition ? ' no-fade' : '')}
        key={shown.step.item + ':' + shown.step.part}
      >
        {shown.step.kind === 'video' ? (
          <ShowVideo
            src={shown.url}
            command={videoCommand}
            onReport={reportPlayback}
            lead={live && !switching.current && rule !== 'stay' ? item?.lead || 0 : 0}
            onFinish={() => live && !switching.current && finish()}
            frozen={!live || switching.current}
            hold={transition !== null}
          />
        ) : (
          <img src={shown.url} alt="" draggable={false} />
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
  lead,
  onFinish,
  frozen = false,
  hold = false,
}: {
  src: string;
  command: ReturnType<typeof useShowHost>['videoCommand'];
  onReport: (p: ShowPlayback | null) => void;
  /** Hand over this many seconds before the end (0 = when it ends). */
  lead: number;
  onFinish: () => void;
  /** Leaving (under the curtain): stop at once, silently, instead of playing on. */
  frozen?: boolean;
  /** A curtain is moving: wait on the current frame, start once it has gone. */
  hold?: boolean;
}) {
  const finished = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const [mountedAt] = useState(Date.now());
  useEffect(() => {
    const el = video.current;
    if (!frozen || !el) return;
    el.muted = true;
    el.pause();
  }, [frozen]);
  // Kiosk launches allow sound; if a browser blocks it, play silently rather than not at all.
  const start = (element: HTMLVideoElement) =>
    element.play().catch(() => {
      soundBlocked(element);
      void element.play().catch(() => {});
    });
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
    // Wait on the first frame while a curtain is still moving; the hold effect starts it.
    if (!held.current) start(element);
    const timer = setInterval(send, 1000);
    return () => clearInterval(timer);
  }, [src]);
  // Freeze on the current frame during a transition; play as soon as the curtain has gone.
  const held = useRef(hold);
  held.current = hold;
  useEffect(() => {
    const el = video.current;
    if (!el || frozen) return;
    if (hold) el.pause();
    else if (el.paused && !el.ended && !finished.current) start(el);
  }, [hold, frozen]);
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
      onTimeUpdate={(e) => {
        const el = e.currentTarget;
        if (!lead || finished.current || !el.duration || el.duration - el.currentTime > lead)
          return;
        finished.current = true;
        onFinish();
      }}
      onEnded={() => {
        send();
        if (finished.current) return;
        finished.current = true;
        onFinish();
      }}
    />
  );
}

/** Full-screen preparation page: what the TV is saving, before the show starts. */
function LoadingPage({
  title,
  logo,
  items,
  stored,
  progress,
  done,
}: {
  title: string;
  logo: string;
  items: ReturnType<typeof useShowHost>['show']['items'];
  stored: Record<string, boolean>;
  progress: ReturnType<typeof useShowHost>['progress'];
  done: boolean;
}) {
  const rows = items
    .filter((item) => item.kind !== 'break')
    .map((item) => {
      const parts = item.kind === 'deck' ? item.parts : 1;
      let have = 0;
      for (let part = 0; part < parts; part++) if (stored[partKey(item.id, part)]) have++;
      const live = progress[item.id];
      const fraction =
        have === parts
          ? 1
          : live?.total
            ? Math.min(
                0.99,
                item.source === 'link' ? live.loaded / live.total : live.loaded / parts,
              )
            : have / parts;
      return { item, fraction, error: live?.error, done: have === parts };
    });
  const overall = rows.reduce((sum, row) => sum + row.fraction, 0) / Math.max(1, rows.length);
  const kind = { video: 'فيديو', image: 'صورة', deck: 'PowerPoint', break: 'استراحة' } as const;
  return (
    <div className={'screen show-screen show-loading' + (done ? ' done' : '')} dir="rtl">
      <div className="show-loading-head">
        {logo ? <img src={logo} alt="" /> : <GraduationCap size={64} strokeWidth={1.4} />}
        <div>
          <small>{done ? 'كل شيء جاهز' : 'تجهيز العرض على هذا الجهاز'}</small>
          <h1>{title || 'وضع التقديم'}</h1>
        </div>
        <b dir="ltr">{Math.floor(overall * 100)}%</b>
      </div>
      <div className="show-loading-bar">
        <i style={{ width: overall * 100 + '%' }} />
      </div>
      <ol className="show-loading-list">
        {rows.map(({ item, fraction, error, done: ok }) => (
          <li key={item.id} className={ok ? 'ok' : error ? 'error' : ''}>
            <span className="show-loading-kind">{kind[item.kind]}</span>
            <bdi>{item.name}</bdi>
            <span className="show-loading-state">
              {ok
                ? '✓'
                : error
                  ? 'تعذر'
                  : Math.floor(fraction * 100) +
                    '%' +
                    (item.kind === 'deck' ? ` · ${item.parts} شريحة` : '')}
            </span>
            <span className="show-loading-row-bar">
              <i style={{ width: fraction * 100 + '%' }} />
            </span>
          </li>
        ))}
      </ol>
      <small className="show-loading-foot">
        {done
          ? 'ينتقل إلى شاشة الانتظار الآن. ابدأ العرض من الجوال.'
          : 'يُحفظ كل شيء على هذا الجهاز قبل البدء. يمكن إخفاء هذه الصفحة من إعدادات التشغيل في الجوال.'}
      </small>
    </div>
  );
}
