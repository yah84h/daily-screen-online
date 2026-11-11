import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ArrowUpLeft,
  Check,
  ChevronDown,
  LogOut,
  Monitor,
  Plus,
  Settings,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AdminProvider, fmtTime, useAdmin, type Tab } from './store';
import { navigation, sectionLabels } from './navigation';
import { AssistantTab } from './AssistantTab';
import { HomeTab } from './HomeTab';
import { ScheduleTab } from './ScheduleTab';
import { TemplateTab } from './TemplateTab';
import { HistoryTab } from './HistoryTab';
import { Modals, SettingsModal } from './Modals';
import { LoopTab } from './LoopTab';
import { DisplayModes } from './DisplayModes';
import { RemoteMediaPanel } from './RemoteMediaPanel';
import '@/admin-studio.css';

const descriptions: Record<Tab, [string, string]> = {
  المساعد: ['مساعد يعرف شاشتك.', 'اسأل، أرفق ملفًا، وراجع التعديلات قبل تطبيقها.'],
  الرئيسية: ['محتوى يستحق العرض.', 'جهّز رسالة اليوم، راجعها على الشاشة، ثم انشرها.'],
  التحكم: ['شاشتك، تحت تحكمك.', 'التشغيل والصوت والتنزيلات على أجهزة العرض المرتبطة.'],
  'طريقة العرض': ['كل شاشة، بطريقتها.', 'اختر نوع العرض، ثم خصّص شكله وتوزيعه.'],
  القوالب: ['كل شاشة، بطريقتها.', 'وزّع العناصر واضبط الألوان واحفظ تصميمك.'],
  'خلفية الحصص': ['كل شاشة، بطريقتها.', 'الساعة، الحصص، الصور ولوحة التميز في مكان واحد.'],
  الجدولة: ['خطّط لليوم التالي.', 'رتّب المحتوى القادم وارجع إلى ما نشرته سابقًا.'],
  السجل: ['خطّط لليوم التالي.', 'تحديثات محفوظة يمكنك استعادتها كمسودة.'],
  الشاشات: ['مساحة المدرسة.', 'إدارة الشاشات والأجهزة وهوية المدرسة.'],
};

function LoadingStudio() {
  return (
    <div className="studio-loading" aria-label="جارٍ تحميل لوحة الإدارة" role="status">
      <div />
      <div />
      <div />
      <span>جارٍ تجهيز مساحة شاشتك…</span>
    </div>
  );
}

export default function Admin() {
  const { session, loading, permissions, error, refresh } = useAuth();
  if (loading) return <LoadingStudio />;
  if (!session) return <Navigate to="/login" replace />;
  if (!permissions.admin && !permissions.daily)
    return <Navigate to={permissions.news ? '/news' : '/login'} replace />;
  if (error)
    return (
      <div className="studio-error">
        <h1>تعذّر تحميل حسابك</h1>
        <p role="alert">{error}</p>
        <button onClick={() => void refresh()}>إعادة المحاولة</button>
      </div>
    );
  return (
    <AdminProvider>
      <Studio />
    </AdminProvider>
  );
}

function Studio() {
  const { data, loadError, tab, setTab, setModal, toast, fileInput, selectScreen, reload, busy } =
    useAdmin();
  const { permissions, signOut, staff } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const account = useRef<HTMLDetailsElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const group = navigation.find((item) => (item.tabs as Tab[]).includes(tab));
  const remembered = useRef<Record<string, Tab>>({});
  useEffect(() => {
    if (group) remembered.current[group.label] = tab;
  }, [tab, group]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && account.current?.open) {
        account.current.open = false;
        account.current.querySelector('summary')?.focus();
      }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('keydown', escape);
    };
  }, []);
  const navigate = (next: Tab) => {
    setTab(next);
    if (account.current) account.current.open = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  };
  const onlineDevices =
    data?.devices.filter(
      (device) => device.last_seen_at && Date.now() - Date.parse(device.last_seen_at) < 90000,
    ).length || 0;
  const title = descriptions[tab];
  return (
    <div className="admin-studio" dir="rtl">
      <a className="studio-skip" href="#studio-content">
        انتقل إلى المحتوى
      </a>
      {fileInput}
      <header className="studio-topbar">
        <a className="studio-brand" href="/admin">
          <span>
            <Monitor size={22} />
          </span>
          <div>
            الشاشة اليومية<small>مساحة المدرسة</small>
          </div>
        </a>
        <div className="studio-school">{data?.school.name || 'جارٍ تحميل المدرسة…'}</div>
        <div className="studio-top-actions">
          {permissions.admin && (
            <button
              className={'studio-utility' + (tab === 'الشاشات' ? ' selected' : '')}
              onClick={() => navigate('الشاشات')}
              aria-label="الأجهزة والإعدادات"
            >
              <Settings size={18} />
              <span>الأجهزة</span>
            </button>
          )}
          <details className="studio-account" ref={account}>
            <summary aria-label="الحساب">
              <span>{staff?.username?.slice(0, 1) || 'م'}</span>
              <ChevronDown size={14} />
            </summary>
            <div>
              <b>{staff?.username || 'حساب المدرسة'}</b>
              <a href="/news">الأخبار والمعرفة</a>
              {permissions.admin && <a href="/users">الحسابات والصلاحيات</a>}
              <a href="/password">تغيير كلمة المرور</a>
              <button onClick={() => void signOut()}>
                <LogOut size={16} />
                تسجيل الخروج
              </button>
            </div>
          </details>
        </div>
      </header>
      <div className="studio-nav-wrap">
        <nav className="studio-navigation" aria-label="التنقل الرئيسي">
          {navigation
            .filter((item) => !('admin' in item && item.admin) || permissions.admin)
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  aria-current={group?.label === item.label ? 'page' : undefined}
                  onClick={() => navigate(remembered.current[item.label] || item.tabs[0])}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {item.label === 'الجدولة والسجل' && !!data?.schedule.length && (
                    <small>{data.schedule.length}</small>
                  )}
                </button>
              );
            })}
        </nav>
      </div>
      <main className="studio-main" id="studio-content">
        {!online && (
          <div className="studio-notice">
            <WifiOff size={18} />
            <span>أنت غير متصل. ستحتاج إلى الاتصال لحفظ التغييرات وإرسالها للشاشة.</span>
          </div>
        )}
        {loadError && (
          <div className="studio-notice error" role="alert">
            <span>{loadError}</span>
            <button onClick={() => void reload()}>إعادة المحاولة</button>
          </div>
        )}
        <div className="studio-page-heading">
          <div>
            <p className="studio-eyebrow">
              {tab === 'الشاشات' ? 'الإدارة' : group?.label || 'مساحة العمل'}
            </p>
            <h1 ref={heading} tabIndex={-1}>
              {title[0]}
            </h1>
            <p>{title[1]}</p>
          </div>
          <div className="studio-date">
            <span>
              {new Date().toLocaleDateString('ar-SA-u-ca-gregory', {
                weekday: 'long',
                timeZone: 'Asia/Riyadh',
              })}
            </span>
            <b>
              {new Date().toLocaleDateString('ar-SA-u-ca-gregory', {
                day: 'numeric',
                month: 'long',
                timeZone: 'Asia/Riyadh',
              })}
            </b>
          </div>
        </div>
        <section className="studio-screenbar" aria-label="الشاشة المحددة">
          <div className="studio-screen-selector">
            <span className="studio-device-icon">
              <Monitor size={22} />
            </span>
            <label>
              مساحة الشاشة
              <select
                aria-label="الشاشة المحددة"
                disabled={!data || busy}
                value={data?.screen.id || ''}
                onChange={(event) => selectScreen(event.target.value)}
              >
                {data?.screens.map((screen) => (
                  <option value={screen.id} key={screen.id}>
                    {screen.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className={
              'studio-connection studio-monitor-shortcut' + (onlineDevices ? ' connected' : '')
            }
            aria-label="فتح مراقبة الشاشة"
            onClick={() => navigate('التحكم')}
          >
            <i />
            {onlineDevices
              ? `${onlineDevices} جهاز متصل`
              : data?.devices.length
                ? 'الأجهزة غير متصلة'
                : 'لم تُربط أجهزة'}
          </button>
          <span className="studio-last-publish">
            {data?.current ? 'آخر نشر ' + fmtTime(data.current.created_at) : 'لم يُنشر محتوى بعد'}
          </span>
          <div className="studio-screen-actions">
            <button
              className="button white"
              disabled={!data || busy}
              onClick={() => setModal('pair')}
            >
              <Plus size={16} />
              ربط جهاز بالكود
            </button>
            <a
              className="icon-button"
              href="/tv"
              target="_blank"
              rel="noreferrer"
              aria-label="فتح صفحة التلفزيون"
            >
              <ArrowUpLeft size={19} />
            </a>
          </div>
        </section>
        {group && group.tabs.length > 1 && (
          <nav className="studio-subnav" aria-label={group.label}>
            {group.tabs.map((item) => (
              <button
                key={item}
                aria-current={tab === item ? 'page' : undefined}
                onClick={() => navigate(item)}
              >
                {sectionLabels[item] || item}
              </button>
            ))}
          </nav>
        )}
        {!data ? (
          <LoadingStudio />
        ) : (
          <div className="studio-page" key={tab}>
            {tab === 'المساعد' && <AssistantTab key={data.screen.id} />}
            {tab === 'الرئيسية' && <HomeTab />}
            {tab === 'التحكم' && <RemoteMediaPanel />}
            {permissions.admin && tab === 'طريقة العرض' && <DisplayModes />}
            {permissions.admin && tab === 'القوالب' && <TemplateTab />}
            {permissions.admin && tab === 'خلفية الحصص' && <LoopTab />}
            {tab === 'الجدولة' && <ScheduleTab />}
            {tab === 'السجل' && <HistoryTab />}
            {permissions.admin && tab === 'الشاشات' && (
              <section className="studio-settings">
                <SettingsModal />
              </section>
            )}
          </div>
        )}
      </main>
      <footer className="studio-footer">
        <span>الشاشة اليومية</span>
        <span>المحتوى يُرسل إلى الشاشة المحددة فقط.</span>
      </footer>
      {toast && (
        <div className="studio-toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      <Modals />
    </div>
  );
}
