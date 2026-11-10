import { isDeepStrictEqual } from 'node:util';

/** Atomic, retry-safe local equivalent of publish_from_iphone. No cloud access. */
export function publishFromIphone(db, args, staff, commit) {
  const fail = (message, status = 400) => {
    throw Object.assign(Error(message), { status });
  };
  if (!staff?.active || !(staff.permissions?.admin || staff.permissions?.daily))
    fail('لا تملك صلاحية نشر المحتوى', 403);
  const { p_screen_id: screenID, p_content: content, p_mode: mode, p_request_id: requestID } = args;
  if (
    typeof requestID !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestID)
  )
    fail('معرّف الطلب غير صحيح');
  if (
    !['daily', 'media'].includes(mode) ||
    !content ||
    typeof content !== 'object' ||
    Array.isArray(content)
  )
    fail('المحتوى أو وضع العرض غير صحيح');
  if (Buffer.byteLength(JSON.stringify(content)) > 200000) fail('المحتوى أكبر من الحد المسموح');
  if (
    !(typeof content.title === 'string' && content.title.trim()) &&
    !(typeof content.fullMedia === 'string' && content.fullMedia)
  )
    fail('أضف عنوانًا أو وسائط أولًا');
  if (mode === 'media' && !(typeof content.fullMedia === 'string' && content.fullMedia))
    fail('أضف صورة أو فيديو أولًا');
  const previous = db.posts.find((p) => p.id === requestID);
  if (previous) {
    if (
      previous.created_by !== staff.id ||
      previous.screen_id !== screenID ||
      !isDeepStrictEqual(previous.content, content)
    )
      fail('معرّف الطلب مستخدم لمحتوى آخر');
    return { id: previous.id, publish_at: previous.publish_at };
  }
  const screen = db.screens.find((s) => s.id === screenID);
  if (!screen) fail('الشاشة غير موجودة');
  if ((screen.template?.displayMode || 'daily') !== mode && !staff.permissions.admin)
    fail('اطلب من المسؤول تغيير وضع الشاشة أولًا', 403);
  const original = structuredClone(screen),
    posts = db.posts.slice();
  const now = new Date(),
    post = {
      id: requestID,
      screen_id: screenID,
      content: structuredClone(content),
      created_by: staff.id,
      publish_at: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }),
      created_at: now.toISOString(),
    };
  try {
    screen.template = {
      ...screen.template,
      ...(staff.permissions.admin ? { displayMode: mode } : {}),
    };
    screen.draft = null;
    screen.updated_at = post.created_at;
    db.posts.push(post);
    commit();
  } catch (error) {
    Object.keys(screen).forEach((k) => delete screen[k]);
    Object.assign(screen, original);
    db.posts = posts;
    throw error;
  }
  return { id: post.id, publish_at: post.publish_at };
}

export function scheduleFromIphone(db, args, staff, commit) {
  if (!staff?.active || !(staff.permissions?.admin || staff.permissions?.daily))
    throw Object.assign(Error('لا تملك صلاحية الجدولة'), { status: 403 });
  const date = args.p_date,
    today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < today ||
    !Number.isFinite(Date.parse(date + 'T12:00:00Z')) ||
    new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date
  )
    throw Error('اختر اليوم أو تاريخًا قادمًا');
  if (!db.screens.some((s) => s.id === args.p_screen_id)) throw Error('الشاشة غير موجودة');
  const content = args.p_content,
    id = args.p_request_id;
  if (
    !content ||
    typeof content !== 'object' ||
    Array.isArray(content) ||
    Buffer.byteLength(JSON.stringify(content)) > 200000 ||
    !(
      (typeof content.title === 'string' && content.title.trim()) ||
      (typeof content.fullMedia === 'string' && content.fullMedia)
    )
  )
    throw Error('أضف عنوانًا أو وسائط صالحة');
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw Error('معرّف الطلب غير صحيح');
  const previous = db.posts.find((p) => p.id === id);
  if (previous) {
    if (
      previous.created_by !== staff.id ||
      previous.screen_id !== args.p_screen_id ||
      previous.publish_at !== date ||
      !isDeepStrictEqual(previous.content, content)
    )
      throw Error('معرّف الطلب مستخدم لمحتوى آخر');
    return { id: previous.id, publish_at: previous.publish_at };
  }
  const post = {
    id,
    screen_id: args.p_screen_id,
    content: structuredClone(content),
    publish_at: date,
    created_by: staff.id,
    created_at: new Date().toISOString(),
  };
  db.posts.push(post);
  try {
    commit();
  } catch (error) {
    db.posts.pop();
    throw error;
  }
  return { id: post.id, publish_at: date };
}
