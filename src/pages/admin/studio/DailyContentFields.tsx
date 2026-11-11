import { CalendarDays, SlidersHorizontal } from 'lucide-react';
import { useAdmin } from '../store';

export function DailyContentFields() {
  const { content, edit, setModal, selectContentDate, dateLoading, dateNotice } = useAdmin();
  return (
    <div className="studio-fields">
      <label htmlFor="daily-title">
        عنوان اليوم<span className="studio-field-meta">{content.title.length} / 100</span>
      </label>
      <input
        id="daily-title"
        aria-label="عنوان اليوم"
        maxLength={100}
        value={content.title}
        onChange={(event) => edit('title', event.target.value)}
        placeholder="عن ماذا سنتحدث اليوم؟"
      />
      <label htmlFor="daily-subtitle">
        العنوان الفرعي<small>اختياري</small>
      </label>
      <input
        id="daily-subtitle"
        aria-label="العنوان الفرعي"
        maxLength={160}
        value={content.subtitle}
        onChange={(event) => edit('subtitle', event.target.value)}
        placeholder="جملة قصيرة تمهّد لرسالتك"
      />
      <label htmlFor="daily-body">
        الرسالة الرئيسية<span className="studio-field-meta">{content.body.length} / 700</span>
      </label>
      <textarea
        id="daily-body"
        aria-label="الرسالة الرئيسية"
        maxLength={700}
        rows={5}
        value={content.body}
        onChange={(event) => edit('body', event.target.value)}
        placeholder="اكتب رسالة واضحة يسهل قراءتها من بعيد…"
      />
      <p className="field-hint">نصيحة: رسالة قصيرة وواضحة أفضل للقراءة على الشاشة.</p>
      <div className="studio-date-setting">
        <CalendarDays size={18} />
        <label htmlFor="daily-auto-date">
          <b>استخدام تاريخ اليوم تلقائيًا</b>
          <small>أوقفه لاختيار يوم وتحميل محتواه المجدول في المعاينة.</small>
        </label>
        <input
          id="daily-auto-date"
          aria-label="استخدام تاريخ اليوم تلقائيًا"
          type="checkbox"
          checked={content.autoDate}
          disabled={dateLoading}
          onChange={(event) => {
            if (event.target.checked)
              void selectContentDate(
                new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }),
                true,
              );
            else edit('autoDate', false);
          }}
        />
      </div>
      {!content.autoDate && (
        <label className="studio-inline-label">
          التاريخ
          <input
            type="date"
            aria-label="تاريخ المحتوى والمعاينة"
            disabled={dateLoading}
            value={content.date}
            onChange={(event) => void selectContentDate(event.target.value)}
          />
        </label>
      )}
      {dateLoading && (
        <p role="status" className="field-hint">
          جارٍ تحميل محتوى اليوم المحدد…
        </p>
      )}
      {dateNotice && (
        <p role="status" className="studio-date-notice">
          {dateNotice}
        </p>
      )}
      <button
        type="button"
        className="studio-secondary-action"
        onClick={() => setModal('optional')}
      >
        <SlidersHorizontal size={17} />
        الشارة والتذييل والعناصر الإضافية
      </button>
    </div>
  );
}
