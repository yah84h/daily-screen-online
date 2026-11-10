import { useEffect, useRef } from 'react';
import { useDevicePlayback } from '@/lib/devicePlayback';
import { audioPlaybackURL } from '@/lib/mediaLinks';
export function MediaAudio({
  src,
  large,
  sound,
  loop,
}: {
  src: string;
  large: boolean;
  sound: boolean;
  loop: boolean;
}) {
  const device = useDevicePlayback();
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.volume = device.volume;
    if (device.paused) element.pause();
    else if (large && sound) void element.play().catch(() => {});
  }, [src, device.paused, large, sound]);
  useEffect(() => {
    if (audio.current) audio.current.volume = device.volume;
  }, [device.volume]);
  return (
    <div className="full-audio-player">
      <b>تشغيل الصوت</b>
      <audio
        ref={audio}
        onPlay={() => {
          if (device.paused) audio.current?.pause();
        }}
        key={src}
        controls
        autoPlay={large && sound}
        muted={!sound}
        loop={loop}
        preload="metadata"
        src={audioPlaybackURL(src)}
      />
      <small>اضغط تشغيل إن طلب المتصفح السماح بالصوت.</small>
    </div>
  );
}
