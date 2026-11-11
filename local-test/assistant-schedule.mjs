import { createHash, randomUUID } from 'node:crypto';
import { validateProposal } from './assistant-tools.mjs';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
export function scheduleVersion(posts, screenId) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        posts
          .filter((post) => post.screen_id === screenId && post.publish_at > today())
          .map((post) => ({ id: post.id, date: post.publish_at, content: post.content }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ),
    )
    .digest('hex');
}
/** A reviewed weekly plan is committed atomically; retries cannot create duplicates. */
export function applyAssistantSchedule(db, input, user, commit) {
  if (!(user?.permissions?.daily || user?.permissions?.admin))
    throw Error('لا تملك صلاحية الجدولة');
  if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId))
    throw Error('Invalid request ID');
  const schedule = validateProposal(
    { summary: 'Weekly broadcast plan', schedule: input.schedule },
    false,
  ).schedule;
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ screenId: input.screenId, schedule }))
    .digest('hex');
  const previous = db.assistant_requests?.find((item) => item.id === input.requestId);
  if (previous) {
    if (previous.userId !== user.id || previous.fingerprint !== fingerprint)
      throw Error('Request ID already used');
    return { saved: previous.dates };
  }
  const screen = db.screens.find((item) => item.id === input.screenId);
  if (!screen) throw Error('الشاشة غير موجودة');
  if (input.scheduleVersion !== scheduleVersion(db.posts, screen.id))
    throw Error('تغيرت الجدولة منذ تجهيز الاقتراح. اطلب اقتراحًا جديدًا قبل الحفظ.');
  const originalPosts = structuredClone(db.posts),
    originalRequests = structuredClone(db.assistant_requests || []);
  const base =
    screen.draft ||
    db.posts
      .filter((post) => post.screen_id === screen.id && post.publish_at <= today())
      .sort(
        (a, b) =>
          b.publish_at.localeCompare(a.publish_at) || b.created_at.localeCompare(a.created_at),
      )[0]?.content ||
    {};
  try {
    for (const entry of schedule) {
      const matches = db.posts.filter(
        (post) => post.screen_id === screen.id && post.publish_at === entry.date,
      );
      if (matches.length > 1)
        throw Error('يوجد أكثر من إعلان في ' + entry.date + '؛ راجع الجدولة قبل استبدالها.');
      if (matches.length) matches[0].content = { ...matches[0].content, ...entry.content };
      else
        db.posts.push({
          id: randomUUID(),
          screen_id: screen.id,
          content: { ...base, ...entry.content, date: entry.date },
          publish_at: entry.date,
          created_by: user.id,
          created_at: new Date().toISOString(),
        });
    }
    db.assistant_requests = [
      ...originalRequests,
      {
        id: input.requestId,
        userId: user.id,
        fingerprint,
        dates: schedule.map((entry) => entry.date),
      },
    ].slice(-200);
    commit();
    return { saved: schedule.map((entry) => entry.date) };
  } catch (error) {
    db.posts = originalPosts;
    db.assistant_requests = originalRequests;
    throw error;
  }
}
