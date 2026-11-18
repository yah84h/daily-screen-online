import { prepareAsset } from '@/lib/assetCache';
import { useDevicePlayback } from '@/lib/devicePlayback';
import { useCacheTask } from '@/lib/cacheStatus';
import { useEffect, useRef, useState } from 'react';
import { drivePlaybackURL, parseDriveLink } from '@/lib/driveVideo';
import type { Content } from '@/lib/types';
const key = 'daily-screen-audio-device:' + location.pathname;
function saved() {
  try {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      enabled: s.enabled === true,
      volume: Number.isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : 0.3,
    };
  } catch {
    return { enabled: false, volume: 0.3 };
  }
}
export function BackgroundAudio({
  source,
  controls,
}: {
  source?: Content['backgroundAudio'];
  controls: boolean;
}) {
  const device = useDevicePlayback();
  const ownedURL = useRef('');
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const audio = useRef<HTMLAudioElement>(null);
  const [prefs, setPrefs] = useState(saved);
  const [error, setError] = useState('');
  // Pause pressed on this display wins until someone presses play here or the screen's
  // shared (remote) play/pause state changes; otherwise remote sync restarted it instantly.
  const [pausedHere, setPausedHere] = useState(false);
  useEffect(() => setPausedHere(false), [device.paused]);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [prepared, setPrepared] = useState({ url: '', src: '', loading: false });
  const stamp = (seconds: number) =>
    Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  const seek = (value: number) => {
    if (!audio.current || !duration) return;
    const next = Math.max(0, Math.min(duration, value));
    audio.current.currentTime = next;
    setPosition(next);
  };
  const url = source?.url
    ? parseDriveLink(source.url)
      ? drivePlaybackURL(source.url) + '&audio=1'
      : source.url
    : '';
  // Download the whole sound before mounting it as a playable source.
  useEffect(
    () => () => {
      if (ownedURL.current) URL.revokeObjectURL(ownedURL.current);
    },
    [],
  );
  useEffect(() => {
    if (prepared.url === url && prepared.src) return;
    if (device.downloadsPaused) return;
    const controller = new AbortController();
    let objectURL = '';
    setPrepared({ url, src: '', loading: !!url });
    setError('');
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    if (!url) return () => controller.abort();
    async function prepare() {
      try {
        const { blob, localUrl } = await prepareAsset(
          source!.url,
          controller.signal,
          (loaded, total) => {
            if (!controller.signal.aborted) setProgress({ loaded, total });
          },
          'audio',
        );
        controller.signal.throwIfAborted();
        if (!blob.size) throw Error('Empty audio file');
        if (ownedURL.current) URL.revokeObjectURL(ownedURL.current);
        objectURL = localUrl || URL.createObjectURL(blob);
        ownedURL.current = objectURL;
        setPrepared({ url, src: objectURL, loading: false });
      } catch {
        if (!controller.signal.aborted) {
          setPrepared({ url, src: '', loading: false });
          setError('تعذر تجهيز صوت الخلفية. تحقق من الرابط والاتصال وصلاحيات التنزيل.');
        }
      }
    }
    void prepare();
    return () => {
      controller.abort();
    };
  }, [url, device.downloadsPaused]);
  // Matching the URL prevents playback of the previous sound during a source change.
  const preparedURL = prepared.url === url ? prepared.src : '';
  const preparing = !!url && (prepared.url !== url || prepared.loading);
  useCacheTask(
    preparing
      ? {
          label: device.downloadsPaused ? 'تنزيل الصوت متوقف مؤقتًا' : 'تجهيز صوت الخلفية',
          ...progress,
        }
      : error
        ? { label: 'صوت الخلفية', loaded: 0, total: 0, error }
        : null,
  );
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {}
    if (audio.current) audio.current.volume = (source?.volume ?? prefs.volume) * device.volume;
  }, [prefs.enabled, prefs.volume, url, device.volume, source?.volume]);
  // Plays by itself on the TV unless the admin turned automatic playback off.
  const auto = !!source && source.autoplay !== false;
  useEffect(() => {
    const el = audio.current;
    if (!el || !preparedURL) return;
    setError('');
    const should = (auto || prefs.enabled || device.remoteActive) && !device.paused && !pausedHere;
    if (!should) {
      el.pause();
      return () => el.pause();
    }
    const tryPlay = () =>
      el.paused &&
      el.play().then(
        () => setError(''),
        () => setError('اضغط تشغيل للسماح بالصوت على هذا الجهاز.'),
      );
    void tryPlay();
    // If the browser blocked autoplay, keep retrying and start on the first touch / key.
    const retry = setInterval(() => void tryPlay(), 5000);
    window.addEventListener('pointerdown', tryPlay);
    window.addEventListener('keydown', tryPlay);
    return () => {
      clearInterval(retry);
      window.removeEventListener('pointerdown', tryPlay);
      window.removeEventListener('keydown', tryPlay);
      el.pause();
    };
  }, [preparedURL, prefs.enabled, device.paused, device.remoteActive, pausedHere, auto]);

  if (!url) return controls ? <p>لا يوجد صوت خلفية منشور. أضفه من لوحة الإدارة.</p> : null;
  return (
    <>
      <audio
        onPlay={() => {
          if (device.paused) audio.current?.pause();
        }}
        ref={audio}
        src={preparedURL || undefined}
        loop={source?.loop !== false}
        preload="auto"
        onLoadedMetadata={() => {
          const d = audio.current?.duration || 0;
          setDuration(Number.isFinite(d) ? d : 0);
        }}
        onDurationChange={() => {
          const d = audio.current?.duration || 0;
          setDuration(Number.isFinite(d) ? d : 0);
        }}
        onTimeUpdate={() => setPosition(audio.current?.currentTime || 0)}
        onEmptied={() => {
          setPosition(0);
          setDuration(0);
        }}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setError('تعذر تشغيل الصوت. تحقق من الملف أو صلاحيات رابط Drive.')}
        data-background-audio="true"
      />
      {controls && (
        <section className="device-audio-controls">
          <b>صوت الخلفية · هذا الجهاز</b>
          <small>{source?.name}</small>
          {preparing && <small role="status">تجهيز صوت الخلفية قبل التشغيل…</small>}
          <button
            disabled={!preparedURL}
            aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل / متابعة الصوت'}
            onClick={() => {
              const el = audio.current;
              if (!el) return;
              if (playing) {
                el.pause();
                setPausedHere(true);
                setPrefs((p) => ({ ...p, enabled: false }));
              } else {
                setPausedHere(false);
                el.volume = prefs.volume * device.volume;
                el.play()
                  .then(() => setError(''))
                  .catch(() => setError('تعذر تشغيل الصوت. تحقق من الاتصال أو صيغة الملف.'));
                setPrefs((p) => ({ ...p, enabled: true }));
              }
            }}
          >
            {playing ? 'إيقاف مؤقت' : 'تشغيل / متابعة الصوت'}
          </button>
          <div className="audio-seek-buttons">
            <button disabled={!duration} onClick={() => seek(position - 10)}>
              رجوع ١٠ ثوانٍ
            </button>
            <button disabled={!duration} onClick={() => seek(position + 10)}>
              تقديم ١٠ ثوانٍ
            </button>
          </div>
          <label>
            موضع الصوت ·{' '}
            <span dir="ltr">
              {stamp(position)} / {stamp(duration)}
            </span>
            <input
              aria-label="موضع صوت الخلفية"
              type="range"
              min="0"
              max={duration || 0}
              step=".1"
              value={Math.min(position, duration)}
              disabled={!duration}
              onChange={(e) => seek(+e.target.value)}
            />
          </label>
          <label>
            مستوى الصوت · {Math.round(prefs.volume * 100)}٪
            <input
              aria-label="مستوى صوت الخلفية"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={prefs.volume}
              onChange={(e) => setPrefs((p) => ({ ...p, volume: +e.target.value }))}
            />
          </label>
          {error && <small role="alert">{error}</small>}
        </section>
      )}
    </>
  );
}
