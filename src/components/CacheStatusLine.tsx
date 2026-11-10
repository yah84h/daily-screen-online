import { useCacheTasks } from '@/lib/cacheStatus';
export function CacheStatusLine() {
  const tasks = useCacheTasks();
  if (!tasks.length) return null;
  const failed = tasks.find((t) => t.error);
  const task = failed || tasks[0];
  const percent = task.total ? Math.min(100, Math.round((task.loaded / task.total) * 100)) : null;
  return (
    <div className={'cache-status-line' + (failed ? ' failed' : '')} role="status" dir="rtl">
      <i />
      <span>{failed ? task.error : task.label}</span>
      {!failed && (
        <small>
          {percent === null ? 'جارٍ التجهيز…' : percent + '٪'}
          {tasks.length > 1 ? ' · ' + tasks.length + ' مهام' : ''}
        </small>
      )}
      {!failed && <progress max={task.total || 1} value={task.loaded} />}
    </div>
  );
}
