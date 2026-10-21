import { ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, Loader2, Maximize2, Monitor, Palette, Plus, Settings, ShieldCheck, Sun, GraduationCap, Upload, X } from 'lucide-react';
import { Screen } from '@/components/Screen';
import * as api from '@/lib/api';
import { WORKSPACE_PHOTO, initialContent, type Preset } from '@/lib/types';
import { useAdmin } from './store';

const topicIcons = [ShieldCheck, BookOpen, GraduationCap, Sun];
const topicColors = ['mint', 'blue', 'peach', 'yellow'];

export function HomeTab() {
  const { data, content, edit, setContent, template, dirty, busy, run, setModal, setTab, chooseImage, notify } = useAdmin();
  const presets = data?.presets ?? [];

  const usePreset = (p: Preset) => {
    setContent({ ...initialContent, ...p.content });
    setTab('الرئيسية');
    notify('تم تحميل الموضوع. راجعه ثم انشره عندما يكون جاهزًا.');
  };

  return (
    <>
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
            <Screen content={content} template={template} school={data?.school} />
            <div className="preview-bottom">
              <span>
                <Monitor size={15} /> {data?.screen.name}
              </span>
              <button className="text-button" onClick={() => setTab('القوالب')}>
                <Palette size={14} /> تعديل القالب
              </button>
            </div>
          </div>
          <button className="button white loop-shortcut" onClick={() => setTab('خلفية الحصص')}>خلفية الحصص ولوحة التميز</button>
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
          <div className="editor-fields">
            <label>
              عنوان اليوم
              <input maxLength={100} value={content.title} onChange={(e) => edit('title', e.target.value)} placeholder="ما موضوع اليوم؟" />
            </label>
            <label>
              <span>
                العنوان الفرعي <small>اختياري</small>
              </span>
              <input maxLength={160} value={content.subtitle} onChange={(e) => edit('subtitle', e.target.value)} />
            </label>
            <label>
              الرسالة الرئيسية
              <textarea maxLength={700} rows={3} value={content.body} onChange={(e) => edit('body', e.target.value)} />
              <span className="field-hint">اجعلها مختصرة وسهلة القراءة من مسافة بعيدة.</span>
            </label>
            <div className="date-control">
              <div>
                <CalendarDays size={19} />
                <span>
                  استخدام تاريخ اليوم تلقائيًا<small>اليوم والتاريخ · توقيت جدة</small>
                </span>
              </div>
              <button role="switch" aria-checked={content.autoDate} className={'toggle ' + (content.autoDate ? 'on' : '')} onClick={() => edit('autoDate', !content.autoDate)} aria-label="استخدام تاريخ اليوم تلقائيًا">
                <i />
              </button>
            </div>
            {!content.autoDate && (
              <label>
                التاريخ
                <input type="date" value={content.date} onChange={(e) => edit('date', e.target.value)} />
              </label>
            )}
            <div className="image-label">
              الصورة الرئيسية <span>JPG أو PNG أو WEBP</span>
            </div>
            <div className="image-control">
              {content.image ? <img src={content.image} alt="" /> : <div className="image-empty" />}
              <div>
                <b>{content.image === WORKSPACE_PHOTO ? 'مساحة رقمية' : content.image ? 'صورة الشاشة' : 'بدون صورة'}</b>
                <span>مهيّأة لشاشتك</span>
                <button className="text-button" onClick={() => chooseImage('image')}>
                  <Upload size={13} /> تغيير الصورة
                </button>
              </div>
              <button className="icon-button" aria-label="إزالة الصورة" onClick={() => edit('image', '')}>
                <X size={15} />
              </button>
            </div>
            <button className="optional-button" onClick={() => setModal('optional')}>
              <Settings size={15} /> الشارة والتذييل والعناصر الاختيارية <Plus size={15} />
            </button>
          </div>
          <div className="publish-area">
            <button className="button publish" disabled={busy || !content.title.trim() || !data} onClick={() => run(() => api.publish(data!.screen.id, content), 'تم النشر. شاشتك محدثة الآن.').then((r) => r && setContent(content, false))}>
              {busy ? <Loader2 className="spin" size={18} /> : <Monitor size={18} />}
              نشر على الشاشة
            </button>
            <div>
              <button disabled={busy || !data} onClick={() => run(() => api.saveDraft(data!.screen.id, content), 'تم حفظ المسودة.')}>
                حفظ المسودة
              </button>
              <span>
                تحديث التلفزيون خلال ثوانٍ <Monitor size={12} />
              </span>
            </div>
          </div>
        </section>
      </div>
      <div className="bottom-note">
        <ShieldCheck size={14} /> تحتفظ الشاشة بآخر محتوى حتى عند انقطاع الاتصال.<span>لتحديث يومي بسيط.</span>
      </div>
    </>
  );
}
