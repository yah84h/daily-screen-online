import { useDevicePlayback } from '@/lib/devicePlayback';
import { useCacheTask } from '@/lib/cacheStatus';
import { useEffect, useRef, useState } from 'react';
export function MediaVideo({
  src,
  sound,
  loop,
  controls,
  bufferBeforePlay = false,
  onEnded,
}: {
  src: string;
  sound: boolean;
  loop: boolean;
  controls: boolean;
  bufferBeforePlay?: boolean;
  onEnded?: () => void;
}) {
  const device = useDevicePlayback();
  const ref = useRef<HTMLVideoElement>(null);
  const [action, setAction] = useState(false);
  const [waiting, setWaiting] = useState(bufferBeforePlay);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useCacheTask(waiting ? { label: 'تجهيز أول ١٠ ثوانٍ من الفيديو', loaded: 0, total: 0 } : null);
  useEffect(() => {
    if (ref.current) ref.current.volume = device.volume;
  }, [device.volume]);
  useEffect(() => {
    let active = true;
    let started = false;
    const v = ref.current;
    if (!v) return;
    setAction(false);
    setError('');
    setWaiting(bufferBeforePlay);
    v.muted = !sound;
    v.volume = device.volume;
    const play = () => {
      if (started || !active || device.paused) return;
      started = true;
      setWaiting(false);
      v.play().catch(async () => {
        if (!active) return;
        v.muted = true;
        setAction(true);
        try {
          await v.play();
        } catch {
          /* A touch can start playback. */
        }
      });
    };
    const check = () => {
      if (!bufferBeforePlay) return;
      const end = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
      if (end - v.currentTime >= 10 || (Number.isFinite(v.duration) && end >= v.duration - 0.1))
        play();
    };
    const failed = () => {
      if (active) {
        setWaiting(false);
        setError('تعذر تشغيل الفيديو. تحقق من الرابط وصلاحيات الوصول وصيغة MP4 / WEBM.');
      }
    };
    v.addEventListener('progress', check);
    v.addEventListener('canplaythrough', check);
    v.addEventListener('error', failed);
    if (device.paused) v.pause();
    if (!bufferBeforePlay) play();
    else check();
    const timer = setInterval(check, 250);
    const timeout = setTimeout(() => {
      if (active && !started) {
        setWaiting(false);
        setAction(true);
      }
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
      clearTimeout(timeout);
      v.removeEventListener('progress', check);
      v.removeEventListener('canplaythrough', check);
      v.removeEventListener('error', failed);
    };
  }, [src, sound, loop, bufferBeforePlay, attempt, device.paused]);
  return (
    <>
      <video
        onPlay={() => {
          if (device.paused) ref.current?.pause();
        }}
        onEnded={onEnded}
        ref={ref}
        src={src}
        muted={!sound}
        loop={loop}
        controls={controls}
        playsInline
        preload={bufferBeforePlay ? 'auto' : 'metadata'}
      />
      {error && (
        <div className="drive-video-status" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              ref.current?.load();
              setAttempt((n) => n + 1);
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      )}
      {action && !error && (
        <button
          className="video-start"
          onClick={async () => {
            const v = ref.current;
            if (!v) return;
            try {
              v.muted = !sound;
              await v.play();
              setAction(false);
              setWaiting(false);
            } catch {
              setAction(true);
            }
          }}
        >
          {sound ? 'اضغط لتشغيل الفيديو بالصوت' : 'اضغط لتشغيل الفيديو'}
        </button>
      )}
    </>
  );
}
