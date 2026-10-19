import { Copy, Plus, Trash2 } from 'lucide-react';
import { Screen } from '@/components/Screen';
import * as api from '@/lib/api';
import { initialContent, type Preset } from '@/lib/types';
import { useAdmin } from './store';

export function PresetsTab() {
  const { data, content, setContent, template, run, setTab, notify, openPresetEditor } = useAdmin();
  const presets = data?.presets ?? [];

  const usePreset = (p: Preset) => {
    setContent({ ...initialContent, ...p.content });
    setTab('الرئيسية');
    notify('تم تحميل الموضوع. راجعه ثم انشره عندما يكون جاهزًا.');
  };

  return (
    <>
      <div className="section-heading">
        <h2>{presets.length} موضوعًا محفوظًا</h2>
        <button className="button primary" onClick={() => openPresetEditor(null, content.title)}>
          <Plus size={17} /> حفظ المحتوى كموضوع
        </button>
      </div>
      <div className="preset-grid">
        {presets.map((p) => (
          <div className="preset-card" key={p.id}>
            <div className="preset-cover">
              <Screen content={{ ...initialContent, ...p.content }} template={template} school={data?.school} />
            </div>
            <div className="preset-body">
              <h3>{p.name}</h3>
              <p>{p.content?.title}</p>
              <button className="button primary" onClick={() => usePreset(p)}>
                استخدام هذا الموضوع
              </button>
              <div className="preset-actions">
                <button
                  onClick={() => {
                    setContent({ ...initialContent, ...p.content });
                    openPresetEditor(p.id, p.name);
                  }}
                >
                  تعديل
                </button>
                <button onClick={() => run(() => api.savePreset(p.name + ' — نسخة', p.content), 'تم إنشاء نسخة.')}>
                  <Copy size={14} /> إنشاء نسخة
                </button>
                <button aria-label="حذف الموضوع" onClick={() => confirm('حذف هذا الموضوع؟') && run(() => api.deletePreset(p.id), 'تم الحذف.')}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
