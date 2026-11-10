import fs from 'node:fs';
import path from 'node:path';
export function cleanupMedia(db, mediaDir, staff, remove = false) {
  if (!staff?.active || !staff.permissions?.admin)
    throw Object.assign(Error('صلاحية المسؤول مطلوبة'), { status: 403 });
  const used = new Set();
  function collect(value) {
    if (typeof value === 'string' && value.includes('/storage/v1/object/public/media/')) {
      try {
        const pathname = new URL(value, 'http://local.invalid').pathname;
        const relative = decodeURIComponent(
          pathname.split('/storage/v1/object/public/media/')[1] || '',
        );
        if (relative) used.add(relative);
      } catch {
        throw Error('تعذر التحقق من أحد روابط الصور؛ لم نحذف أي ملف');
      }
    } else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(db);
  const unused = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && !entry.name.includes('.part-')) {
        const relative = path.relative(mediaDir, file).split(path.sep).join('/');
        if (!used.has(relative)) unused.push({ file, bytes: fs.statSync(file).size });
      }
    }
  }
  for (const folder of ['content', 'backgrounds', 'logos', 'legacy'])
    walk(path.join(mediaDir, folder));
  let removed = 0,
    reclaimed = 0,
    failed = 0;
  if (remove)
    for (const item of unused) {
      try {
        fs.unlinkSync(item.file);
        removed++;
        reclaimed += item.bytes;
      } catch {
        failed++;
      }
    }
  return {
    count: unused.length,
    bytes: unused.reduce((n, v) => n + v.bytes, 0),
    removed,
    reclaimed,
    failed,
  };
}
