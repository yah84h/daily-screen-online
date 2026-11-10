import { useCacheTasks } from '@/lib/cacheStatus';
import { useDevicePlayback } from '@/lib/devicePlayback';
/** The display reports progress; playback controls live in the admin panel. */
export function CacheStatusLine() {
  const tasks = useCacheTasks();
  const device = useDevicePlayback();
  const task = tasks.find((task) => task.error) || tasks[0];
  if (!task) return null;
  const percent = task.total ? Math.min(100, Math.round((task.loaded / task.total) * 100)) : null;
  return (
    <div className={'cache-status-line' + (task.error ? ' failed' : '')} dir="rtl" role="status">
      <i />
      <span>{task.error || task.label}</span>
      <small>
        {device.downloadsPaused
          ? 'متوقف مؤقتًا'
          : percent === null
            ? 'جارٍ التجهيز…'
            : percent + '٪'}
      </small>
      {!task.error && <progress max={task.total || 1} value={task.loaded} />}
    </div>
  );
}
