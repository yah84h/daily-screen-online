import type { RecognitionBoard } from '@/lib/types';
import { useEffect, useState } from 'react';
import {
  leaderboardOptions,
  useLeaderboard,
  qudratSource,
  type QudratSource,
} from '@/lib/qudratPro';
function SourceEditor({ onSaved }: { onSaved: () => void }) {
  const [status, setStatus] = useState<QudratSource | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    qudratSource('status')
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((error) => {
        if (active) setMessage((error as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);
  const run = async (action: 'save' | 'clear') => {
    setBusy(true);
    setMessage('');
    try {
      const value = await qudratSource(action, url);
      setStatus(value);
      setUrl('');
      setMessage(
        action === 'clear'
          ? 'أُزيل الرابط المحفوظ.'
          : 'تم حفظ الرابط. ' +
              (value.exams?.map((exam) => `${exam.label}: ${exam.count} طلاب`).join(' · ') ||
                'لا توجد نتائج منشورة لهذا الأسبوع بعد.'),
      );
      onSaved();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="qudrat-source-editor">
      <label>
        رابط مصدر قدرات برو (API)
        <input
          type="url"
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          aria-label="رابط مصدر قدرات برو"
          placeholder="https://….supabase.co/functions/v1/public-leaderboard?key=…"
          value={url}
          disabled={busy}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <p className="field-hint">
        {status?.configured
          ? `المصدر مهيأ (${status.host})${status.origin === 'environment' ? ' من إعدادات الخادم' : ''}. الصق رابطًا جديدًا لاستبداله.`
          : 'الصق رابط public-leaderboard الكامل مع المفتاح، ثم احفظه.'}{' '}
        يُحفظ الرابط على الخادم فقط، ولا يُعرض مجددًا ولا يصل إلى شاشات العرض.
      </p>
      <div className="button-row">
        <button
          type="button"
          className="button primary"
          disabled={busy || !url.trim()}
          onClick={() => void run('save')}
        >
          {busy ? 'جارٍ التحقق…' : 'حفظ الرابط واختباره'}
        </button>
        {status?.origin === 'panel' && (
          <button
            type="button"
            className="button white"
            disabled={busy}
            onClick={() => {
              if (confirm('إزالة رابط قدرات برو المحفوظ؟')) void run('clear');
            }}
          >
            إزالة الرابط
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="field-hint">
          {message}
        </p>
      )}
    </div>
  );
}
export function QudratProSettings({
  board,
  onChange,
}: {
  board: RecognitionBoard;
  onChange: (patch: Partial<RecognitionBoard>) => void;
}) {
  const options = leaderboardOptions(board.qudratPro);
  const state = useLeaderboard();
  const change = (patch: Partial<typeof options>) =>
    onChange({ qudratPro: { ...options, ...patch } });
  return (
    <section className="qudrat-settings">
      <div className="qudrat-settings-brand">
        <img src="/branding/qudrat-pro.png" alt="شعار قدرات برو" />
        <div>
          <h3>قدرات برو</h3>
          <p>نتائج أسبوعية من المصدر، دون إدخال الأسماء يدويًا.</p>
        </div>
      </div>
      <SourceEditor onSaved={state.refresh} />
      <label>
        الاختبار المعروض
        <select
          aria-label="اختبار قدرات برو"
          value={options.exam}
          onChange={(event) => change({ exam: event.target.value as typeof options.exam })}
        >
          <option value="weekly">قدرات عربي</option>
          <option value="gat">قدرات إنجليزي (GAT)</option>
          <option value="all">التبديل بين جميع الاختبارات</option>
        </select>
      </label>
      <label className="loop-checkbox">
        <input
          type="checkbox"
          checked={options.layout === 'podium'}
          onChange={(event) => change({ layout: event.target.checked ? 'podium' : 'list' })}
        />
        إبراز الثلاثة الأوائل في الأعلى
      </label>
      <label>
        طلاب في كل صفحة من القائمة
        <select
          aria-label="طلاب صفحة قدرات برو"
          value={options.pageSize}
          onChange={(event) => change({ pageSize: Number(event.target.value) as 2 | 3 | 4 })}
        >
          <option value="2">طالبان</option>
          <option value="3">ثلاثة طلاب</option>
          <option value="4">أربعة طلاب</option>
        </select>
      </label>
      <label>
        مدة عرض الصفحة
        <select
          aria-label="مدة صفحة قدرات برو"
          value={board.pageSeconds}
          onChange={(event) => onChange({ pageSeconds: Number(event.target.value) })}
        >
          {[6, 10, 15, 20, 30].map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} ثوانٍ
            </option>
          ))}
        </select>
      </label>
      <p className="field-hint">
        يبقى الثلاثة الأوائل ظاهرين، وتتنقل بقية القائمة تلقائيًا. تُجلب النتائج عند إعادة تحميل
        الصفحة، وتبقى آخر نتائج محفوظة عند انقطاع المصدر.
      </p>
      <div className="qudrat-source-status" role="status">
        {state.loading
          ? 'جارٍ التحقق من المصدر…'
          : state.data
            ? state.data.exams
                .map((exam) => `${exam.kind_label}: ${exam.leaders.length} طلاب`)
                .join(' · ')
            : state.error === 'OFFLINE_ONLY'
              ? 'الخادم في وضع دون اتصال؛ مصدر قدرات برو يحتاج إلى الإنترنت.'
              : state.error === 'NOT_CONFIGURED'
                ? 'يحتاج مصدر قدرات برو إلى إعداد على الخادم. تواصل مع المسؤول.'
                : 'تعذر الوصول إلى نتائج قدرات برو. حاول التحديث لاحقًا.'}
        {state.stale && ' · تُعرض آخر نتائج محفوظة.'}
      </div>
      <button type="button" className="button white" onClick={state.refresh}>
        تحديث النتائج الآن
      </button>
    </section>
  );
}
