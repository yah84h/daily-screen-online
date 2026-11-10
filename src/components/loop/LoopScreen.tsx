import { fitLoopPosition } from '@/lib/loopPositions';
import { loopLayout } from '@/lib/loopLayouts';
import { LoopExtras } from './LoopExtras';
import { loopAppearance, photoRatios, loopSizing } from '@/lib/loopAppearance';
import { BackgroundSlideshow } from '../BackgroundSlideshow';
import type { Content, School, Template } from '@/lib/types';
import {
  defaultLoopSchoolName,
  timetableFor,
  lessonCountdown,
  periodAt,
  recognitionOf,
} from '@/lib/loop';
import { NewsTicker } from './NewsTicker';
import NativeBackground from './NativeBackground';
import { RecognitionBoard } from './RecognitionBoard';
import { AnimatedClock, SoftTransition } from './SoftTransition';

export function LoopScreen({
  content,
  now,
  template,
  school,
  logo,
  large,
}: {
  content: Content;
  now: Date;
  template: Template;
  school: School;
  logo?: string;
  large: boolean;
}) {
  const countdown = lessonCountdown(now, timetableFor(template));
  const period = periodAt(now, timetableFor(template), template);
  const animate = template.animateClock !== false;
  const palette = loopAppearance(template.loopAppearance);
  const board = recognitionOf(template);
  const shape = ['rounded', 'rectangle', 'circle', 'oval'].includes(
    template.centerPhoto?.shape || '',
  )
    ? template.centerPhoto!.shape
    : 'rounded';
  const ratio =
    shape === 'circle'
      ? 1
      : photoRatios[template.centerPhoto?.ratio as keyof typeof photoRatios] || 16 / 9;
  const appearance = Object.fromEntries(
    Object.entries(palette).map(([key, value]) => ['--loop-' + key, value]),
  );
  const boardVisible =
    board.enabled && (board.source === 'qudrat-pro' || board.students.some((s) => s.name.trim()));
  const sizing = loopSizing(template, board.width || 27, boardVisible);
  const layout = loopLayout(template.loopLayout);
  const hasExtras = !!(
    template.loopExtras?.topic ||
    template.loopExtras?.announcement ||
    (template.loopExtras?.qr && content.qr) ||
    template.loopExtras?.schedule
  );
  const positionStyle = Object.fromEntries(
    Object.entries(template.loopPositions || {}).flatMap(([key, value]) =>
      Object.entries(fitLoopPosition(value)).map(([axis, n]) => [
        '--position-' + key + '-' + axis,
        n + '%',
      ]),
    ),
  );
  const layoutStyle = Object.fromEntries(
    (['clock', 'photo', 'board'] as const).flatMap((key) => {
      const r = layout[key];
      return Object.entries({ ...r, h: hasExtras ? 44 : r.h }).map(([axis, value]) => [
        '--layout-' + key + '-' + axis,
        value + '%',
      ]);
    }),
  );
  return (
    <div
      style={
        {
          ...appearance,
          ...layoutStyle,
          ...positionStyle,
          '--position-school-font':
            Math.max(0.6, Math.min(5, (template.loopPositions?.school?.h || 6) * 0.32)) + 'cqw',
          '--position-clock-font':
            Math.max(2, Math.min(8, (template.loopPositions?.clock?.w || 25) * 0.2)) + 'cqw',
          backgroundImage: template.backgroundImage
            ? `url(${template.backgroundImage})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          '--center-ratio': ratio,
          '--center-width': sizing.width + 'cqw',
          '--center-x': sizing.x + '%',
          '--clock-scale': sizing.clockScale,
          '--board-scale': sizing.boardScale,
          '--brand-filter':
            parseInt(palette.background.slice(1, 3), 16) < 80 ? 'brightness(0) invert(1)' : 'none',
        } as import('react').CSSProperties
      }
      className={
        'screen screen-loop ' + (large ? 'large' : '') + (boardVisible ? ' has-recognition' : '')
      }
      dir="rtl"
      data-clock-face={!!layout.clockFaceOnly}
      data-custom={!!template.loopPositions}
      data-positions={Object.keys(template.loopPositions || {}).join(' ')}
      data-layout={layout.id}
      data-backdrop={template.loopBackdrop || 'waves'}
      data-extras={
        !!(
          template.loopExtras?.topic ||
          template.loopExtras?.announcement ||
          (template.loopExtras?.qr && content.qr) ||
          template.loopExtras?.schedule
        )
      }
      data-cards={template.loopCardStyle || 'soft'}
      data-slideshow={
        !!(
          template.backgroundImage ||
          (template.slideshow?.enabled && template.slideshow.images.length)
        )
      }
    >
      <BackgroundSlideshow template={template} />
      <div className="loop-decoration" aria-hidden="true" />
      <NativeBackground
        name={
          template.loopSchoolName?.trim() ||
          (template.loopBranding === 'school' ? school.name : defaultLoopSchoolName)
        }
        customLogo={logo}
        pairedBranding={template.loopBranding !== 'school'}
        uiScale={Math.max(0.75, Math.min(1.1, (Number(template.loopScale) || 100) / 100))}
      >
        {layout.showClock !== false && (
          <section className="loop-clock-panel" aria-label="الساعة والحصة الحالية">
            <p>الوقت الآن · جدة</p>
            <AnimatedClock now={now} animate={animate} />
            <p className="loop-date">
              {now.toLocaleDateString('ar-SA-u-ca-gregory', {
                timeZone: 'Asia/Riyadh',
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            {template.loopExtras?.hijri && (
              <p className="loop-hijri">
                {now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', {
                  timeZone: 'Asia/Riyadh',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
            {!layout.clockFaceOnly && (
              <div className="loop-period">
                <small>يومنا الدراسي</small>
                <h2>
                  <SoftTransition value={period.label} animate={animate} />
                </h2>
                <p dir={/^\d/.test(period.detail) ? 'ltr' : 'rtl'}>
                  <SoftTransition value={period.detail} animate={animate} />
                </p>
                {countdown && (
                  <div
                    key={period.label + period.detail}
                    className="lesson-countdown"
                    aria-label={'المتبقي من ' + period.label}
                  >
                    <div>
                      <small>المتبقي من {period.label}</small>
                      <span dir="ltr">{countdown.label}</span>
                    </div>
                    <progress
                      aria-label={'تقدم ' + period.label}
                      max={countdown.duration}
                      value={countdown.duration - countdown.remaining}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        {layout.showPhoto !== false &&
          !template.loopHidePhoto &&
          template.centerSlideshow?.enabled &&
          template.centerSlideshow.images.length > 0 && (
            <section
              className={'loop-center-slideshow shape-' + shape}
              aria-label="عرض صور وسط الشاشة"
            >
              <BackgroundSlideshow template={{ slideshow: template.centerSlideshow }} />
            </section>
          )}
        {layout.showBoard !== false && <RecognitionBoard board={recognitionOf(template)} />}
        <LoopExtras template={template} content={content} now={now} />
      </NativeBackground>
      <NewsTicker settings={template.news} now={now} />
    </div>
  );
}
