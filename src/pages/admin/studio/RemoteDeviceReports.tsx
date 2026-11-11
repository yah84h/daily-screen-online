import { Monitor, Radio } from 'lucide-react';
import type { ScreenReport } from '@/lib/remoteMedia';

export function reportAge(at: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  const formatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
  if (seconds < 60) return formatter.format(-seconds, 'second');
  if (seconds < 3600) return formatter.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86400) return formatter.format(-Math.floor(seconds / 3600), 'hour');
  return formatter.format(-Math.floor(seconds / 86400), 'day');
}

export function RemoteDeviceReports({
  reports,
  now,
}: {
  reports: [string, ScreenReport][];
  now: number;
}) {
  return (
    <section className="remote-monitoring" aria-label="مراقبة أجهزة العرض">
      <div className="remote-section-title">
        <Radio size={18} />
        <h3>حالة أجهزة العرض</h3>
      </div>
      <p className="field-hint">تقارير من أجهزة هذه الشاشة، تتحدث أثناء فتح لوحة التحكم.</p>
      <div className="remote-device-reports">
        {!reports.length && (
          <div className="remote-empty">
            <Monitor size={28} />
            <b>بانتظار أول تقرير</b>
            <p>افتح صفحة العرض على جهاز مرتبط لتظهر حالته هنا.</p>
          </div>
        )}
        {reports.map(([id, report]) => {
          const fresh = now - report.at < 15000;
          return (
            <article key={id} className={fresh ? 'fresh' : 'stale'}>
              <div className="remote-report-title">
                <b>{report.label}</b>
                <span>{fresh ? 'متصل الآن' : 'تقرير قديم'}</span>
              </div>
              <small>
                {fresh
                  ? report.paused
                    ? 'متوقف مؤقتًا'
                    : 'يعمل'
                  : 'آخر اتصال ' + reportAge(report.at, now)}
                {fresh && (report.kind === 'video' || report.kind === 'photos')
                  ? ' · الملف ' + (report.index + 1)
                  : ''}
              </small>
              {fresh && report.blocked && (
                <p role="status">يحتاج الجهاز إلى السماح بالتشغيل أو الصوت من متصفحه.</p>
              )}
              {fresh &&
                report.tasks.map((task, index) => (
                  <div key={index}>
                    <span>{task.error || task.label}</span>
                    <progress max={task.total || 1} value={task.loaded} />
                  </div>
                ))}
              {fresh && !report.tasks.length && <small>لا توجد تنزيلات جارية</small>}
              {!fresh && <p className="field-hint">تظهر الحالة الحالية عند عودة الجهاز للاتصال.</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
