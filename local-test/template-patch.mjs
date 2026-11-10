/** JSON Merge Patch for template edits. Arrays replace; unknown sibling fields survive. */
export function mergeTemplatePatch(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch))
    throw Error('تعديلات القالب غير صحيحة');
  const result = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('حقل غير مسموح');
    if (value === null) delete result[key];
    else if (typeof value === 'object' && !Array.isArray(value))
      result[key] = mergeTemplatePatch(result[key], value);
    else result[key] = structuredClone(value);
  }
  return result;
}
export function saveTemplatePatch(db, args, staff, commit) {
  if (!staff?.active || !staff.permissions?.admin)
    throw Object.assign(Error('صلاحية المسؤول مطلوبة لتعديل التصميم'), { status: 403 });
  if (
    !args.p_patch ||
    typeof args.p_patch !== 'object' ||
    Array.isArray(args.p_patch) ||
    Buffer.byteLength(JSON.stringify(args.p_patch)) > 400000
  )
    throw Error('تعديلات القالب غير صحيحة أو كبيرة جدًا');
  const screen = db.screens.find((s) => s.id === args.p_screen_id);
  if (!screen) throw Error('الشاشة غير موجودة');
  const patch = { ...args.p_patch };
  delete patch.news;
  const template = mergeTemplatePatch(screen.template, patch);
  if (!['daily', 'loop', 'media', 'slideshow'].includes(template.displayMode || 'daily'))
    throw Error('وضع الشاشة غير صحيح');
  if (
    template.displayMode === 'slideshow' &&
    !template.mediaSlideshow?.images?.length &&
    !template.slideshow?.images?.length
  )
    throw Error('أضف صورًا لعرض الشرائح أولًا');
  const old = screen.template,
    updated = screen.updated_at,
    hadUpdated = Object.hasOwn(screen, 'updated_at');
  try {
    screen.template = template;
    screen.updated_at = new Date().toISOString();
    commit();
  } catch (error) {
    screen.template = old;
    if (hadUpdated) screen.updated_at = updated;
    else delete screen.updated_at;
    throw error;
  }
  return template;
}
