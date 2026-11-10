import { VideoPlaylist } from './VideoPlaylist';
import { MediaAudio } from './MediaAudio';
import { rotationOptions, rotationPhase } from '../../local-test/rotation.mjs';
import { PresentationPlayer } from './PresentationPlayer';
import type { PresentationContext } from '@/lib/presentation';
import { parseDriveLink } from '@/lib/driveVideo';
import { DriveVideo } from './DriveVideo';
import { displayClock } from '@/lib/clock';
import { syncedTheme } from '@/lib/loopAppearance';
import { mediaSlideshowOf } from '@/lib/slideshow';
import { BackgroundSlideshow } from './BackgroundSlideshow';
import { MediaVideo } from './MediaVideo';
import { LoopScreen } from './loop/LoopScreen';
import { useEffect, useState, useRef } from 'react';
import { GraduationCap } from 'lucide-react';
import {
  defaultSchool,
  defaultTemplate,
  type Content,
  type School,
  type Template,
} from '@/lib/types';

type Props = {
  content: Content;
  template?: Partial<Template>;
  school?: School;
  large?: boolean;
  presentationContext?: PresentationContext;
  slideshowStartIndex?: number;
};

/** العرض المشترك بين المعاينة والقالب والتلفزيون — لا تكرره في مكان آخر. */
export function Screen({
  content: c,
  template,
  school = defaultSchool,
  large = false,
  presentationContext,
  slideshowStartIndex = 0,
}: Props) {
  const t: Template = syncedTheme({ ...defaultTemplate, ...template });
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const rotation = rotationOptions(t.rotation);
  const started = useRef(Date.now());
  useEffect(() => {
    started.current = Date.now();
  }, [rotation.enabled, rotation.normal, rotation.normalSeconds, rotation.leaderboardSeconds]);
  if (rotation.enabled && t.displayMode !== 'presentation') {
    const elapsed = Math.max(0, (now.getTime() - started.current) / 1000);
    const phase = rotationPhase(elapsed, rotation);
    const cycle = rotation.normalSeconds + rotation.leaderboardSeconds;
    const photoSeconds =
      Math.floor(elapsed / cycle) * rotation.normalSeconds +
      Math.min(elapsed % cycle, rotation.normalSeconds);
    const playlist = mediaSlideshowOf(t);
    const photoIndex = playlist.loop
      ? Math.floor(photoSeconds / playlist.seconds) % Math.max(1, playlist.images.length)
      : Math.min(
          Math.floor(photoSeconds / playlist.seconds),
          Math.max(0, playlist.images.length - 1),
        );
    const next = { ...t, rotation: undefined };
    let content = c;
    if (phase === 'leaderboard') {
      next.displayMode = 'loop';
      next.loopLayout = 'board-only';
      next.loopPositions = undefined;
      next.loopExtras = undefined;
      next.recognition = {
        title: 'نجوم الأسبوع',
        subtitle: '',
        pageSeconds: 10,
        students: [],
        ...t.recognition,
        enabled: true,
      };
    } else {
      next.displayMode =
        rotation.normal === 'photos'
          ? mediaSlideshowOf(t).images.length
            ? 'slideshow'
            : 'media'
          : rotation.normal;
      if (rotation.normal === 'photos' && !mediaSlideshowOf(t).images.length)
        content = {
          ...c,
          fullMedia: c.fullType === 'image' && c.fullMedia ? c.fullMedia : c.image,
          fullType: 'image',
          videoPlaylist: undefined,
        };
      if (rotation.normal === 'loop')
        next.recognition = {
          title: '',
          subtitle: '',
          pageSeconds: 10,
          students: [],
          ...t.recognition,
          enabled: false,
        };
    }
    return (
      <div className="screen-rotation" data-phase={phase}>
        <Screen
          key={phase}
          content={content}
          template={next}
          school={school}
          large={large}
          presentationContext={presentationContext}
          slideshowStartIndex={rotation.normal === 'photos' ? photoIndex : 0}
        />
      </div>
    );
  }
  if (t.displayMode === 'presentation')
    return (
      <div className="screen screen-presentation">
        {c.presentation?.slides.length ? (
          <PresentationPlayer
            key={c.presentation.id}
            deck={c.presentation}
            context={presentationContext}
            large={large}
          />
        ) : (
          <div className="media-empty">ارفع ملف PowerPoint وانشره على الشاشة</div>
        )}
      </div>
    );
  if (t.displayMode === 'slideshow')
    return (
      <div
        className={'screen screen-slideshow ' + (large ? 'large' : '')}
        style={{ background: t.background }}
      >
        <BackgroundSlideshow
          startIndex={slideshowStartIndex}
          template={{ ...t, slideshow: { ...mediaSlideshowOf(t), enabled: true } }}
        />
        {!mediaSlideshowOf(t).images.length && (
          <div className="media-empty">أضف صورًا لعرض الشرائح</div>
        )}
      </div>
    );
  if (t.displayMode === 'loop')
    return (
      <LoopScreen
        content={c}
        now={now}
        template={t}
        school={school}
        logo={c.logo || t.schoolLogo || school.logo_url || undefined}
        large={large}
      />
    );
  const d = c.autoDate || !c.date ? now : new Date(c.date + 'T12:00:00+03:00');
  const logo = c.logo || t.schoolLogo || school.logo_url;
  if (t.displayMode === 'media' && c.videoPlaylist?.enabled && c.videoPlaylist.items.length)
    return (
      <div
        className={'screen screen-media ' + (large ? 'large' : '')}
        style={
          {
            background: t.background,
            '--media-fit': c.mediaFit || 'cover',
          } as import('react').CSSProperties
        }
      >
        <VideoPlaylist
          key={JSON.stringify(c.videoPlaylist.items.map((item) => [item.id, item.url]))}
          items={c.videoPlaylist.items}
          large={large}
          sound={c.videoSound !== false}
          controls={!!c.videoControls}
          loop={c.videoPlaylist.loop}
        />
      </div>
    );
  if (t.displayMode === 'media')
    return (
      <div
        className={'screen screen-media ' + (large ? 'large' : '')}
        style={
          {
            background: t.background,
            '--media-fit': c.mediaFit || 'cover',
          } as import('react').CSSProperties
        }
      >
        {c.fullMedia ? (
          c.fullType === 'audio' ? (
            <MediaAudio
              src={c.fullMedia}
              large={large}
              sound={large && c.videoSound !== false}
              loop={c.videoLoop !== false}
            />
          ) : c.fullType === 'video' ? (
            parseDriveLink(c.fullMedia) ? (
              <DriveVideo
                key={c.fullMedia}
                link={c.fullMedia}
                preparation={c.videoPreparation}
                large={large}
                sound={large && c.videoSound !== false}
                loop={c.videoLoop !== false}
                controls={large && !!c.videoControls}
              />
            ) : (
              <MediaVideo
                key={c.fullMedia}
                src={c.fullMedia}
                sound={large && c.videoSound !== false}
                loop={c.videoLoop !== false}
                controls={large && !!c.videoControls}
              />
            )
          ) : (
            <img
              src={c.fullMedia}
              alt="وسائط الشاشة"
              style={{ objectFit: c.mediaFit || 'cover' }}
            />
          )
        ) : (
          <div className="media-empty">اختر صورة أو فيديو من لوحة التحكم</div>
        )}
      </div>
    );
  return (
    <div
      className={'screen ' + (large ? 'large' : '')}
      style={{
        background: t.background,
        backgroundImage: t.backgroundImage ? `url(${t.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        color: t.color,
        fontFamily: `${!t.font || t.font === 'SchoolArabic' ? 'Cairo' : t.font}, 'Noto Sans Arabic', sans-serif`,
      }}
    >
      <BackgroundSlideshow template={t} />
      <div className="screen-top">
        <div
          className="school"
          style={{
            left: (t.schoolX ?? 55) + '%',
            top: (t.schoolY ?? 6) + '%',
            width: (t.schoolW ?? 39) + '%',
            fontSize: (t.schoolScale ?? 100) / 100 + 'cqw',
          }}
        >
          {logo ? <img src={logo} alt="" /> : <GraduationCap />}
          <span>
            {t.schoolName ?? school.name}
            <small>{t.schoolTagline ?? school.tagline}</small>
          </span>
        </div>
        <div className="screen-date">
          <b>
            {d.toLocaleDateString('ar-SA-u-ca-gregory', {
              weekday: 'long',
              timeZone: 'Asia/Riyadh',
            })}
          </b>
          {t.calendar !== 'islamic' && (
            <span>
              {d.toLocaleDateString('ar-SA-u-ca-gregory', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'Asia/Riyadh',
              })}
            </span>
          )}
          {(t.calendar === 'islamic' || t.calendar === 'both') && (
            <span className="hijri">
              {d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-arab', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'Asia/Riyadh',
              })}
            </span>
          )}
        </div>
      </div>
      <div
        key={c.title + c.subtitle + c.body + c.badge}
        className="screen-copy"
        style={{
          left: t.textX + '%',
          top: t.textY + '%',
          width: t.textW + '%',
          gap: t.spacing + 'cqw',
          textAlign: t.align || 'right',
        }}
      >
        {c.showBadge && (
          <div className="screen-badge" style={{ color: t.accent }}>
            <span />
            {c.badge}
          </div>
        )}
        <h1 style={{ fontSize: (4.7 * t.fontSize) / 100 + 'cqw' }}>{c.title}</h1>
        {c.showSubtitle && <h3>{c.subtitle}</h3>}
        <p>{c.body}</p>
        {c.showQR && c.qr && <img className="qr" src={c.qr} alt="QR" />}
      </div>
      {c.image && (
        <img
          className="screen-image"
          src={c.image}
          alt=""
          style={{
            left: t.imageX + '%',
            top: t.imageY + '%',
            width: t.imageW + '%',
            height: t.imageH + '%',
            borderRadius: t.radius + 'px',
            objectFit: t.fit,
          }}
        />
      )}
      {c.showSecondary && c.secondary && <img className="secondary" src={c.secondary} alt="" />}
      <div className="screen-footer">
        <span>{c.showFooter ? c.footer : ''}</span>
        <b>
          {displayClock(now, false)}
          <small>جدة</small>
        </b>
      </div>
    </div>
  );
}
