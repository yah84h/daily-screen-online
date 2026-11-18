import { activeCustomDay } from '@/lib/customDays';
import { loopLayout } from '@/lib/loopLayouts';
import { rotationOptions } from '../../local-test/rotation.mjs';
import { useDevicePlayback } from '@/lib/devicePlayback';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Screen } from './Screen';
import { waitForMediaReady } from '@/lib/mediaReadiness';
import { prepareAsset, removeShowAsset, SHOW_LIMIT } from '@/lib/assetCache';
import { useCacheTask } from '@/lib/cacheStatus';
import { useAutoHide } from '@/lib/autoHide';
import { useTransitionClips } from '@/lib/transitions';
import { TransitionOverlay, type TransitionPhase } from './TransitionOverlay';

/** Transitions play only between the big everyday modes, never for PowerPoint/photos/shows. */
const BIG_MODES = ['daily', 'media', 'loop'];
const modeOf = (p: { template: Partial<Template> }) => p.template.displayMode || 'daily';
const LOOP_LIMIT_MS = 90000;
import type { Content, School, Template } from '@/lib/types';
import type { PresentationContext } from '@/lib/presentation';
type Props = {
  content: Content;
  template: Partial<Template>;
  school: School;
  large: boolean;
  presentationContext: PresentationContext;
};
type Display = { props: Props; release: () => void };
type PreparationStatus = { loaded: number; total: number; error?: string; name?: string };

export function PreparedDisplay(props: Props) {
  const { downloadsPaused } = useDevicePlayback();
  // Select the media to prepare; ordinary content stays visible in the meantime.
  const queue = props.content.videoPlaylist?.enabled ? props.content.videoPlaylist.items : [];
  const sources = getPreparationSources(props.content, props.template);
  const signature = JSON.stringify([
    sources,
    queue.map((item) => item.type),
    props.content.fullType,
    props.content.imageType,
  ]);
  const latest = useRef(props);
  latest.current = props;
  const [note, setNote] = useState('');
  const [display, setDisplay] = useState<Display | null>(null);
  const [status, setStatus] = useState<PreparationStatus | null>(null);
  const [retry, setRetry] = useState(0);
  const visible = useRef<Props | null>(null);
  const active = useRef<Display | null>(null);
  const preparedKey = useRef('');
  // A layout whose media failed to prepare is still shown, streaming its original URLs.
  const [failedKey, setFailedKey] = useState('');
  const pendingStatus: PreparationStatus | null =
    status ||
    (downloadsPaused && preparedKey.current !== signature && sources.length
      ? { loaded: 0, total: sources.length }
      : null);
  useCacheTask(
    pendingStatus
      ? {
          label:
            (downloadsPaused ? 'التنزيل متوقف · ' : 'تجهيز وسائط العرض · ') +
            (pendingStatus.name || (queue.length ? 'قائمة التشغيل' : 'الملف التالي')),
          ...pendingStatus,
        }
      : note
        ? { label: note, loaded: 1, total: 1 }
        : null,
  );
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(''), 8000);
    return () => clearTimeout(timer);
  }, [note]);
  // Prepare a replacement without interrupting the currently adopted display.
  useEffect(() => {
    if (
      (downloadsPaused && sources.length > 0) ||
      (preparedKey.current === signature && active.current)
    )
      return;
    const controller = new AbortController();
    const urls: string[] = [];
    let adopted = false;
    let stalled = false;
    let lastProgress = Date.now();
    // A download that stops progressing (e.g. a hung proxy) must not block the switch forever.
    const watchdog = setInterval(() => {
      if (Date.now() - lastProgress > STALL_MS) {
        stalled = true;
        controller.abort();
      }
    }, 5000);
    const release = () => urls.forEach((url) => URL.revokeObjectURL(url));
    setNote('');
    setStatus(sources.length ? { loaded: 0, total: sources.length } : null);
    async function prepare() {
      try {
        if (sources.length > 30) throw Error('الحد الأقصى للقائمة ٣٠ ملفًا.');
        const mapping = new Map<string, string>();
        let bytes = 0;
        let persistent = true;
        for (let i = 0; i < sources.length; i++) {
          const source = sources[i];
          const name =
            queue.find((item) => item.url === source)?.name ||
            (source === props.content.image ? 'وسائط الشاشة اليومية' : 'الملف التالي');
          if (mapping.has(source)) {
            setStatus({ loaded: i + 1, total: sources.length, name });
            continue;
          }
          const result = await prepareAsset(source, controller.signal, (loaded, total) => {
            lastProgress = Date.now();
            if (!controller.signal.aborted)
              setStatus({ loaded: i + (total ? loaded / total : 0), total: sources.length, name });
          });
          persistent = persistent && result.persistent;
          bytes += result.localUrl ? 0 : result.size;
          if (bytes > SHOW_LIMIT)
            throw Error('قائمة التشغيل أكبر من ٢ جيجابايت. قسّم العرض إلى قوائم أصغر.');
          const url = result.localUrl || URL.createObjectURL(result.blob);
          urls.push(url);
          mapping.set(source, url);
          // Decode images and check video metadata before replacing the on-screen content.
          const item = queue.find((item) => item.url === source);
          const type =
            item?.type ||
            (source === props.content.image
              ? props.content.imageType || 'image'
              : props.content.fullType);
          try {
            await waitForMediaReady(url, type, controller.signal);
          } catch (error) {
            if (!controller.signal.aborted) await removeShowAsset(source).catch(() => {});
            throw error;
          }
          controller.signal.throwIfAborted();
          lastProgress = Date.now();
          setStatus({ loaded: i + 1, total: sources.length, name });
        }
        controller.signal.throwIfAborted();
        const current = latest.current;
        const content = { ...current.content };
        if (content.videoPlaylist?.enabled)
          content.videoPlaylist = {
            ...content.videoPlaylist,
            items: content.videoPlaylist.items.map((item) => ({
              ...item,
              url: mapping.get(item.url) || item.url,
            })),
          };
        if (content.image) content.image = mapping.get(content.image) || content.image;
        if (content.fullMedia)
          content.fullMedia = mapping.get(content.fullMedia) || content.fullMedia;
        const next = { props: { ...current, content }, release };
        const old = active.current;
        active.current = next;
        preparedKey.current = signature;
        adopted = true;
        setDisplay(next);
        setStatus(null);
        if (!persistent) setNote('الوسائط جاهزة لهذه الجلسة؛ تعذر حفظها بعد إغلاق المتصفح');
        // React commits the replacement before old Blob URLs are revoked.
        if (old) setTimeout(old.release, 1000);
      } catch (error) {
        if (stalled || !controller.signal.aborted) {
          setFailedKey(signature);
          setStatus({
            loaded: 0,
            total: sources.length,
            error:
              error instanceof Error && /[ء-ي]/.test(error.message)
                ? error.message
                : 'تعذر تجهيز الوسائط. تُعرض مباشرة من الرابط؛ تحقق من الرابط والاتصال.',
          });
        }
        if (!adopted) release();
      } finally {
        clearInterval(watchdog);
      }
    }
    void prepare();
    return () => {
      clearInterval(watchdog);
      controller.abort();
      if (!adopted) release();
    };
  }, [signature, retry, downloadsPaused]);
  useEffect(() => () => active.current?.release(), []);
  // Non-media edits (colors, titles, mode changes) don't require downloading the queue again.
  const view =
    display && preparedKey.current === signature
      ? {
          ...props,
          content: {
            ...props.content,
            fullMedia: sources.includes(props.content.fullMedia || '')
              ? display.props.content.fullMedia
              : props.content.fullMedia,
            image: sources.includes(props.content.image)
              ? display.props.content.image
              : props.content.image,
            videoPlaylist: props.content.videoPlaylist
              ? {
                  ...props.content.videoPlaylist,
                  items: props.content.videoPlaylist.items.map((item, index) => ({
                    ...item,
                    url: display.props.content.videoPlaylist?.items[index]?.url || item.url,
                  })),
                }
              : undefined,
          },
        }
      : failedKey === signature
        ? props
        : visible.current || display?.props;
  useLayoutEffect(() => {
    if (display && preparedKey.current === signature && view) visible.current = view;
  }, [view, display, signature]);
  const fallback = {
    ...props,
    content: {
      ...props.content,
      image: props.content.imageType === 'video' ? '' : props.content.image,
    },
    template: { ...props.template, displayMode: 'daily' as const, rotation: undefined },
  };
  const retryHidden = useAutoHide(status?.error && !status.loaded ? status.error : null);
  const candidate = (view || fallback) as Props;
  // Mode switches between big modes: intro covers the old screen, the loop plays while the new
  // mode prepares, and the outro reveals it only once it is ready.
  const clips = useTransitionClips(props.large && props.template.modeTransitions !== false);
  const [gate, setGate] = useState<{ phase: TransitionPhase; held: Props; target: string } | null>(
    null,
  );
  const shown = useRef<Props>(candidate);
  const target = modeOf(props);
  useEffect(() => {
    if (!clips) return;
    setGate((current) => {
      if (current) return current.target === target ? current : { ...current, target };
      const from = modeOf(shown.current);
      return target !== from && BIG_MODES.includes(target) && BIG_MODES.includes(from)
        ? { phase: 'intro', held: shown.current, target }
        : null;
    });
  }, [target, clips]);
  const ready = !!gate && modeOf(candidate) === gate.target;
  useEffect(() => {
    if (gate?.phase === 'loop' && ready) setGate({ ...gate, phase: 'outro' });
  }, [gate, ready]);
  useEffect(() => {
    if (gate?.phase !== 'loop') return;
    const timer = setTimeout(
      () => setGate((current) => current && { ...current, phase: 'outro' }),
      LOOP_LIMIT_MS,
    );
    return () => clearTimeout(timer);
  }, [gate?.phase]);
  const rendered = gate && gate.phase !== 'outro' ? gate.held : candidate;
  if (!gate || gate.phase === 'outro') shown.current = candidate;
  return (
    <>
      <Screen {...rendered} />
      {clips && (
        <TransitionOverlay
          clips={clips}
          phase={gate?.phase || null}
          onDone={(phase) =>
            setGate((current) =>
              !current || current.phase !== phase
                ? current
                : phase === 'intro'
                  ? { ...current, phase: ready ? 'outro' : 'loop' }
                  : null,
            )
          }
        />
      )}
      {status?.error && !retryHidden && (
        <button className="cache-retry" onClick={() => setRetry((n) => n + 1)}>
          إعادة تجهيز الوسائط
        </button>
      )}
    </>
  );
}

const STALL_MS = 60_000;

function getPreparationSources(content: Content, template: Partial<Template>): string[] {
  if (activeCustomDay(template)) return [];
  const rotation = rotationOptions(template.rotation);
  const mode =
    rotation.enabled && !['presentation', 'show'].includes(template.displayMode || '')
      ? rotation.normal
      : template.displayMode || 'daily';
  // Never gate a layout switch on media that the selected layout cannot display.
  if (['presentation', 'show', 'slideshow', 'photos'].includes(mode)) return [];
  if (
    mode === 'loop' &&
    (template.loopHidePhoto ||
      loopLayout(template.loopLayout).showPhoto === false ||
      (template.centerSlideshow?.enabled && template.centerSlideshow.images.length > 0))
  )
    return [];
  const sources: string[] = [];
  if (mode === 'media') {
    if (content.videoPlaylist?.enabled && content.videoPlaylist.items.length)
      sources.push(...content.videoPlaylist.items.map((item) => item.url));
    else if (
      content.fullMedia &&
      (content.fullType === 'image' || content.videoPreparation === 'cache')
    )
      sources.push(content.fullMedia);
  } else if (
    content.image &&
    (content.imageType === 'video' || /\.gif(?:[?#]|$)/i.test(content.image))
  ) {
    sources.push(content.image);
  }
  return [...new Set(sources)];
}
