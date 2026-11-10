import type { Content, Template } from '@/lib/types';
import { periodNames, timetableFor } from '@/lib/loop';
export function LoopExtras({
  template,
  content,
  now,
}: {
  template: Template;
  content: Content;
  now: Date;
}) {
  const extras = template.loopExtras;
  if (!extras) return null;
  const cards = [
    extras.topic && (
      <article key="topic">
        <small>{content.badge || 'موضوع اليوم'}</small>
        <h3>{content.title}</h3>
        <p>{content.subtitle || content.body}</p>
      </article>
    ),
    extras.announcement && (
      <article key="notice">
        <small>إعلان المدرسة</small>
        <h3>{extras.announcementTitle || 'تذكير مهم'}</h3>
        <p>{extras.announcementText || 'أضف نص الإعلان من إعدادات خلفية الحصص.'}</p>
      </article>
    ),
    extras.qr && content.qr && (
      <article key="qr" className="loop-extra-qr">
        <img src={content.qr} alt="رمز الاستجابة السريعة" />
        <div>
          <small>امسح الرمز</small>
          <h3>{extras.qrLabel || 'اكتشف المزيد'}</h3>
        </div>
      </article>
    ),
  ].filter(Boolean);
  const periods = timetableFor(template).periods.slice(
    0,
    now.toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh', weekday: 'short' }) === 'Thu'
      ? 6
      : 7,
  );
  return (
    <div className="loop-extras">
      {cards.length > 0 && <div className="loop-extra-cards">{cards}</div>}
      {extras.schedule && (
        <div className="loop-schedule" aria-label="جدول حصص اليوم">
          {periods.map(([start, end], i) => (
            <div key={i}>
              <b>{periodNames[i]}</b>
              <span dir="ltr">
                {start} – {end}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
