import { useEffect, useState } from 'react';
import { cacheDriveVideo, drivePlaybackURL, driveError } from '@/lib/driveVideo';
import { MediaVideo } from './MediaVideo';
export function DriveVideo({
  link,
  preparation,
  large,
  sound,
  loop,
  controls,
}: {
  link: string;
  preparation?: 'stream' | 'buffer' | 'cache';
  large: boolean;
  sound: boolean;
  loop: boolean;
  controls: boolean;
}) {
  const url = drivePlaybackURL(link);
  const mode = large ? preparation || 'stream' : 'stream';
  const [state, setState] = useState<{
    source: string;
    loaded: number;
    total: number;
    error: string;
    temporary: boolean;
  }>({ source: '', loaded: 0, total: 0, error: '', temporary: false });
  const [retry, setRetry] = useState(0);
  const [direct, setDirect] = useState(false);
  useEffect(() => setDirect(false), [url, mode]);
  useEffect(() => {
    const abort = new AbortController();
    let objectURL = '';
    setState({ source: '', loaded: 0, total: 0, error: '', temporary: false });
    if (mode !== 'cache' || direct) {
      setState((s) => ({ ...s, source: url }));
      return () => abort.abort();
    }
    cacheDriveVideo(url, abort.signal, (loaded, total) => {
      if (!abort.signal.aborted) setState((s) => ({ ...s, loaded, total }));
    })
      .then(({ blob, persistent }) => {
        if (abort.signal.aborted) return;
        objectURL = URL.createObjectURL(blob);
        setState((s) => ({ ...s, source: objectURL, temporary: !persistent }));
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setState((s) => ({
            ...s,
            error: /[ء-ي]/.test(error.message)
              ? error.message
              : driveError(error.code || 'DRIVE_UNAVAILABLE'),
          }));
      });
    return () => {
      abort.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [url, mode, retry, direct]);
  if (state.error)
    return (
      <div className="drive-video-status" role="alert">
        <p>{state.error}</p>
        <button onClick={() => setRetry((v) => v + 1)}>إعادة المحاولة</button>
        <button onClick={() => setDirect(true)}>التشغيل المباشر بدل التحضير</button>
      </div>
    );
  if (!state.source)
    return (
      <div className="drive-video-status" role="status">
        <b>تجهيز الفيديو قبل التشغيل</b>
        <progress max={state.total || 1} value={state.loaded} />
        <span>
          {state.total
            ? Math.round((state.loaded / state.total) * 100) +
              '٪ · ' +
              Math.round(state.loaded / 1048576) +
              ' / ' +
              Math.round(state.total / 1048576) +
              ' MB'
            : 'جارٍ الاتصال بـ Google Drive…'}
        </span>
        <button onClick={() => setDirect(true)}>إلغاء التحضير والتشغيل المباشر</button>
      </div>
    );
  return (
    <>
      <MediaVideo
        key={state.source}
        src={state.source}
        sound={sound}
        loop={loop}
        controls={controls}
        bufferBeforePlay={mode === 'buffer' && !direct}
      />
      {state.temporary && (
        <small className="drive-cache-note">
          الفيديو مجهز لهذه الجلسة؛ تعذر حفظه على هذا الجهاز.
        </small>
      )}
    </>
  );
}
