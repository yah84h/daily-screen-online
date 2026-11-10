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
  return (
    <div className="full-audio-player">
      <b>تشغيل الصوت</b>
      <audio
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
