import { useEffect, useRef, useState } from 'react';
import { useRemoteMedia } from '@/lib/remoteMedia';
import { useAdmin } from './store';
export function RemoteMediaPanel() {
  const { data } = useAdmin();
  if (!data) return null;
  return (
    <ScreenMediaPanel
      key={data.screen.id}
      screen={data.screen.id}
      name={data.screen.name}
      playlist={
        !!data.current?.content.videoPlaylist?.enabled &&
        !!data.current?.content.videoPlaylist.items.length
      }
    />
  );
}
function ScreenMediaPanel({
  screen,
  name,
  playlist,
}: {
  screen: string;
  name: string;
  playlist: boolean;
}) {
  const remote = useRemoteMedia(screen);
  const [volume, setVolume] = useState(1);
  const [seeking, setSeeking] = useState<number | null>(null);
  const [target, setTarget] = useState<'video' | 'audio' | 'all'>('all');
  const [now, setNow] = useState(Date.now());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editing = useRef(false);
  useEffect(() => {
    if (remote.state && !editing.current) setVolume(remote.state.volume);
  }, [remote.state?.volume]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);
  const state = remote.state;
  const reports = Object.entries(state?.reports || {}).sort(([, a], [, b]) => b.at - a.at);
  const current = reports.find(([, report]) => now - report.at < 15000)?.[1];
  const track = target === 'audio' ? current?.audio : target === 'video' ? current?.video : current;
  const send = (input: Record<string, unknown>) => void remote.send(input).catch(() => {});
  const stamp = (value: number) =>
    Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
  return (
    <section className="remote-media-panel" aria-label="التحكم عن بعد بالشاشة">
      <header>
        <div>
          <h2>التحكم بالشاشة</h2>
          <p>{name} · الأوامر تُرسل لأجهزة هذه الشاشة، لا لمعاينة الهاتف</p>
        </div>
        <span className={current ? 'remote-online' : 'remote-offline'}>
          {current ? 'الشاشة متصلة' : 'بانتظار جهاز العرض'}
        </span>
      </header>
      <div className="remote-playback-buttons">
        <button
          className="button primary"
          disabled={!state}
          aria-label={state?.paused ? 'تشغيل الشاشة عن بعد' : 'إيقاف الشاشة مؤقتًا عن بعد'}
          onClick={() => send({ action: 'set', patch: { paused: !state?.paused } })}
        >
          {state?.paused ? '▶ تشغيل / متابعة' : 'Ⅱ إيقاف مؤقت'}
        </button>
        <button
          className="button white"
          disabled={!state || !playlist}
          onClick={() => send({ action: 'previous' })}
        >
          السابق في القائمة
        </button>
        <button className="button white" disabled={!state} onClick={() => send({ action: 'next' })}>
          التالي في القائمة
        </button>
      </div>
      <label>
        صوت الشاشة · {Math.round(volume * 100)}٪
        <input
          aria-label="مستوى صوت الشاشة عن بعد"
          type="range"
          min="0"
          max="1"
          step=".01"
          value={volume}
          disabled={!state}
          onChange={(event) => {
            const value = +event.target.value;
            editing.current = true;
            setVolume(value);
            if (debounce.current) clearTimeout(debounce.current);
            debounce.current = setTimeout(() => {
              void remote
                .send({ action: 'set', patch: { volume: value } })
                .catch(() => {})
                .finally(() => {
                  editing.current = false;
                });
            }, 200);
          }}
        />
      </label>
      <div className="remote-seek">
        <select
          aria-label="الوسائط المراد التحكم بها"
          value={target}
          onChange={(event) => setTarget(event.target.value as typeof target)}
        >
          <option value="all">الفيديو وصوت الخلفية</option>
          <option value="video">الفيديو فقط</option>
          <option value="audio">الصوت فقط</option>
        </select>
        <button
          disabled={!state || !playlist}
          onClick={() => send({ action: 'seek', mode: 'relative', seconds: -10, target })}
        >
          رجوع ١٠ ثوانٍ على الشاشة
        </button>
        <button
          disabled={!state || !playlist}
          onClick={() => send({ action: 'seek', mode: 'relative', seconds: 10, target })}
        >
          تقديم ١٠ ثوانٍ على الشاشة
        </button>
      </div>
      <label>
        موضع التشغيل ·{' '}
        <span dir="ltr">
          {stamp(seeking ?? track?.position ?? 0)} / {stamp(track?.duration || 0)}
        </span>
        <input
          aria-label="موضع التشغيل على الشاشة"
          type="range"
          min="0"
          max={track?.duration || 0}
          step=".1"
          disabled={!track?.duration}
          value={Math.min(seeking ?? track?.position ?? 0, track?.duration || 0)}
          onChange={(event) => setSeeking(+event.target.value)}
          onPointerUp={(event) => {
            const value = +event.currentTarget.value;
            send({ action: 'seek', mode: 'absolute', seconds: value, target });
            setSeeking(null);
          }}
          onKeyUp={(event) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              send({
                action: 'seek',
                mode: 'absolute',
                seconds: +event.currentTarget.value,
                target,
              });
              setSeeking(null);
            }
          }}
        />
      </label>
      <button
        className="button white"
        disabled={!state}
        aria-label={
          state?.downloadsPaused ? 'متابعة تنزيلات الشاشة' : 'إيقاف تنزيلات الشاشة مؤقتًا'
        }
        onClick={() => send({ action: 'set', patch: { downloadsPaused: !state?.downloadsPaused } })}
      >
        {state?.downloadsPaused ? 'متابعة تنزيلات الشاشة' : 'إيقاف تنزيلات الشاشة مؤقتًا'}
      </button>
      {remote.pending && <small role="status">جارٍ إرسال الأمر للشاشة…</small>}
      {remote.error && <p role="alert">{remote.error}</p>}
      <div className="remote-device-reports">
        {reports.map(([id, report]) => (
          <article key={id}>
            <b>{report.label}</b>
            <small>
              {now - report.at < 15000
                ? 'متصل'
                : 'آخر تقرير منذ ' + Math.round((now - report.at) / 1000) + ' ثانية'}{' '}
              · {report.paused ? 'متوقف' : 'يعمل'}
              {report.kind === 'video' || report.kind === 'photos'
                ? ' · الملف ' + (report.index + 1)
                : ''}
            </small>
            {report.blocked && (
              <p>
                التشغيل متوقف على الجهاز؛ قد يحتاج السماح بالتشغيل أو الصوت مرة واحدة من المتصفح.
              </p>
            )}
            {report.tasks.map((task, index) => (
              <div key={index}>
                <span>{task.error || task.label}</span>
                <progress max={task.total || 1} value={task.loaded} />
              </div>
            ))}
            {!report.tasks.length && <small>لا توجد مهام تحضير جارية</small>}
          </article>
        ))}
      </div>
      <p className="field-hint">
        التحكم مباشر ولا يحتاج إعادة نشر. PowerPoint له أزرار الشرائح الخاصة به. قد يُعاد تنزيل
        الملف غير المكتمل عند متابعة التحضير.
      </p>
    </section>
  );
}
