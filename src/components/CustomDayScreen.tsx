import { useEffect, useMemo, useRef } from 'react';
import { customDayDocument, type CustomDay } from '@/lib/customDays';
import { recognitionOf } from '@/lib/loop';
import { RecognitionBoard } from './loop/RecognitionBoard';
import type { School, Template } from '@/lib/types';
import './custom-day.css';
export function CustomDayScreen({
  day,
  template,
  school,
  now,
}: {
  day: CustomDay;
  template: Template;
  school: School;
  now: Date;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const source = useMemo(() => customDayDocument(day.html), [day.html]);
  const payload = {
    textScale: (day.textScale ?? 100) / 100,
    clockScale: (day.clockScale ?? 100) / 100,
    schoolScale: (day.schoolScale ?? 100) / 100,
    title: day.title,
    subtitle: day.subtitle,
    body: day.body,
    schoolName: template.schoolName ?? school.name,
    logo: template.schoolLogo ?? school.logo_url,
    showClock: day.clock,
    showLeaderboard: day.leaderboard,
    clock: now.toLocaleTimeString('ar-SA', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
    }),
    date: now.toLocaleDateString('ar-SA-u-ca-gregory', {
      timeZone: 'Asia/Riyadh',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
  };
  const send = () =>
    frame.current?.contentWindow?.postMessage({ type: 'school-custom-day', payload }, '*');
  useEffect(send, [day, template.schoolName, template.schoolLogo, school, now]);
  const nativeClock = /id=["']clock["']|data-school-field=["']clock["']/.test(day.html);
  return (
    <div className="screen custom-day-screen" aria-label={'تصميم المناسبة: ' + day.name}>
      <iframe
        ref={frame}
        title={day.name}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={source}
        onLoad={send}
      />
      {day.clock && !nativeClock && (
        <div
          className="custom-day-clock"
          style={{
            transform: `scale(${(day.clockScale ?? 100) / 100})`,
            transformOrigin: 'top left',
          }}
        >
          <b>{payload.clock}</b>
          <small>{payload.date}</small>
        </div>
      )}
      {day.leaderboard && (
        <div
          className="custom-day-board screen-loop"
          style={{
            left: day.boardX + '%',
            top: day.boardY + '%',
            width: day.boardW + '%',
            height: day.boardH + '%',
          }}
        >
          <RecognitionBoard
            board={{ ...recognitionOf(template), enabled: true, width: 100, height: 100 }}
          />
        </div>
      )}
    </div>
  );
}
