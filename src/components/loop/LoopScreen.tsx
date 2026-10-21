import type { School, Template } from "@/lib/types";
import { defaultLoopSchoolName, periodAt, recognitionOf } from "@/lib/loop";
import { techEntryForDay } from "@/lib/techQuotes";
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
  const period = periodAt(now, template.timetable, template),
    entry = techEntryForDay(now),
    animate = template.animateClock !== false;
  return (
    <div className={"screen screen-loop " + (large ? "large" : "") + (recognitionOf(template).enabled && recognitionOf(template).students.some(s=>s.name.trim()) ? " has-recognition" : "")} dir="rtl">
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
        </div>
      </section>
      <RecognitionBoard board={recognitionOf(template)} />
      {template.showTechQuotes !== false && (
        <section className="loop-tech-card" aria-label="ومضة تقنية">
          <small>
            {entry.kind === "quote"
              ? "اقتباس تقني · ترجمة عربية"
              : "ومضة تقنية · " + entry.category}
          </small>
          <p key={entry.id}>{entry.text}</p>
          <footer>
            {entry.kind === "quote" ? entry.author + " · " : ""}
            <a
              href={entry.source}
              target="_blank"
              rel="noreferrer"
              tabIndex={-1}
            >
              {entry.sourceLabel}
            </a>
          </footer>
        </section>
      )}
      </NativeBackground>
    </div>
  );
}
