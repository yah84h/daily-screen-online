import { CropEditor } from './CropEditor';
import { VideoPlaylistEditor } from './VideoPlaylistEditor';
import { RotationEditor } from './RotationEditor';
import { DriveVideoEditor } from './DriveVideoEditor';
import { useAuth } from '@/lib/auth';
import { withDisplayMode } from '@/lib/slideshow';
import { Clock, Images, Image as ImageIcon, PanelsTopLeft, Monitor, Upload, X } from 'lucide-react';
import { SlideshowEditor } from './SlideshowEditor';
import { useAdmin } from './store';
const modes = [
  ['daily', 'المحتوى اليومي', 'رسالة وصورة بهوية المدرسة', PanelsTopLeft],
  ['media', 'صورة / فيديو فقط', 'ملء الشاشة دون أي عناصر', ImageIcon],
  ['slideshow', 'عرض شرائح الصور', 'صور متتابعة بملء الشاشة', Images],
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

export function FullMediaEditor() {
  const { content, edit, chooseImage, busy } = useAdmin();
  return (
    <section className="full-media-editor">
      <h2>صورة / فيديو بملء الشاشة</h2>
      <DriveVideoEditor />
      {content.fullMedia && (
        <CropEditor
          value={content.fullCrop}
          onChange={(value) => edit('fullCrop', value)}
          label="قص وسائط ملء الشاشة"
        />
      )}
      <VideoPlaylistEditor />
      <p className="field-hint">
        MP4 أو WEBM أو GIF متحرك، أو صورة PNG / JPG / WEBP. بلا حد حجم ثابت داخل التطبيق؛ حدود
        التخزين السحابي ومساحة الجهاز تظل مطبّقة.
      </p>
      <button className="button white" disabled={busy} onClick={() => chooseImage('fullMedia')}>
        <Upload size={18} />
        {content.fullMedia ? 'تغيير الوسائط' : 'رفع صورة أو فيديو'}
      </button>
      {content.fullMedia && (
        <>
          <p className="field-hint">
            {content.fullType === 'audio'
              ? 'الصوت جاهز'
              : content.fullType === 'video'
                ? 'الفيديو جاهز'
                : 'الصورة جاهزة'}{' '}
            · انشر المحتوى لتطبيقه.
          </p>
          <button className="text-button" onClick={() => edit('fullMedia', '')}>
            <X size={16} />
            إزالة الوسائط
          </button>
        </>
      )}
      <label className="loop-checkbox">
        <input
          type="checkbox"
          checked={content.videoSound !== false}
          onChange={(e) => edit('videoSound', e.target.checked)}
        />
        تشغيل الصوت على التلفزيون
      </label>
      <p className="field-hint">
        قد يطلب المتصفح ضغطة واحدة على شاشة التلفزيون للسماح بالصوت. المعاينة صامتة.
      </p>
      <label>
        بعد انتهاء الفيديو
        <select
          aria-label="بعد انتهاء الفيديو"
          value={content.videoLoop === false ? 'stop' : 'loop'}
          onChange={(e) => edit('videoLoop', e.target.value === 'loop')}
        >
          <option value="loop">تكرار الفيديو</option>
          <option value="stop">إيقاف عند آخر إطار</option>
        </select>
      </label>
      <label className="loop-checkbox">
        <input
          type="checkbox"
          checked={!!content.videoControls}
          onChange={(e) => edit('videoControls', e.target.checked)}
        />
        إظهار أزرار تشغيل وإيقاف الفيديو
      </label>
      <label>
        ملاءمة الوسائط
        <select
          value={content.mediaFit || 'cover'}
          onChange={(e) => edit('mediaFit', e.target.value)}
        >
          <option value="contain">احتواء · عرض الملف كاملًا</option>
          <option value="cover">تغطية · ملء الشاشة مع القص</option>
          <option value="fill">تمدد</option>
        </select>
      </label>
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
      {multiple ? <SlideshowEditor fullscreen /> : <FullMediaEditor />}
    </section>
  );
}
