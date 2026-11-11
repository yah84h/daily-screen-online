import { useState } from 'react';
import { saveTemplate } from '@/lib/api';
import { defaultTemplate, type Template, type SavedLayout } from '@/lib/types';
import { useAdmin } from './store';

const dailyKeys = [
  'imageX',
  'imageY',
  'imageW',
  'imageH',
  'textX',
  'textY',
  'textW',
  'schoolX',
  'schoolY',
  'schoolW',
  'schoolScale',
  'fontSize',
  'spacing',
  'align',
  'radius',
] as const;
const loopDefaults = {
  loopLayout: 'classic',
  loopPositions: {},
  loopHidePhoto: false,
  loopScale: 100,
  clockTextScale: 100,
  boardTextScale: 100,
  clockScale: 100,
  boardScale: 100,
  loopBranding: 'paired',
  centerPhoto: {},
} satisfies Partial<Template>;
function snapshot(template: Template, mode: SavedLayout['mode']): Partial<Template> {
  if (mode === 'loop')
    return Object.fromEntries(
      Object.entries(loopDefaults).map(([key, fallback]) => [
        key,
        template[key as keyof Template] ?? fallback,
      ]),
    );
  return Object.fromEntries(
    dailyKeys.map((key) => [
      key,
      template[key] ??
        defaultTemplate[key] ??
        (key === 'schoolScale' ? 1 : key === 'schoolW' ? 40 : key === 'align' ? 'right' : 0),
    ]),
  );
}

/** Named arrangements live in the screen template, so another admin phone can reuse them. */
export function SavedLayouts({ mode }: { mode: SavedLayout['mode'] }) {
  const { data, template, setTemplate, busy } = useAdmin();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const layouts = template.savedLayouts || [];
  const own = layouts.filter((item) => item.mode === mode);
  async function persist(next: Template) {
    if (!data || saving || busy) return;
    setSaving(true);
    setMessage('');
    try {
      await saveTemplate(data.screen.id, next);
      setTemplate(next);
      setMessage('تم حفظ القالب على هذه الشاشة.');
      setName('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="saved-layouts">
      <h3>قوالبي المحفوظة · {mode === 'daily' ? 'الشاشة اليومية' : 'خلفية الحصص'}</h3>
      <p className="field-hint">
        حرّك العناصر وغيّر أحجامها، ثم احفظ التوزيع باسم جديد. تبقى الصور والمحتوى الحالي عند تطبيق
        قالب.
      </p>
      <div className="button-row">
        <input
          aria-label="اسم القالب الجديد"
          placeholder="اسم القالب الجديد"
          maxLength={60}
          value={name}
          disabled={saving}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="button primary"
          disabled={busy || saving || !data || !name.trim() || own.length >= 20}
          onClick={() =>
            void persist({
              ...template,
              savedLayouts: [
                ...layouts,
                {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  mode,
                  patch: snapshot(template, mode),
                },
              ],
            })
          }
        >
          حفظ كتوزيع جديد
        </button>
      </div>
      {own.map((item) => (
        <div className="button-row" key={item.id}>
          <b>{item.name}</b>
          <button
            type="button"
            className="button white"
            disabled={saving || busy}
            onClick={() => {
              setTemplate({ ...template, ...item.patch, savedLayouts: layouts });
              setMessage('تم تطبيق التوزيع في المعاينة. احفظ القالب لإرساله للشاشة.');
            }}
          >
            تطبيق
          </button>
          <button
            type="button"
            className="button white"
            disabled={saving || busy}
            onClick={() =>
              void persist({
                ...template,
                savedLayouts: layouts.map((row) =>
                  row.id === item.id ? { ...row, patch: snapshot(template, mode) } : row,
                ),
              })
            }
          >
            تحديث من التوزيع الحالي
          </button>
          <button
            type="button"
            className="button white"
            disabled={saving || busy}
            onClick={() => {
              if (confirm('حذف القالب المحفوظ؟'))
                void persist({
                  ...template,
                  savedLayouts: layouts.filter((row) => row.id !== item.id),
                });
            }}
          >
            حذف
          </button>
        </div>
      ))}
      {own.length >= 20 && <p className="field-hint">الحد الأقصى ٢٠ قالبًا لكل وضع.</p>}
      {message && (
        <p role="status" className="field-hint">
          {message}
        </p>
      )}
    </section>
  );
}
