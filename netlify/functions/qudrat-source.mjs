import {
  fetchQudratLeaderboard,
  sourceSummary,
  checkedSource,
} from '../../local-test/qudrat-pro.mjs';
import { clients, response, requireAdmin } from '../lib/staff.mjs';
import { savedSource, storeSource } from '../lib/qudrat-source.mjs';
/** Admin-only: save, clear or inspect the Qudrat Pro leaderboard link. The key is never sent back. */
export async function handler(event) {
  if (event.httpMethod !== 'POST')
    return response(405, { error: { message: 'Method not allowed' } });
  try {
    const { admin } = clients();
    await requireAdmin(event, admin);
    const input = JSON.parse(event.body || '{}');
    if (input.action === 'save') {
      const url = checkedSource(input.url);
      let data;
      try {
        data = await fetchQudratLeaderboard({ url });
      } catch {
        throw Error('الرابط صحيح الشكل لكن المصدر لم يُعد نتائج. تحقق من المفتاح ثم أعد المحاولة.');
      }
      await storeSource(admin, url);
      return response(200, {
        ...sourceSummary(url, process.env.QUDRAT_PRO_LEADERBOARD_URL),
        exams: data.exams.map((exam) => ({ label: exam.kind_label, count: exam.leaders.length })),
      });
    }
    if (input.action === 'clear') {
      await storeSource(admin, '');
      return response(200, sourceSummary('', process.env.QUDRAT_PRO_LEADERBOARD_URL));
    }
    if (input.action === 'status')
      return response(
        200,
        sourceSummary(await savedSource(), process.env.QUDRAT_PRO_LEADERBOARD_URL),
      );
    throw Error('عملية غير معروفة');
  } catch (error) {
    return response(403, { error: { message: error.message || 'تعذر حفظ مصدر قدرات برو' } });
  }
}
