import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import * as api from '@/lib/api';
import { fmtDate, useAdmin } from './store';

export function ScheduleTab() {
  const { data, run, setModal } = useAdmin();
  const schedule = data?.schedule ?? [];
  return (
    <section className="collection-card">
      <div className="section-heading">
        <h2>المحتوى القادم</h2>
        <button className="button primary" onClick={() => setModal('schedule')}>
          <Plus size={17} /> جدولة المحتوى
        </button>
      </div>
      {schedule.length ? (
        schedule.map((s) => (
          <div className="list-row" key={s.id}>
            <div className="list-icon">
              <CalendarDays />
            </div>
            <span>
              <b>{s.content.title}</b>
              <small>{fmtDate(s.publish_at)} · منتصف الليل بتوقيت الرياض</small>
            </span>
            <button className="icon-button" aria-label="حذف الموعد" onClick={() => run(() => api.deletePost(s.id, s.screen_id), 'تم حذف الموعد.')}>
              <Trash2 size={17} />
            </button>
          </div>
        ))
      ) : (
        <div className="empty">
          <CalendarDays size={36} />
          <h3>خطط لمحتوى الأيام القادمة.</h3>
          <p>جدول مسودة اليوم أو موضوعًا محفوظًا لتاريخ قادم.</p>
          <button className="button white" onClick={() => setModal('schedule')}>
            إنشاء أول موعد
          </button>
        </div>
      )}
    </section>
  );
}
