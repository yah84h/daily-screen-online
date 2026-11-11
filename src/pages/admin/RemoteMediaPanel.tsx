import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Download,
  SlidersHorizontal,
} from 'lucide-react';
import { RemoteDeviceReports } from './studio/RemoteDeviceReports';
import { PublishedScreenPreview } from './studio/PublishedScreenPreview';
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
      <div className="remote-control-layout">
        <div className="remote-main-controls">
          <section className="remote-transport" aria-label="التشغيل والصوت">
            <div className="remote-section-title">
              <h3>التشغيل والصوت</h3>
              <span>يُطبّق على أجهزة العرض</span>
            </div>
            {!current && (
              <p className="remote-waiting-note">
                لا يوجد تقرير مباشر حاليًا. تُحفظ إعدادات الصوت والإيقاف وتُطبّق عند اتصال الجهاز.
              </p>
            )}
            <div className="remote-playback-buttons">
              <button
                className="button primary"
                disabled={!state}
                aria-label={state?.paused ? 'تشغيل الشاشة عن بعد' : 'إيقاف الشاشة مؤقتًا عن بعد'}
                onClick={() => send({ action: 'set', patch: { paused: !state?.paused } })}
              >
                {state?.paused ? <Play size={18} /> : <Pause size={18} />}
                {state?.paused ? 'تشغيل / متابعة' : 'إيقاف مؤقت'}
              </button>
              <button
                className="button white"
                disabled={!state || !playlist}
                onClick={() => send({ action: 'previous' })}
              >
                <SkipBack size={17} />
                السابق في القائمة
              </button>
              <button
                className="button white"
                disabled={!state || !playlist}
                onClick={() => send({ action: 'next' })}
              >
                <SkipForward size={17} />
                التالي في القائمة
              </button>
            </div>
            <label className="remote-volume-label">
              <span>
                <Volume2 size={18} />
                صوت الشاشة · {Math.round(volume * 100)}٪
              </span>
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
          </section>
          <section className="remote-timeline" aria-label="موضع تشغيل الوسائط">
            <div className="remote-section-title">
              <SlidersHorizontal size={18} />
              <h3>موضع التشغيل</h3>
            </div>
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
                disabled={!state || !track?.duration}
                onClick={() => send({ action: 'seek', mode: 'relative', seconds: -10, target })}
              >
                رجوع ١٠ ثوانٍ على الشاشة
              </button>
              <button
                disabled={!state || !track?.duration}
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
          </section>
          <section className="remote-downloads" aria-label="تحضير الملفات">
            <div>
              <div className="remote-section-title">
                <Download size={18} />
                <h3>تحضير الملفات</h3>
              </div>
              <p className="field-hint">
                التحضير قبل العرض يقلّل الانتظار. قد يُعاد تنزيل الملف غير المكتمل بعد الاستئناف.
              </p>
            </div>
            <button
              className="button white"
              disabled={!state}
              aria-label={
                state?.downloadsPaused ? 'متابعة تنزيلات الشاشة' : 'إيقاف تنزيلات الشاشة مؤقتًا'
              }
              onClick={() =>
                send({ action: 'set', patch: { downloadsPaused: !state?.downloadsPaused } })
              }
            >
              {state?.downloadsPaused ? 'متابعة تنزيلات الشاشة' : 'إيقاف تنزيلات الشاشة مؤقتًا'}
            </button>
          </section>
          {remote.pending && <small role="status">جارٍ إرسال الأمر للشاشة…</small>}
          {remote.error && <p role="alert">{remote.error}</p>}
        </div>
        <aside className="remote-monitor-column">
          <PublishedScreenPreview />
          <RemoteDeviceReports reports={reports} now={now} />
        </aside>
      </div>
      <p className="field-hint">
        التحكم مباشر ولا يحتاج إعادة نشر. للتحكم بشرائح PowerPoint، افتح محتوى العرض من صفحة
        المحتوى.
      </p>
    </section>
  );
}
