import { History } from 'lucide-react';
import { fmtDateTime, useAdmin } from './store';

export function HistoryTab() {
  const { data, setContent, setTab, notify } = useAdmin();
  const history = data?.history ?? [];
  return (
    <section className="collection-card">
      <h2>التحديثات السابقة</h2>
      {history.length ? (
        history.map((h) => (
          <div className="list-row" key={h.id}>
            <div className="list-icon">
              <History />
            </div>
            <span>
              <b>{h.content.title}</b>
              <small>{fmtDateTime(h.created_at)}</small>
            </span>
            <button
              className="button white"
              onClick={() => {
                setContent(h.content);
                setTab('الرئيسية');
                notify('تمت استعادة الشاشة السابقة كمسودة. انشرها عندما تكون جاهزة.');
              }}
            >
              استعادة
            </button>
          </div>
        ))
      ) : (
        <div className="empty">
          <History size={36} />
          <h3>سجل شاشتك يبدأ هنا.</h3>
          <p>ستظهر التحديثات المنشورة هنا لتستعيدها بسهولة.</p>
        </div>
      )}
    </section>
  );
}
