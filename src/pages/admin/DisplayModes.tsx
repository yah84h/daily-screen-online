import { RotationEditor } from './RotationEditor';
import { useAuth } from '@/lib/auth';
import { withDisplayMode } from '@/lib/slideshow';
import {
  Clock,
  Images,
  Image as ImageIcon,
  PanelsTopLeft,
  Presentation,
  Monitor,
} from 'lucide-react';
import { SlideshowEditor } from './SlideshowEditor';
import { MediaEditor } from './MediaEditor';
import { useAdmin } from './store';
const modes = [
  ['daily', 'المحتوى اليومي', 'رسالة وصورة بهوية المدرسة', PanelsTopLeft],
  ['media', 'صورة / فيديو فقط', 'ملء الشاشة دون أي عناصر', ImageIcon],
  ['slideshow', 'عرض شرائح الصور', 'صور متتابعة بملء الشاشة', Images],
  [
    'show',
    'وضع التقديم',
    'الأفضل للفعاليات: PowerPoint وفيديو وصور، يُجهَّز كله قبل البدء',
    Presentation,
  ],
  ['presentation', 'ملف PowerPoint', 'شرائح مع تحكم من الجوال والمؤشر', PanelsTopLeft],
  ['loop', 'خلفية الحصص', 'خلفية متحركة، ساعة وحصة', Clock],
] as const;
export function DisplayModes() {
  const { template, setTemplate, saveDesign, busy, data } = useAdmin();
  return (
    <section className="display-control-room" aria-label="طريقة العرض">
      <div className="display-mode-main">
        <div className="display-mode-intro">
          <span className="display-step">01 / طريقة العرض</span>
          <h2>ماذا تريد أن تعرض؟</h2>
          <p>اختر نوع المحتوى. يبقى اختيارك في المعاينة حتى تطبّقه.</p>
        </div>
        <div className="mode-cards" role="radiogroup" aria-label="نوع العرض">
          {modes.map(([id, name, description, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={(template.displayMode || 'daily') === id}
              disabled={busy || !data}
              className={
                'mode-card ' + ((template.displayMode || 'daily') === id ? 'selected' : '')
              }
              onClick={() => setTemplate((t) => withDisplayMode(t, id))}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
                  return;
                event.preventDefault();
                const next =
                  (modes.findIndex(([key]) => key === id) +
                    (['ArrowLeft', 'ArrowDown'].includes(event.key) ? 1 : -1) +
                    modes.length) %
                  modes.length;
                setTemplate((t) => withDisplayMode(t, modes[next][0]));
                event.currentTarget
                  .parentElement!.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                  [next].focus();
              }}
            >
              <span className="mode-icon">
                <Icon size={25} />
              </span>
              <span>
                <b>{name}</b>
                <small>{description}</small>
              </span>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <div className="display-mode-side">
        <span className="display-step">02 / أثناء التشغيل</span>
        <RotationEditor />
        <label className="mode-transition-toggle">
          <input
            type="checkbox"
            aria-label="انتقال بشعار المدرسة"
            checked={template.modeTransitions !== false}
            disabled={busy || !data}
            onChange={(e) => setTemplate((t) => ({ ...t, modeTransitions: e.target.checked }))}
          />
          <span>
            <b>انتقال بشعار المدرسة</b>
            <small>
              عند التبديل بين المحتوى اليومي والصورة/الفيديو وخلفية الحصص: مقدمة، ثم حركة انتظار
              أثناء التجهيز، ثم خاتمة تكشف الوضع الجديد.
            </small>
          </span>
        </label>
        <div className="display-mode-note">
          <Monitor size={20} />
          <p>لكل شاشة وضعها وإعداداتها. لا يتغير محتوى الشاشات الأخرى.</p>
        </div>
      </div>
      <div className="mode-save">
        <div>
          <b>{modes.find(([id]) => id === (template.displayMode || 'daily'))?.[1]}</b>
          <span>تطبيق الوضع يغيّر طريقة العرض. انشر المحتوى من صفحة الشاشة.</span>
        </div>
        <button className="button primary" disabled={busy || !data} onClick={saveDesign}>
          تطبيق على الشاشة
        </button>
      </div>
    </section>
  );
}

/** One entry point for single media and fullscreen photo playlists. Existing playlists are retained. */
export function MediaOnlyEditor() {
  const { template, setTemplate, busy } = useAdmin();
  const { permissions } = useAuth();
  const multiple = template.displayMode === 'slideshow';
  return (
    <section className="media-only-panel">
      <h2>وسائط بملء الشاشة</h2>
      {permissions.admin && (
        <div
          className="segmented media-source-tabs"
          role="tablist"
          aria-label="نوع وسائط ملء الشاشة"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!multiple}
            disabled={busy}
            onClick={() => setTemplate((t) => withDisplayMode(t, 'media'))}
          >
            صورة واحدة / فيديو
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={multiple}
            disabled={busy}
            onClick={() => setTemplate((t) => withDisplayMode(t, 'slideshow'))}
          >
            صور متعددة · عرض شرائح
          </button>
        </div>
      )}
      {multiple ? <SlideshowEditor fullscreen /> : <MediaEditor />}
    </section>
  );
}
