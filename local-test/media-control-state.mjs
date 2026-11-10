const fail = (message, status = 400) => Object.assign(Error(message), { status });
const bounded = (value, min, max, fallback = 0) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function playbackState(raw) {
  return {
    revision: Number.isSafeInteger(raw?.revision) ? raw.revision : 0,
    paused: raw?.paused === true,
    volume: bounded(raw?.volume, 0, 1, 1),
    downloadsPaused: raw?.downloadsPaused === true,
    command: raw?.command || null,
    watchUntil: bounded(raw?.watchUntil, 0, Number.MAX_SAFE_INTEGER),
    reports: raw?.reports && typeof raw.reports === 'object' ? raw.reports : {},
  };
}
export function mediaControlStep(raw, input, device, now = Date.now()) {
  const state = playbackState(raw);
  if (device && !['state', 'report'].includes(input.action))
    throw fail('جهاز العرض يستقبل الأوامر فقط.', 403);
  if (input.action === 'state') return state;
  let next = { ...state, revision: state.revision + 1 };
  if (input.action === 'watch') {
    next.watchUntil = now + 45000;
    return next;
  }
  if (input.action === 'set') {
    if (!input.patch || typeof input.patch !== 'object') throw fail('حدد إعدادات التشغيل.');
    const keys = Object.keys(input.patch);
    if (!keys.length || keys.some((key) => !['paused', 'volume', 'downloadsPaused'].includes(key)))
      throw fail('إعداد تشغيل غير صالح.');
    for (const key of keys) {
      const value = input.patch[key];
      if (key === 'volume') {
        if (!Number.isFinite(value) || value < 0 || value > 1) throw fail('مستوى الصوت غير صالح.');
      } else if (typeof value !== 'boolean') throw fail('قيمة تشغيل غير صالحة.');
      next[key] = value;
    }
    if ('paused' in input.patch)
      next.command = {
        id: String(next.revision) + ':' + now,
        action: input.patch.paused ? 'pause' : 'play',
        at: now,
      };
  } else if (input.action === 'seek') {
    if (
      !['relative', 'absolute'].includes(input.mode) ||
      !Number.isFinite(input.seconds) ||
      Math.abs(input.seconds) > 86400 ||
      (input.mode === 'absolute' && input.seconds < 0) ||
      !['video', 'audio', 'all'].includes(input.target || 'all')
    )
      throw fail('موضع تشغيل غير صالح.');
    next.command = {
      id: String(next.revision) + ':' + now,
      action: 'seek',
      mode: input.mode,
      seconds: input.seconds,
      target: input.target || 'all',
      at: now,
    };
  } else if (['next', 'previous'].includes(input.action))
    next.command = { id: String(next.revision) + ':' + now, action: input.action, at: now };
  else if (input.action === 'report') {
    if (!device) throw fail('تقرير جهاز العرض يحتاج رمز الربط.', 403);
    const report = input.report || {};
    const track = (value) =>
      value && typeof value === 'object'
        ? {
            position: bounded(value.position, 0, 86400),
            duration: bounded(value.duration, 0, 86400),
            paused: value.paused === true,
          }
        : null;
    const tasks = Array.isArray(report.tasks)
      ? report.tasks.slice(0, 8).map((task) => ({
          label: String(task.label || '').slice(0, 160),
          loaded: bounded(task.loaded, 0, 2 ** 32),
          total: bounded(task.total, 0, 2 ** 32),
          error: task.error ? String(task.error).slice(0, 180) : '',
        }))
      : [];
    const reports = Object.fromEntries(
      Object.entries(state.reports)
        .filter(([, value]) => value && value.at > now - 120000)
        .slice(-11),
    );
    reports[device.id] = {
      label: String(device.label || 'جهاز العرض').slice(0, 80),
      at: now,
      paused: report.paused === true,
      volume: bounded(report.volume, 0, 1),
      position: bounded(report.position, 0, 86400),
      duration: bounded(report.duration, 0, 86400),
      kind: ['video', 'audio', 'presentation', 'photos', 'none'].includes(report.kind)
        ? report.kind
        : 'none',
      index: bounded(report.index, 0, 10000),
      tasks,
      audio: track(report.audio),
      video: track(report.video),
      blocked: report.blocked === true,
    };
    next.reports = reports;
  } else throw fail('أمر تشغيل غير صالح.');
  return next;
}
