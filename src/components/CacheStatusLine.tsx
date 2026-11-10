import { useState } from 'react';
import { useCacheTasks } from '@/lib/cacheStatus';
import { changeDevicePlayback, useDevicePlayback } from '@/lib/devicePlayback';
export function CacheStatusLine() {
  const tasks = useCacheTasks();
  const device = useDevicePlayback();
  const [open, setOpen] = useState(false);
  const task = tasks.find((task) => task.error) || tasks[0];
  const percent = task?.total ? Math.min(100, Math.round((task.loaded / task.total) * 100)) : null;
  const seek = (seconds: number) =>
    document.querySelectorAll<HTMLMediaElement>('.tv video,.tv audio').forEach((media) => {
      if (Number.isFinite(media.duration))
        media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + seconds));
    });
  return (
    <>
      <div
        className={task ? 'cache-status-line' + (task.error ? ' failed' : '') : 'playback-toolbar'}
        dir="rtl"
      >
        {task && (
          <>
            <i />
            <span role="status">{task.error || task.label}</span>
            <small>
              {device.downloadsPaused
                ? 'متوقف مؤقتًا'
                : percent === null
                  ? 'جارٍ التجهيز…'
                  : percent + '٪'}
            </small>
            {!task.error && <progress max={task.total || 1} value={task.loaded} />}
          </>
        )}
        <button
          className="playback-toggle"
          aria-label="التحكم بالوسائط والتنزيل"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          ☷
        </button>
      </div>
      {open && (
        <section className="playback-panel" dir="rtl" aria-label="تحكم جهاز العرض">
          <b>الوسائط · هذا الجهاز</b>
          <button
            aria-label={device.paused ? 'متابعة جميع الوسائط' : 'إيقاف جميع الوسائط مؤقتًا'}
            onClick={() => changeDevicePlayback({ paused: !device.paused })}
          >
            {device.paused ? '▶ متابعة الوسائط' : 'Ⅱ إيقاف مؤقت'}
          </button>
          <label>
            مستوى الصوت · {Math.round(device.volume * 100)}٪
            <input
              aria-label="مستوى صوت جهاز العرض"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={device.volume}
              onChange={(event) => changeDevicePlayback({ volume: +event.target.value })}
            />
          </label>
          <div>
            <button onClick={() => seek(-10)}>رجوع ١٠ ثوانٍ</button>
            <button onClick={() => seek(10)}>تقديم ١٠ ثوانٍ</button>
          </div>
          <button
            aria-label={device.downloadsPaused ? 'متابعة التنزيلات' : 'إيقاف التنزيلات مؤقتًا'}
            onClick={() => changeDevicePlayback({ downloadsPaused: !device.downloadsPaused })}
          >
            {device.downloadsPaused ? 'متابعة التنزيلات' : 'إيقاف التنزيلات مؤقتًا'}
          </button>
          <small>
            الملفات المكتملة محفوظة. عند المتابعة يُعاد تجهيز الملف غير المكتمل فقط؛ وقد تُعاد شرائح
            العرض غير المحفوظة.
          </small>
          {tasks.map((task, index) => (
            <div className="download-task" key={index}>
              <span>{task.error || task.label}</span>
              <progress max={task.total || 1} value={task.loaded} />
            </div>
          ))}
          <button onClick={() => setOpen(false)}>إغلاق</button>
        </section>
      )}
    </>
  );
}
