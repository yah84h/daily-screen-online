import { useEffect, useId, useState } from 'react';
import { Crown, Medal, Trophy } from 'lucide-react';
import type { RecognitionBoard } from '@/lib/types';
import {
  leaderboardOptions,
  leaderboardPages,
  useLeaderboard,
  type QudratLeader,
} from '@/lib/qudratPro';
const number = (value: number) =>
  new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 1 }).format(value);
function PodiumStudent({ leader, place }: { leader: QudratLeader; place: number }) {
  return (
    <div className={'qudrat-podium-student podium-place-' + place}>
      <span className="qudrat-medal">
        {place === 1 ? <Crown aria-hidden="true" /> : <Medal aria-hidden="true" />}
        <b>{number(leader.rank)}</b>
      </span>
      <h3 title={leader.name}>{leader.name}</h3>
      <span className="qudrat-podium-score">{number(leader.score)}٪</span>
    </div>
  );
}
export function QudratProBoard({ board }: { board: RecognitionBoard }) {
  const titleId = useId();
  const options = leaderboardOptions(board.qudratPro);
  const state = useLeaderboard(true, options.refreshSeconds);
  const [cursor, setCursor] = useState(0);
  const views = state.data ? leaderboardPages(state.data, options) : [];
  const current = views.length ? views[cursor % views.length] : null;
  const signature = views
    .map(
      (view) =>
        view.exam.kind +
        ':' +
        view.page +
        ':' +
        view.exam.leaders.map((row) => row.rank + row.name + row.score).join('|'),
    )
    .join(';');
  const seconds = Math.max(6, Math.min(30, Number(board.pageSeconds) || 10));
  useEffect(() => setCursor(0), [signature]);
  useEffect(() => {
    if (views.length < 2) return;
    const timer = setInterval(
      () => setCursor((value) => (value + 1) % views.length),
      seconds * 1000,
    );
    return () => clearInterval(timer);
  }, [views.length, seconds]);
  const message = state.loading
    ? 'جارٍ تحميل نتائج الأسبوع…'
    : state.error === 'OFFLINE_ONLY'
      ? 'تحتاج نتائج قدرات برو إلى اتصال بالإنترنت'
      : state.error === 'NOT_CONFIGURED'
        ? 'مصدر قدرات برو غير مهيأ بعد'
        : state.error
          ? 'تعذر تحديث النتائج الآن'
          : 'لم تُنشر نتائج لهذا الاختبار بعد';
  return (
    <section
      className={
        'recognition-board qudrat-board qudrat-layout-' +
        options.layout +
        (current && current.top.length > 0 && !current.rows.length ? ' qudrat-only-podium' : '')
      }
      style={
        {
          width: (board.width ?? 32) + '%',
          height: (board.height ?? 53) + '%',
          '--qudrat-page-size': options.pageSize,
          '--qudrat-row-font': 24 / options.pageSize + 'cqh',
        } as import('react').CSSProperties
      }
      aria-labelledby={titleId}
    >
      <header className="qudrat-brand">
        <img src="/branding/qudrat-pro.png" alt="" />
        <div>
          <span className="qudrat-eyebrow">تميّز يستحق أن يُرى</span>
          <h2 id={titleId}>قدرات برو</h2>
          <p>
            {current?.exam.title || 'متصدرو الأسبوع'}
            {current && <span> · {current.exam.kind_label}</span>}
          </p>
        </div>
        <Trophy className="qudrat-trophy" aria-hidden="true" />
      </header>
      {current?.exam.leaders.length ? (
        <>
          {current.top.length > 0 && (
            <div className="qudrat-podium" aria-label="الثلاثة الأوائل">
              {current.top.map((leader, index) => (
                <PodiumStudent
                  key={leader.rank + ':' + leader.name}
                  leader={leader}
                  place={index + 1}
                />
              ))}
            </div>
          )}
          {current.rows.length > 0 && (
            <div className="qudrat-ranking" key={current.exam.kind + ':' + current.page}>
              <div className="qudrat-list-heading">
                <span>{options.layout === 'podium' ? 'قائمة التميّز' : 'ترتيب المتصدرين'}</span>
                <span>الدرجة</span>
              </div>
              <ol start={current.rows[0].rank} aria-label="بقية المتصدرين">
                {current.rows.map((leader, index) => (
                  <li key={leader.rank + ':' + index}>
                    <span className="qudrat-rank">{number(leader.rank)}</span>
                    <h3 title={leader.name}>{leader.name}</h3>
                    <b>{number(leader.score)}٪</b>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : (
        <div className="qudrat-empty" role="status">
          <Trophy aria-hidden="true" />
          <p>{message}</p>
          {state.error && !state.loading && <small>أعد تحميل الصفحة للمحاولة مجددًا.</small>}
        </div>
      )}
      {current && current.pageCount > 1 && (
        <footer className="qudrat-footer">
          <div
            className="qudrat-pagination"
            aria-label={`الصفحة ${current.page} من ${current.pageCount}`}
          >
            <span dir="ltr">
              {number(current.page)} / {number(current.pageCount)}
            </span>
            <div>
              {Array.from({ length: current.pageCount }, (_, index) => (
                <i key={index} className={current.page === index + 1 ? 'active' : ''} />
              ))}
            </div>
          </div>
        </footer>
      )}
    </section>
  );
}
