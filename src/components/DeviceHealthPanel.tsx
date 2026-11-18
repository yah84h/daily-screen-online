import { useEffect, useState } from 'react';
import { onTvStatus, sendTvCommand } from '@/lib/tvHealth';
import { tokenTag, type DeviceStatus, type TvCommandName } from '@/lib/tvWatchdog';
import type { Device } from '@/lib/types';

const MODES: Record<string, string> = {
  daily: 'الشاشة اليومية',
  loop: 'العرض المتكرر',
  presentation: 'عرض تقديمي',
  show: 'عرض مُعد',
  pending: 'بانتظار الربط',
  loading: 'يبدأ التشغيل',
};
const time = (t: number | string) =>
  new Date(t).toLocaleString('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh',
    dateStyle: 'short',
    timeStyle: 'short',
  });

/** Remote control and health of the TVs paired to one screen (self-contained; no admin styles changed). */
export function DeviceHealthPanel({ screenId, devices }: { screenId: string; devices: Device[] }) {
  const [live, setLive] = useState<Record<string, DeviceStatus>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    const off = onTvStatus(screenId, (s) => setLive((m) => ({ ...m, [s.tag]: s })));
    const t = setInterval(() => tick((n) => n + 1), 15_000); // refresh "online" labels
    // Ask every TV to report now instead of waiting for its next heartbeat.
    void sendTvCommand(screenId, 'all', 'ping').catch(() => {});
    return () => {
      off();
      clearInterval(t);
    };
  }, [screenId]);

  const send = async (target: string, name: TvCommandName, label: string) => {
    setBusy(target + name);
    setMessage('');
    try {
      await sendTvCommand(screenId, target, name);
      setMessage('أُرسل الأمر: ' + label);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const controls = (target: string, blackout?: boolean) => (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button
        className="button white"
        disabled={!!busy}
        onClick={() => send(target, 'reload', 'إعادة التحميل')}
      >
        إعادة تحميل
      </button>
      <button
        className="button white"
        disabled={!!busy}
        onClick={() =>
          confirm('إعادة تشغيل العرض بأحدث نسخة من الموقع؟') &&
          send(target, 'restart', 'إعادة التشغيل')
        }
      >
        إعادة تشغيل
      </button>
      {blackout ? (
        <button
          className="button white"
          disabled={!!busy}
          onClick={() => send(target, 'wake', 'إظهار العرض')}
        >
          إظهار العرض
        </button>
      ) : (
        <button
          className="button white"
          disabled={!!busy}
          onClick={() => send(target, 'blackout', 'شاشة سوداء')}
        >
          شاشة سوداء
        </button>
      )}
      {target === 'all' && (
        <button
          className="button white"
          disabled={!!busy}
          onClick={() => send('all', 'wake', 'إظهار العرض')}
        >
          إظهار العرض
        </button>
      )}
    </span>
  );

  const tvs = devices.filter((d) => d.screen_id);
  if (!tvs.length) return null;

  return (
    <div className="device-list device-health" data-testid="device-health">
      <b>حالة الأجهزة والتحكم عن بُعد</b>
      {tvs.length > 1 && (
        <div className="list-row">
          <span>
            <b>كل الأجهزة</b>
          </span>
          {controls('all')}
        </div>
      )}
      {tvs.map((d) => {
        const tag = tokenTag(d.token);
        const s = live[tag] || d.status || null;
        const seen = Math.max(s?.at || 0, d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0);
        const online = seen > 0 && Date.now() - seen < 90_000;
        const errors = s?.errors || [];
        return (
          <div className="list-row" key={d.token} style={{ flexWrap: 'wrap', gap: 8 }}>
            <span>
              <b>
                {online ? '🟢 ' : '🔴 '}
                {d.label || 'تلفزيون'}
              </b>
              <small>
                {online ? 'متصل الآن' : seen ? 'آخر ظهور: ' + time(seen) : 'لم يتصل بعد'}
                {s && (
                  <>
                    {' · '}
                    {s.blackout ? 'شاشة سوداء' : MODES[s.mode] || s.mode}
                    {!s.online && ' · يعرض المحتوى المحفوظ'}
                    {s.failures > 0 && ` · ${s.failures} محاولة اتصال فاشلة`}
                  </>
                )}
              </small>
              {s && (
                <small dir="ltr" style={{ opacity: 0.7 }}>
                  v {s.version} · تشغيل منذ {time(s.startedAt)}
                </small>
              )}
              {!!errors.length && (
                <details>
                  <summary>آخر الأخطاء ({errors.length})</summary>
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {errors
                      .slice()
                      .reverse()
                      .map((e) => (
                        <li key={e.at}>
                          <small>
                            {time(e.at)}: <span dir="auto">{e.message}</span>
                          </small>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </span>
            {controls(tag, s?.blackout)}
          </div>
        );
      })}
      {message && <small role="status">{message}</small>}
    </div>
  );
}
