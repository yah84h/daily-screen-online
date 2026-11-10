import { useDevicePlayback } from '@/lib/devicePlayback';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Screen } from './Screen';
import { waitForMediaReady } from '@/lib/mediaReadiness';
import { prepareAsset, removeShowAsset, SHOW_LIMIT } from '@/lib/assetCache';
import { useCacheTask } from '@/lib/cacheStatus';
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
  const sources = getPreparationSources(props.content);
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
    if (downloadsPaused || (preparedKey.current === signature && active.current)) return;
    const controller = new AbortController();
    const urls: string[] = [];
    let adopted = false;
    const release = () => urls.forEach((url) => URL.revokeObjectURL(url));
    setNote('');
    setStatus(sources.length ? { loaded: 0, total: sources.length } : null);
    async function prepare() {
      try {
        if (queue.length > 30) throw Error('الحد الأقصى للقائمة ٣٠ ملفًا.');
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
            if (!controller.signal.aborted)
              setStatus({ loaded: i + (total ? loaded / total : 0), total: sources.length, name });
          });
          persistent = persistent && result.persistent;
          bytes += result.blob.size;
          if (bytes > SHOW_LIMIT)
            throw Error('قائمة التشغيل أكبر من ٢ جيجابايت. قسّم العرض إلى قوائم أصغر.');
          const url = URL.createObjectURL(result.blob);
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
        if (!controller.signal.aborted)
          setStatus({
            loaded: 0,
            total: sources.length,
            error:
              error instanceof Error && /[ء-ي]/.test(error.message)
                ? error.message
                : 'تعذر تجهيز الوسائط. يبقى العرض السابق ظاهرًا؛ تحقق من الرابط والاتصال.',
          });
        if (!adopted) release();
      }
    }
    void prepare();
    return () => {
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
  return (
    <>
      <Screen {...(view || fallback)} />
      {status?.error && (
        <button className="cache-retry" onClick={() => setRetry((n) => n + 1)}>
          إعادة تجهيز الوسائط
        </button>
      )}
    </>
  );
}

function getPreparationSources(content: Content): string[] {
  const sources = content.videoPlaylist?.enabled
    ? content.videoPlaylist.items.map((item) => item.url)
    : [];
  if (content.image && (content.imageType === 'video' || /\.gif(?:[?#]|$)/i.test(content.image)))
    sources.push(content.image);
  if (content.fullMedia && (content.fullType === 'image' || content.videoPreparation === 'cache'))
    sources.push(content.fullMedia);
  return [...new Set(sources)];
}
