import { useEffect, useRef, useState } from 'react';
import { CustomDayScreen } from '@/components/CustomDayScreen';
import { customDayDate, type CustomDay } from '@/lib/customDays';
import { useAdmin } from './store';

export function CustomDaysEditor() {
  const { template, setTemplate, saveDesign, busy, data } = useAdmin();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const days = template.customDays || [];
  const day = days.find((item) => item.id === selected) || days[0];
  function change(next: CustomDay[]) {
    if (new TextEncoder().encode(JSON.stringify(next)).length > 300000) {
      setError('حجم التصاميم كبير. استخدم ملفات أصغر أو احذف تصميمًا قديمًا (الحد ٣٠٠ كيلوبايت).');
      return;
    }
    setError('');
    setTemplate({ ...template, customDays: next });
  }
  function patch(values: Partial<CustomDay>) {
    if (day) change(days.map((item) => (item.id === day.id ? { ...item, ...values } : item)));
  }
  function add(html: string, name: string) {
    if (days.length >= 6) {
      setError('الحد ٦ تصاميم. احذف تصميمًا قديمًا أولًا.');
      return;
    }
    if (!/<(?:html|body|div|main|section)\b/i.test(html)) {
      setError('اختر ملف HTML صالحًا.');
      return;
    }
    const id = crypto.randomUUID();
    change([
      ...days,
      {
        id,
        name,
        html,
        date: customDayDate(),
        enabled: false,
        title: 'اليوم العالمي للسكري',
        subtitle: 'وعيك اليوم يحمي صحتك غدًا',
        body: 'تعرّف على علامات انخفاض السكر وارتفاعه، وكيف تتصرف في الدقائق الأولى.',
        clock: true,
        leaderboard: false,
        boardX: 3,
        boardY: 27,
        boardW: 28,
        boardH: 54,
      },
    ]);
    setSelected(id);
  }
  async function upload(file?: File) {
    if (!file) return;
    try {
      if (!/\.html?$/i.test(file.name) || file.size > 120000)
        throw Error('اختر ملف HTML مستقلًا بحجم لا يتجاوز ١٢٠ كيلوبايت.');
      add(await file.text(), file.name.replace(/\.html?$/i, ''));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    const enabled = days.filter((item) => item.enabled);
    if (enabled.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.date))) {
      setError('حدد تاريخًا لكل تصميم مفعّل.');
      return;
    }
    if (new Set(enabled.map((item) => item.date)).size !== enabled.length) {
      setError('اختر تصميمًا مفعّلًا واحدًا فقط لكل تاريخ.');
      return;
    }
    await saveDesign();
  }
  return (
    <section className="collection-card custom-days-editor" aria-label="تصاميم المناسبات">
      <div className="section-heading">
        <div>
          <h2>تصاميم المناسبات</h2>
          <p>
            تصميم HTML لوضع الخلفية والساعة فقط، ليوم محدد، من منتصف الليل حتى نهايته بتوقيت الرياض.
            يعود العرض المعتاد تلقائيًا بعده.
          </p>
        </div>
      </div>
      <div className="custom-day-actions">
        <button className="button primary" disabled={busy} onClick={() => input.current?.click()}>
          رفع تصميم HTML
        </button>
        <button
          className="button white"
          disabled={busy}
          onClick={() =>
            void import('@/assets/custom-days/nabd.html?raw').then(({ default: nabd }) =>
              add(nabd, 'نبض — اليوم العالمي للسكري'),
            )
          }
        >
          إضافة نبض
        </button>
        <input
          ref={input}
          type="file"
          accept=".html,.htm,text/html"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      {day && (
        <>
          <div className="custom-day-fields">
            <label>
              التصميم
              <select
                aria-label="تصميم المناسبة"
                value={day.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {days.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              اسم التصميم
              <input
                value={day.name}
                onChange={(e) => patch({ name: e.target.value })}
                maxLength={100}
              />
            </label>
            <label>
              تاريخ المناسبة
              <input
                type="date"
                value={day.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </label>
            <label className="custom-day-toggle">
              <input
                type="checkbox"
                checked={day.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />
              تفعيل لهذا اليوم
            </label>
            <label>
              عنوان المناسبة
              <input
                value={day.title}
                onChange={(e) => patch({ title: e.target.value })}
                maxLength={180}
              />
            </label>
            <label>
              شعار المناسبة
              <input
                value={day.subtitle}
                onChange={(e) => patch({ subtitle: e.target.value })}
                maxLength={240}
              />
            </label>
            <label>
              وصف المناسبة
              <textarea
                value={day.body}
                onChange={(e) => patch({ body: e.target.value })}
                maxLength={2000}
              />
            </label>
            <label className="custom-day-toggle">
              <input
                type="checkbox"
                checked={day.clock}
                onChange={(e) => patch({ clock: e.target.checked })}
              />
              إظهار الساعة والتاريخ
            </label>
            <label className="custom-day-toggle">
              <input
                type="checkbox"
                checked={day.leaderboard}
                onChange={(e) => patch({ leaderboard: e.target.checked })}
              />
              إظهار لوحة التميز الحالية
            </label>
            {(['textScale', 'clockScale', 'schoolScale'] as const).map((key, index) => (
              <label key={key}>
                {['حجم نص المناسبة', 'حجم الساعة', 'حجم هوية المدرسة'][index]}
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={day[key] ?? 100}
                  onChange={(e) => patch({ [key]: Number(e.target.value) })}
                />
                <span>{day[key] ?? 100}٪</span>
              </label>
            ))}
            {day.leaderboard &&
              (['boardX', 'boardY', 'boardW', 'boardH'] as const).map((key, index) => (
                <label key={key}>
                  {
                    [
                      'موضع اللوحة أفقيًا ٪',
                      'موضع اللوحة عموديًا ٪',
                      'عرض اللوحة ٪',
                      'ارتفاع اللوحة ٪',
                    ][index]
                  }
                  <input
                    type="range"
                    min={index < 2 ? 0 : 15}
                    max={100}
                    value={day[key]}
                    onChange={(e) => patch({ [key]: Number(e.target.value) })}
                  />
                  <span>{day[key]}٪</span>
                </label>
              ))}
          </div>
          <p>
            المعاينة تعمل حتى لو لم يكن التصميم مفعّلًا. لوحة التميز تستخدم الطلاب ومصدر قدرات برو
            وإعدادات التحديث الحالية.
          </p>
          <div className="custom-day-preview">
            <CustomDayScreen
              day={day}
              template={template}
              school={data?.school || { name: '', tagline: '', logo_url: null }}
              now={now}
            />
          </div>
          <div className="custom-day-actions" style={{ marginTop: 16 }}>
            <button className="button primary" disabled={busy} onClick={() => void save()}>
              حفظ تصاميم المناسبات
            </button>
            <button
              className="button white"
              disabled={busy}
              onClick={() => {
                if (confirm('حذف هذا التصميم من الإعدادات؟ احفظ لتطبيق الحذف.'))
                  change(days.filter((item) => item.id !== day.id));
              }}
            >
              حذف التصميم
            </button>
          </div>
        </>
      )}
      <details style={{ marginTop: 16 }}>
        <summary>إعداد ملف HTML مخصص</summary>
        <p>
          استخدم ملفًا مستقلًا يتضمن التنسيق والبرامج داخله. الصور والخطوط يمكن أن تكون بروابط HTTPS
          أو مضمّنة. الملفات المحلية المجاورة والمكتبات الخارجية لا تُحمّل.
        </p>
        <p>
          للحقول المتغيرة استخدم data-school-field مع title أو subtitle أو body أو schoolName أو
          clock أو date. تصميم نبض المرفق يدعمها تلقائيًا. يُعرض الملف داخل إطار معزول دون الوصول
          إلى حساب المسؤول.
        </p>
      </details>
    </section>
  );
}
