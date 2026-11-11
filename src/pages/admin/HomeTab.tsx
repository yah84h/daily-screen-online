import { useState } from 'react';
import {
  Check,
  FileText,
  Image,
  Maximize2,
  Monitor,
  Music2,
  Palette,
  Save,
  Send,
} from 'lucide-react';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { mediaSlideshowOf } from '@/lib/slideshow';
import * as api from '@/lib/api';
import { useAdmin } from './store';
import { DailyContentFields } from './studio/DailyContentFields';
import { DailyMediaFields } from './studio/DailyMediaFields';
import { BackgroundAudioEditor } from './BackgroundAudioEditor';
import { PresentationEditor } from './PresentationEditor';
import { MediaOnlyEditor } from './DisplayModes';

const modeNames = {
  daily: 'الشاشة اليومية',
  loop: 'الخلفية والساعة',
  media: 'صورة أو فيديو',
  slideshow: 'شرائح الصور',
  presentation: 'PowerPoint',
};

export function HomeTab() {
  const { permissions } = useAuth();
  const {
    data,
    content,
    template,
    dirty,
    templateDirty,
    busy,
    setModal,
    setTab,
    publishScreen,
    run,
  } = useAdmin();
  const [tool, setTool] = useState('text');
  const mode = template.displayMode || 'daily';
  const daily = mode === 'daily' || mode === 'loop';
  const tools = [
    { id: 'text', label: daily ? 'النص' : 'المحتوى', icon: FileText },
    ...(daily ? [{ id: 'media', label: 'الصور والفيديو', icon: Image }] : []),
    { id: 'audio', label: 'صوت الخلفية', icon: Music2 },
  ];
  const selected = tools.some((item) => item.id === tool) ? tool : 'text';
  const ready =
    mode === 'presentation'
      ? !!content.presentation?.slides.length
      : mode === 'slideshow'
        ? !!mediaSlideshowOf(template).images.length
        : mode === 'media'
          ? !!(
              content.fullMedia ||
              (content.videoPlaylist?.enabled && content.videoPlaylist.items.length)
            )
          : !!content.title.trim();
  return (
    <div className="studio-composer">
      <div className="studio-mode-strip">
        <span>
          <Monitor size={18} />
          <b>{modeNames[mode]}</b>
          <small>نوع العرض الحالي</small>
        </span>
        {permissions.admin && (
          <button onClick={() => setTab('طريقة العرض')}>تغيير نوع العرض</button>
        )}
      </div>
      <div className="studio-compose-grid">
        <section className="studio-editor" aria-label="تحرير محتوى الشاشة">
          <div className="studio-panel-heading">
            <div>
              <h2>جهّز محتواك</h2>
              <p>التغييرات تظهر في المعاينة مباشرة.</p>
            </div>
            <span className={'studio-draft-tag' + (dirty || templateDirty ? ' changed' : '')}>
              {dirty || templateDirty ? 'تعديلات غير منشورة' : 'جاهز للتعديل'}
            </span>
          </div>
          <nav className="studio-editor-nav" aria-label="تحرير المحتوى">
            {tools.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={selected === id ? 'page' : undefined}
                onClick={() => setTool(id)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          <fieldset disabled={!data || busy} className="studio-editor-body" key={selected}>
            {selected === 'text' && daily && <DailyContentFields />}
            {selected === 'text' && mode === 'presentation' && <PresentationEditor />}
            {selected === 'text' && (mode === 'media' || mode === 'slideshow') && (
              <MediaOnlyEditor />
            )}
            {selected === 'media' && <DailyMediaFields />}
            {selected === 'audio' && (
              <section aria-label="صوت الخلفية">
                <BackgroundAudioEditor />
              </section>
            )}
          </fieldset>
        </section>
        <section className="studio-preview" aria-label="معاينة المحتوى">
          <div className="studio-panel-heading">
            <div>
              <h2>هكذا ستظهر شاشتك</h2>
              <p>{data?.screen.name}</p>
            </div>
            <button
              className="icon-button"
              aria-label="تكبير المعاينة"
              onClick={() => setModal('preview')}
            >
              <Maximize2 size={18} />
            </button>
          </div>
          <div className="studio-display-frame">
            <div className="studio-display-caption">
              <span>
                <i />
                معاينة المحتوى
              </span>
              <span>16:9 · 4K</span>
            </div>
            <div className="preview-card">
              <Screen
                content={content}
                template={template}
                school={data?.school}
                presentationContext={
                  mode === 'presentation' && data ? { screenId: data.screen.id } : undefined
                }
              />
            </div>
            <div className="studio-display-base">
              <span>
                <Monitor size={15} />
                {modeNames[mode]}
              </span>
              <span>معاينة صامتة</span>
            </div>
          </div>
          <div className="studio-preview-actions">
            {permissions.admin && (
              <button
                className="button white"
                onClick={() => setTab(mode === 'loop' ? 'خلفية الحصص' : 'القوالب')}
              >
                <Palette size={17} />
                تعديل التصميم
              </button>
            )}
          </div>
          <div className="studio-preview-note">
            <Check size={17} />
            <p>راجع المعاينة ثم انشر. لن تتغير شاشة العرض أثناء تعديلك للمسودة.</p>
          </div>
        </section>
      </div>
      <div className="studio-publish-bar">
        <div className="studio-publish-status">
          <span className="studio-publish-icon">
            <Monitor size={20} />
          </span>
          <div>
            <b>{data?.screen.name || 'شاشتك'}</b>
            <small>
              {dirty || templateDirty ? 'التعديلات جاهزة للإرسال' : 'المحتوى الحالي في المعاينة'}
            </small>
          </div>
        </div>
        <div className="studio-publish-actions">
          <button
            className="button white"
            disabled={!data || busy}
            onClick={() => run(() => api.saveDraft(data!.screen.id, content), 'تم حفظ المسودة.')}
          >
            <Save size={17} />
            حفظ المسودة
          </button>
          <button
            className="button primary"
            disabled={!data || busy || !ready}
            onClick={publishScreen}
          >
            <Send size={18} />
            {busy ? 'جارٍ الحفظ…' : 'نشر على الشاشة'}
          </button>
        </div>
      </div>
    </div>
  );
}
