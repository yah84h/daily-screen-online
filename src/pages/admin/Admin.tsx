import { Navigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, Clock, History, LayoutDashboard, Layers, LogOut, Monitor, Settings, Smartphone, Loader2, Quote } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AdminProvider, fmtTime, useAdmin, type Tab } from './store';
import { HomeTab } from './HomeTab';
import { PresetsTab } from './PresetsTab';
import { ScheduleTab } from './ScheduleTab';
import { TemplateTab } from './TemplateTab';
import { HistoryTab } from './HistoryTab';
import { TechLibraryTab } from './TechLibraryTab';
import { Modals, SettingsModal } from './Modals';
import { LoopTab } from './LoopTab';

const nav: [Tab, typeof LayoutDashboard][] = [
  ['الرئيسية', LayoutDashboard],
  ['المواضيع المحفوظة', BookOpen],
  ['الجدولة', CalendarDays],
  ['القوالب', Layers],
  ['خلفية الحصص', Clock],
  ['السجل', History],
  ['الشاشات', Monitor],
  ['ومضات تقنية', Quote],
];

const subtitles: Record<Tab, string> = {
  الشاشات: 'كل شاشاتك، في مكان واحد. لكل شاشة محتواها وقالبها.',
  'ومضات تقنية': 'أفكار عن المعرفة والتقنية، محفوظة وجاهزة بلا إنترنت.',
  الرئيسية: 'يوم جديد ورسالة جديدة. حدّث محتوى اليوم.',
  'المواضيع المحفوظة': 'رسائلك المتكررة، جاهزة للاستخدام من جديد.',
  الجدولة: 'خطط مسبقًا، وستعرض الشاشة المحتوى في موعده.',
  القوالب: 'اختر قالبًا جاهزًا أو أضف لمستك من الجوال.',
  'خلفية الحصص': 'الساعة، الحصص، وطلاب نفخر بهم — بإعدادات بسيطة.',
  السجل: 'تحديثاتك السابقة محفوظة لتعود إليها متى احتجت.',
};

export default function Admin() {
  const { session, loading, permissions, error } = useAuth();
  if (loading) return <div className="loading-page"><Loader2 className="spin" size={28} /></div>;
  
  if (!session) return <Navigate to="/login" replace />;
  if(!permissions.admin&&!permissions.daily)return <Navigate to={permissions.news?'/news':'/login'} replace/>;
  if(error)return <p role="alert">{error}</p>;
  return (
    <AdminProvider>
      <Layout />
    </AdminProvider>
  );
}

function Layout() {
  const { data, loadError, tab, setTab, setModal, toast, fileInput, selectScreen } = useAdmin();
  const { signOut,permissions } = useAuth();
  const school = data?.school;
  const tvOnline = data?.devices.some((d) => d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 90_000) ?? false;
  const pairedCount = data?.devices.length ?? 0;

  return (
    <div className="app">
      {fileInput}
      <aside>
        <a className="brand" href="/admin">
          <div>
            <Monitor size={23} />
          </div>
          <span>
            الشاشة<span> اليومية</span>
            <small>مساحة مدرستك</small>
          </span>
        </a>
        <div className="workspace">
          <div className="workspace-icon">{school?.name?.trim()?.[0] || 'م'}</div>
          <span>
            {school?.name || '…'}
            <small>مساحة المدرسة</small>
          </span>
        </div>
        {data && data.screens.length > 1 && (
          <div className="screen-switch">
            <div className="nav-label">الشاشة الحالية</div>
            <select value={data.screen.id} onChange={(e) => selectScreen(e.target.value)} aria-label="اختيار الشاشة">
              {data.screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="nav-label">مساحة العمل</div>
        {permissions.news&&<a className="button white" href="/news">إدارة الأخبار</a>}{permissions.admin&&<a className="button white" href="/users">الحسابات والصلاحيات</a>}<a className="text-button" href="/password">تغيير كلمة المرور</a><nav>
          {nav.filter(([name])=>permissions.admin||['الرئيسية','المواضيع المحفوظة','الجدولة','السجل','ومضات تقنية'].includes(name)).map(([label, Icon]) => (
            <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}>
              <Icon size={19} />
              {label}
              {label === 'الجدولة' && (data?.schedule.length ?? 0) > 0 && <span className="nav-count">{data!.schedule.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <Smartphone size={20} />
              <Monitor size={20} />
            </div>
            <b>شاشتك، محدثة دائمًا.</b>
            <p>
              تحديث جديد
              <br />
              بلمسات بسيطة.
            </p>
            <button onClick={() => setModal('setup')}>
              إعداد الشاشة <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="settings-nav" disabled={!permissions.admin} onClick={() => setModal('settings')}>
            <Settings size={19} />
            الإعدادات
          </button>
          <button className="settings-nav" onClick={signOut}>
            <LogOut size={19} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="main">
        <header>
          <div className="breadcrumb">
            <Monitor size={18}/><select aria-label="الشاشة المحددة" value={data?.screen.id||''} onChange={e=>selectScreen(e.target.value)}>{data?.screens.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
          <div className="header-right">
            <span className="timezone">
              <Clock size={14} /> توقيت جدة
            </span>
            <div className="avatar small">م</div>
          </div>
        </header>
        <main>
          {loadError && (
            <div className="error-banner" role="alert">
              {loadError}
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">مساحة المدرسة / {data?.screen.name||'الشاشة الرئيسية'}</div>
              <h1>{tab === 'الرئيسية' ? 'يوم جديد، ورسالة جديدة.' : tab}</h1>
              <p>{subtitles[tab]}</p>
            </div>
            <button className="button white" onClick={() => setModal('setup')}>
              <Monitor size={17} /> إعداد الشاشة
            </button>
          </div>
          <div className="screen-status">
            <div className="device-icon">
              <Monitor size={23} />
            </div>
            <div>
              <b>
                {data?.screen.name || 'الشاشة الرئيسية'}{' '}
                <span className={'status-pill ' + (tvOnline ? '' : 'offline')}>
                  <i />
                  {tvOnline ? 'متصلة' : pairedCount ? 'غير متصلة' : 'غير مربوطة'}
                </span>
              </b>
              <p>
                {pairedCount ? `${pairedCount} جهاز مربوط` : 'لم يُربط تلفزيون بعد'} <span>·</span> 4K UHD <span>·</span> 3840 × 2160
              </p>
            </div>
            <div className="status-right">
              <span>{data?.current ? 'آخر نشر: ' + fmtTime(data.current.created_at) : 'جاهزة لأول تحديث'}</span>
              <a className="icon-button" href="/tv" target="_blank" title="فتح صفحة التلفزيون">
                <ArrowUpRight size={19} />
              </a>
            </div>
          </div>

          {tab === 'الرئيسية' && <HomeTab />}
          {tab === 'المواضيع المحفوظة' && <PresetsTab />}
          {tab === 'الجدولة' && <ScheduleTab />}
          {permissions.admin && tab === 'القوالب' && <TemplateTab />}
          {tab === 'السجل' && <HistoryTab />}
          {permissions.admin && tab === 'خلفية الحصص' && <LoopTab />}
          {permissions.admin && tab === 'الشاشات' && <section className="editor-card screens-page"><SettingsModal/></section>}
          {tab === 'ومضات تقنية' && <TechLibraryTab/>}
        </main>
        <footer className="app-footer">
          <span>الشاشة اليومية</span>
          <span>صمّم مرة واحدة، وحدّث يوميًا.</span>
        </footer>
      </div>

      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
      <Modals />
    </div>
  );
}
