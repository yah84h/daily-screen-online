import { MediaVideo } from './MediaVideo';
import { mediaCropStyle, type MediaCrop } from '@/lib/mediaCrop';
import { drivePlaybackURL, parseDriveLink } from '@/lib/driveVideo';
export function DailyMedia({
  src,
  type,
  large,
  sound = false,
  fit = 'cover',
  crop,
}: {
  src: string;
  type?: 'image' | 'video';
  large: boolean;
  sound?: boolean;
  fit?: 'cover' | 'contain' | 'fill';
  crop?: MediaCrop;
}) {
  const video = type === 'video' || /\.(mp4|webm)(?:[?#]|$)/i.test(src);
  return (
    <div className="daily-media-content" style={{ '--media-fit': fit } as React.CSSProperties}>
      {video ? (
        <div style={mediaCropStyle(crop)}>
          <MediaVideo
            src={parseDriveLink(src) ? drivePlaybackURL(src) : src}
            sound={large && sound}
            loop
            controls={false}
          />
        </div>
      ) : (
        <img src={src} alt="" style={{ objectFit: fit, ...mediaCropStyle(crop) }} />
      )}
    </div>
  );
}
