import type { PointerEvent } from 'react';
import { Save, Upload } from 'lucide-react';
import { Screen } from '@/components/Screen';
import { defaultTemplate, type Template } from '@/lib/types';
import { useAdmin } from './store';

export function TemplateTab() {
  const { data, content, template, setTemplate, saveDesign, chooseImage, busy } = useAdmin();

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const origin = { ...template };
    const isImage = !!(e.target as HTMLElement).closest('.screen-image');
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => {
      const dx = ((ev.clientX - start.x) / rect.width) * 100;
      const dy = ((ev.clientY - start.y) / rect.height) * 100;
      setTemplate({
        ...origin,
        [isImage ? 'imageX' : 'textX']: Math.max(0, Math.min(90, (isImage ? origin.imageX : origin.textX) + dx)),
        [isImage ? 'imageY' : 'textY']: Math.max(0, Math.min(85, (isImage ? origin.imageY : origin.textY) + dy)),
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const set = <K extends keyof Template>(k: K, v: Template[K]) => setTemplate((t) => ({ ...t, [k]: v }));

  return (
    <div className="template-grid">
      <section className="preview-section">
        <div className="section-heading">
          <h2>القالب اليومي</h2>
          <span className="edit-tag">16:9 · 4K</span>
        </div>
        <div className="template-canvas" onPointerDown={onPointerDown}>
          <Screen content={content} template={{...template,displayMode:'daily'}} school={data?.school} />
        </div>
        <p className="template-tip">اسحب النص أو الصورة لتغيير موقعهما، واستخدم الإعدادات لضبط التفاصيل.</p>
        <button className="button primary" disabled={busy || !data} onClick={saveDesign}>
          <Save size={17} /> حفظ القالب
        </button>
      </section>
      <section className="editor-card template-controls">
        <h2>إعدادات القالب</h2>
        <label>
          لون الخلفية
          <input type="color" value={template.background} onChange={(e) => set('background', e.target.value)} />
        </label>
        <button className="button white" onClick={() => chooseImage('backgroundImage')}>
          <Upload size={15} /> صورة الخلفية
        </button>
        {template.backgroundImage && (
          <button className="text-button" onClick={() => set('backgroundImage', '')}>
            إزالة صورة الخلفية
          </button>
        )}
        <label>
          لون النص
          <input type="color" value={template.color} onChange={(e) => set('color', e.target.value)} />
        </label>
        <label>
          لون الشارة
          <input type="color" value={template.accent} onChange={(e) => set('accent', e.target.value)} />
        </label>
        <label>
          الخط
          <select value={template.font} onChange={(e) => set('font', e.target.value)}>
            <option value="Noto Sans Arabic">نوتو العربي</option>
            <option value="Manrope">مانروب</option>
            <option value="DM Sans">دي إم سانس</option>
            <option value="Georgia">جورجيا</option>
            <option value="Arial">أريال</option>
          </select>
        </label>
        <label>
          حجم الخط · {template.fontSize}%
          <input type="range" min="70" max="135" value={template.fontSize} onChange={(e) => set('fontSize', +e.target.value)} />
        </label>
        <label>
          عرض مربع النص
          <input type="range" min="20" max="65" value={template.textW} onChange={(e) => set('textW', +e.target.value)} />
        </label>
        <label>
          عرض الصورة
          <input type="range" min="20" max="70" value={template.imageW} onChange={(e) => set('imageW', +e.target.value)} />
        </label>
        <label>
          ارتفاع الصورة
          <input type="range" min="25" max="80" value={template.imageH} onChange={(e) => set('imageH', +e.target.value)} />
        </label>
        <label>
          التاريخ المعروض
          <select value={template.calendar || 'gregory'} onChange={(e) => set('calendar', e.target.value as Template['calendar'])}>
            <option value="gregory">ميلادي</option>
            <option value="islamic">هجري (أم القرى)</option>
            <option value="both">ميلادي وهجري</option>
          </select>
        </label>
        <label>
          محاذاة النص
          <select value={template.align || 'right'} onChange={(e) => set('align', e.target.value as Template['align'])}>
            <option value="left">يسار</option>
            <option value="center">وسط</option>
            <option value="right">يمين</option>
          </select>
        </label>
        <label>
          المسافة بين النصوص
          <input type="range" min="0.5" max="3" step="0.1" value={template.spacing} onChange={(e) => set('spacing', +e.target.value)} />
        </label>
        <label>
          طريقة عرض الصورة
          <select value={template.fit} onChange={(e) => set('fit', e.target.value as Template['fit'])}>
            <option value="cover">تغطية</option>
            <option value="contain">احتواء</option>
            <option value="fill">تمدد</option>
          </select>
        </label>
        <label>
          استدارة الزوايا · {template.radius} بكسل
          <input type="range" min="0" max="50" value={template.radius} onChange={(e) => set('radius', +e.target.value)} />
        </label>
        <button className="button white" onClick={() => setTemplate(t => ({...t, ...defaultTemplate}))}>
          إعادة ضبط التخطيط
        </button>
      </section>
    </div>
  );
}
