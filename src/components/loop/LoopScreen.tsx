import {loopAppearance,photoRatios,loopSizing} from '@/lib/loopAppearance';
import { BackgroundSlideshow } from '../BackgroundSlideshow';
import type { School, Template } from "@/lib/types";
import { defaultLoopSchoolName, timetableFor, lessonCountdown, periodAt, recognitionOf } from "@/lib/loop";
import {NewsTicker} from "./NewsTicker";
import NativeBackground from "./NativeBackground";
import { RecognitionBoard } from "./RecognitionBoard";
import { AnimatedClock, SoftTransition } from "./SoftTransition";

export function LoopScreen({
  now,
  template,
  school,
  logo,
  large,
}: {
  now: Date;
  template: Template;
  school: School;
  logo?: string;
  large: boolean;
}) {
  const countdown=lessonCountdown(now,timetableFor(template));
  const period = periodAt(now, timetableFor(template), template),
    animate = template.animateClock !== false;
  const palette=loopAppearance(template.loopAppearance),board=recognitionOf(template),shape=['rounded','rectangle','circle','oval'].includes(template.centerPhoto?.shape||'')?template.centerPhoto!.shape:'rounded',ratio=shape==='circle'?1:photoRatios[template.centerPhoto?.ratio as keyof typeof photoRatios]||16/9;
  const appearance=Object.fromEntries(Object.entries(palette).map(([key,value])=>['--loop-'+key,value]));
  const sizing=loopSizing(template,board.width||27,board.enabled&&board.students.some(s=>s.name.trim()));
  return (
    <div style={{...appearance,'--center-ratio':ratio,'--center-width':sizing.width+'cqw','--center-x':sizing.x+'%','--clock-scale':sizing.clockScale,'--board-scale':sizing.boardScale,'--brand-filter':parseInt(palette.background.slice(1,3),16)<80?'brightness(0) invert(1)':'none'} as import('react').CSSProperties} className={"screen screen-loop " + (large ? "large" : "") + (recognitionOf(template).enabled && recognitionOf(template).students.some(s=>s.name.trim()) ? " has-recognition" : "")} dir="rtl" data-slideshow={!!(template.slideshow?.enabled&&template.slideshow.images.length)}>
      <BackgroundSlideshow template={template}/>
      <NativeBackground
        name={
          template.loopSchoolName?.trim() ||
          (template.loopBranding === "school"
            ? school.name
            : defaultLoopSchoolName)
        }
        customLogo={logo}
        pairedBranding={template.loopBranding !== "school"}
        uiScale={Math.max(.75,Math.min(1.1,(Number(template.loopScale)||100)/100))}
      >
      <section className="loop-clock-panel" aria-label="الساعة والحصة الحالية">
        <p>الوقت الآن · جدة</p>
        <AnimatedClock now={now} animate={animate} />
        <p className="loop-date">
          {now.toLocaleDateString("ar-SA-u-ca-gregory", {
            timeZone: "Asia/Riyadh",
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <div className="loop-period">
          <small>يومنا الدراسي</small>
          <h2>
            <SoftTransition value={period.label} animate={animate} />
          </h2>
          <p dir={/^\d/.test(period.detail) ? "ltr" : "rtl"}>
            <SoftTransition value={period.detail} animate={animate} />
          </p>
          {countdown&&<div key={period.label+period.detail} className="lesson-countdown" aria-label={'المتبقي من '+period.label}><div><small>المتبقي من {period.label}</small><span dir="ltr">{countdown.label}</span></div><progress aria-label={'تقدم '+period.label} max={countdown.duration} value={countdown.duration-countdown.remaining}/></div>}
        </div>
      </section>
      {template.centerSlideshow?.enabled && template.centerSlideshow.images.length>0 && <section className={"loop-center-slideshow shape-"+shape} aria-label="عرض صور وسط الشاشة"><BackgroundSlideshow template={{slideshow:template.centerSlideshow}}/></section>}
      <RecognitionBoard board={recognitionOf(template)} />
      </NativeBackground>
      <NewsTicker settings={template.news} now={now}/>
    </div>
  );
}
