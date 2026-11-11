import { CalendarDays, Check } from 'lucide-react';
import type { AdminProposal } from '../../../../local-test/assistant-tools.mjs';
export function ScheduleReview({
  schedule,
  disabled,
  saved,
  onSave,
}: {
  schedule: NonNullable<AdminProposal['schedule']>;
  disabled: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <section className="assistant-week-review" aria-label="مراجعة خطة الإذاعة الأسبوعية">
      <div className="assistant-review-heading">
        <CalendarDays size={20} />
        <div>
          <h4>خطة الإذاعة الأسبوعية</h4>
          <small>{schedule.length} أيام · حسب توقيت الرياض</small>
        </div>
      </div>
      <div className="assistant-week-days">
        {schedule.map((entry) => (
          <article key={entry.date}>
            <time dateTime={entry.date}>
              <b>
                {new Date(entry.date + 'T12:00:00+03:00').toLocaleDateString('ar-SA', {
                  weekday: 'long',
                  timeZone: 'Asia/Riyadh',
                })}
              </b>
              <span>{entry.date}</span>
            </time>
            <div>
              <h5>{entry.content.title}</h5>
              {entry.content.subtitle && <p>{entry.content.subtitle}</p>}
              {entry.content.body && <p>{entry.content.body}</p>}
              {entry.content.badge && <small>{entry.content.badge}</small>}
              {entry.content.footer && <small>{entry.content.footer}</small>}
            </div>
          </article>
        ))}
      </div>
      <p className="assistant-review-note">
        عند التأكيد تُحفظ هذه الأيام في «الجدولة والسجل». يُحدّث الإعلان الموجود في التاريخ نفسه،
        وتبقى الأيام الأخرى كما هي. راجع التواريخ قبل الحفظ.
      </p>
      <button className="button primary" disabled={disabled || saved} onClick={onSave}>
        {saved ? (
          <>
            <Check size={17} />
            تم حفظ خطة الإذاعة
          </>
        ) : (
          <>
            <CalendarDays size={17} />
            تأكيد جدولة الإذاعة
          </>
        )}
      </button>
    </section>
  );
}
