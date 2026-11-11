import { useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { RemoteMediaPanel } from './RemoteMediaPanel';
import { DailyMediaEditor } from './DailyMediaEditor';
import { CropEditor } from './CropEditor';
import { DailyMedia } from '@/components/DailyMedia';
import { BackgroundAudioEditor } from './BackgroundAudioEditor';
import { PresentationEditor } from './PresentationEditor';
import { useAuth } from '@/lib/auth';
import { mediaSlideshowOf } from '@/lib/slideshow';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Maximize2,
  Monitor,
  Palette,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  GraduationCap,
  Upload,
  X,
} from 'lucide-react';
import { Screen } from '@/components/Screen';
import * as api from '@/lib/api';
import { WORKSPACE_PHOTO, initialContent, type Preset } from '@/lib/types';
import { DisplayModes, MediaOnlyEditor } from './DisplayModes';
import { useAdmin } from './store';

const topicIcons = [ShieldCheck, BookOpen, GraduationCap, Sun];
const topicColors = ['mint', 'blue', 'peach', 'yellow'];

export function HomeTab() {
  const { permissions } = useAuth();
  const [pane, setPane] = useState('content');
  const {
    data,
    content,
    edit,
    setContent,
    template,
    dirty,
    busy,
    run,
    setModal,
    setTab,
    chooseImage,
    notify,
    publishScreen,
  } = useAdmin();
  const presets = data?.presets ?? [];

  const usePreset = (p: Preset) => {
    setContent({ ...initialContent, ...p.content });
    setTab('الرئيسية');
    notify('تم تحميل الموضوع. راجعه ثم انشره عندما يكون جاهزًا.');
  };

  return (
    <>
      <div className="home-workspace-tabs" role="tablist" aria-label="مساحة الشاشة">
        {[
          ['content', 'المحتوى', '01'],
          ['remote', 'التحكم المباشر', '02'],
          ...(permissions.admin ? [['display', 'وضع العرض', '03']] : []),
        ].map(([id, label, number]) => (
          <button
            key={id}
            id={'workspace-tab-' + id}
            role="tab"
            aria-selected={pane === id}
            aria-controls={'workspace-panel-' + id}
            tabIndex={pane === id ? 0 : -1}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const buttons = Array.from(
                event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ),
              );
              const index = buttons.indexOf(event.currentTarget);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? buttons.length - 1
                    : (index + (event.key === 'ArrowLeft' ? 1 : -1) + buttons.length) %
                      buttons.length;
              buttons[next].focus();
              buttons[next].click();
            }}
            onClick={() => setPane(id)}
          >
            <small>{number}</small>
            {label}
          </button>
        ))}
      </div>
      {pane === 'remote' && (
        <div id="workspace-panel-remote" role="tabpanel" aria-labelledby="workspace-tab-remote">
          <RemoteMediaPanel />
        </div>
      )}
      {pane === 'display' && permissions.admin && (
        <div
          className="display-workspace"
          id="workspace-panel-display"
          role="tabpanel"
          aria-labelledby="workspace-tab-display"
        >
          <h2>اختر تجربة العرض</h2>
          <p className="field-hint">حدّد ما يظهر على الشاشة، ثم طبّق الوضع.</p>
          <DisplayModes />
        </div>
      )}
      {pane === 'content' && (
        <div id="workspace-panel-content" role="tabpanel" aria-labelledby="workspace-tab-content">
          <div className="overview-grid">
            <section className="preview-section">
              <div className="section-heading">
                <h2>المعروض على شاشتك</h2>
                <button className="text-button" onClick={() => setModal('preview')}>
                  <Maximize2 size={15} /> معاينة
                </button>
              </div>
              <div className="preview-card">
                <div className="preview-toolbar">
                  <span>
                    <i /> {dirty ? 'معاينة المسودة' : 'الشاشة الحالية'}
                  </span>
                  <span>
                    16:9 <span className="divider">|</span> جاهزة لدقة 4K
                  </span>
                </div>
                <Screen
                  content={content}
                  template={template}
                  school={data?.school}
                  presentationContext={
                    template.displayMode === 'presentation' && data
                      ? { screenId: data.screen.id }
                      : undefined
                  }
                />
                <div className="preview-bottom">
                  <span>
                    <Monitor size={15} /> {data?.screen.name}
                  </span>
                  <button
                    className="text-button"
                    disabled={!permissions.admin}
                    onClick={() => setTab('القوالب')}
                  >
                    <Palette size={14} /> تعديل القالب
                  </button>
                </div>
              </div>
              <button
                disabled={!permissions.admin}
                className="button white loop-shortcut"
                onClick={() => setTab('خلفية الحصص')}
              >
                خلفية الحصص ولوحة التميز
              </button>
              <div className="design-note">
                <div>
                  <CheckCircle2 size={18} />
                </div>
                <span>
                  <b>تصميم واحد، ومحتوى يتجدد.</b>
                  <p>القالب ثابت. حدّث محتوى اليوم فقط.</p>
                </span>
              </div>
              <div className="section-heading topics-heading">
                <h2>ابدأ بموضوع محفوظ</h2>
                <button className="text-button" onClick={() => setTab('المواضيع المحفوظة')}>
                  عرض الكل <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="quick-topics">
                {presets.slice(0, 3).map((p, i) => {
                  const Icon = topicIcons[i] || BookOpen;
                  return (
                    <button key={p.id} onClick={() => usePreset(p)}>
                      <div className={'topic-icon ' + (topicColors[i] || 'mint')}>
                        <Icon size={21} />
                      </div>
                      <b>{p.name}</b>
                      <span>
                        استخدام الموضوع <Plus size={13} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="editor-card">
              <div className="editor-title">
                <div>
                  <h2>محتوى اليوم</h2>
                  <p>تعديلات بسيطة ليوم جديد.</p>
                </div>
                <span className="edit-tag">{dirty ? 'غير محفوظ' : 'تحديث يومي'}</span>
              </div>
              <fieldset className="editor-fields" disabled={!data || busy}>
                <SettingsSection
                  title="موسيقى الخلفية"
                  description="الصوت، التكرار والتحضير المسبق"
                >
                  <BackgroundAudioEditor />
                </SettingsSection>
                {template.displayMode === 'presentation' && <PresentationEditor />}
                {(template.displayMode === 'media' || template.displayMode === 'slideshow') && (
                  <MediaOnlyEditor />
                )}
                {template.displayMode !== 'slideshow' &&
                  template.displayMode !== 'presentation' && (
                    <>
                      <label>
                        عنوان اليوم
                        <input
                          maxLength={100}
                          value={content.title}
                          onChange={(e) => edit('title', e.target.value)}
                          placeholder="ما موضوع اليوم؟"
                        />
                      </label>
                      <label>
                        <span>
                          العنوان الفرعي <small>اختياري</small>
                        </span>
                        <input
                          maxLength={160}
                          value={content.subtitle}
                          onChange={(e) => edit('subtitle', e.target.value)}
                        />
                      </label>
                      <label>
                        الرسالة الرئيسية
                        <textarea
                          maxLength={700}
                          rows={3}
                          value={content.body}
                          onChange={(e) => edit('body', e.target.value)}
                        />
                        <span className="field-hint">
                          اجعلها مختصرة وسهلة القراءة من مسافة بعيدة.
                        </span>
                      </label>
                      <div className="date-control">
                        <div>
                          <CalendarDays size={19} />
                          <span>
                            استخدام تاريخ اليوم تلقائيًا<small>اليوم والتاريخ · توقيت جدة</small>
                          </span>
                        </div>
                        <button
                          role="switch"
                          aria-checked={content.autoDate}
                          className={'toggle ' + (content.autoDate ? 'on' : '')}
                          onClick={() => edit('autoDate', !content.autoDate)}
                          aria-label="استخدام تاريخ اليوم تلقائيًا"
                        >
                          <i />
                        </button>
                      </div>
                      {!content.autoDate && (
                        <label>
                          التاريخ
                          <input
                            type="date"
                            value={content.date}
                            onChange={(e) => edit('date', e.target.value)}
                          />
                        </label>
                      )}
                      <SettingsSection
                        title="الصورة والفيديو"
                        description="رفع الوسائط، الروابط وضبط القص"
                      >
                        <DailyMediaEditor />
                        {content.image && (
                          <CropEditor
                            value={content.imageCrop}
                            onChange={(value) => edit('imageCrop', value)}
                            label="قص وسائط الشاشة اليومية"
                          />
                        )}
                        <div className="image-label">
                          وسائط الشاشة اليومية <span>صورة / GIF / MP4 / WEBM</span>
                        </div>
                        <div className="image-control">
                          {content.image ? (
                            <div className="daily-media-preview">
                              <DailyMedia
                                src={content.image}
                                type={content.imageType}
                                large={false}
                                crop={content.imageCrop}
                              />
                            </div>
                          ) : (
                            <div className="image-empty" />
                          )}
                          <div>
                            <b>
                              {content.image === WORKSPACE_PHOTO
                                ? 'مساحة رقمية'
                                : content.image
                                  ? 'صورة الشاشة'
                                  : 'بدون صورة'}
                            </b>
                            <span>مهيّأة لشاشتك</span>
                            <button className="text-button" onClick={() => chooseImage('image')}>
                              <Upload size={13} /> تغيير الصورة أو الفيديو
                            </button>
                          </div>
                          <button
                            className="icon-button"
                            aria-label="إزالة الصورة"
                            onClick={() => edit('image', '')}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </SettingsSection>
                      <button className="optional-button" onClick={() => setModal('optional')}>
                        <Settings size={15} /> الشارة والتذييل والعناصر الاختيارية{' '}
                        <Plus size={15} />
                      </button>
                    </>
                  )}
              </fieldset>
              <div className="publish-area">
                <button
                  className="button publish"
                  disabled={
                    busy ||
                    (template.displayMode === 'presentation'
                      ? !content.presentation?.slides.length
                      : template.displayMode === 'slideshow'
                        ? !mediaSlideshowOf(template).images.length
                        : template.displayMode === 'media'
                          ? !(
                              content.fullMedia ||
                              (content.videoPlaylist?.enabled && content.videoPlaylist.items.length)
                            )
                          : !content.title.trim()) ||
                    !data
                  }
                  onClick={publishScreen}
                >
                  {busy ? <Loader2 className="spin" size={18} /> : <Monitor size={18} />}
                  نشر على الشاشة
                </button>
                <div>
                  <button
                    disabled={busy || !data}
                    onClick={() =>
                      run(() => api.saveDraft(data!.screen.id, content), 'تم حفظ المسودة.')
                    }
                  >
                    حفظ المسودة
                  </button>
                  <span>
                    تحديث التلفزيون خلال ثوانٍ <Monitor size={12} />
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      <div className="bottom-note">
        <ShieldCheck size={14} /> تحتفظ الشاشة بآخر محتوى حتى عند انقطاع الاتصال.
        <span>لتحديث يومي بسيط.</span>
      </div>
    </>
  );
}
