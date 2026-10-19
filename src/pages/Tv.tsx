import { useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';
import { Screen } from '@/components/Screen';
import { fetchTv, requestPairing, screenChannel } from '@/lib/api';
import { cacheTvState, readTvCache } from '@/lib/offline';
import { initialContent, type TvState } from '@/lib/types';

const TOKEN_KEY = 'tv-token';
const POLL_MS = 30_000;

type Paired = Extract<TvState, { status: 'paired' }>;

export default function Tv() {
  const [state, setState] = useState<TvState | null>(null);
  const [online, setOnline] = useState(true);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState('');
  const lastVersion = useRef('');

  // الحالة المحفوظة تظهر فورًا قبل الاتصال
  useEffect(() => {
    readTvCache().then((c) => c && setState((s) => s ?? c));
  }, []);

  useEffect(() => {
    let active = true;
    let token = localStorage.getItem(TOKEN_KEY) || '';
    let sub: ReturnType<typeof screenChannel> | null = null;

    const load = async () => {
      try {
        if (!token) {
          const p = await requestPairing();
          token = p.token;
          localStorage.setItem(TOKEN_KEY, token);
        }
        const data = await fetchTv(token);
        if (!active) return;
        if (data.status === 'unknown') {
          // الرمز انتهى أو حُذف الجهاز من اللوحة → ابدأ ربطًا جديدًا
          localStorage.removeItem(TOKEN_KEY);
          token = '';
          return load();
        }
        setOnline(true);
        setError('');
        setState(data);
        if (data.status === 'paired') {
          if (data.version !== lastVersion.current) {
            lastVersion.current = data.version;
            cacheTvState(data);
          }
          if (!sub) {
            sub = screenChannel(data.screen.id);
            sub.on('broadcast', { event: 'update' }, () => load()).subscribe();
          }
        }
      } catch (e) {
        if (!active) return;
        setOnline(false);
        setError((e as Error).message);
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') setSettings((v) => !v);
      if (e.key === 'Escape') setSettings(false);
      // وضع العرض فقط: منع مفاتيح التنقل والتحكم بالمتصفح
      const nav = e.key === 'Backspace' || (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home')) || (e.ctrlKey && /^[lLtTnNwWoOpPjJhHuUsSdD]$/.test(e.key)) || e.key === 'F1' || e.key === 'F3' || e.key === 'F6' || e.key === 'F7' || e.key === 'F12';
      if (nav) e.preventDefault();
    };
    const block = (e: Event) => e.preventDefault();
    // قفل التاريخ: أي رجوع يعود إلى الشاشة نفسها
    history.pushState(null, '', location.href);
    const onPop = () => history.pushState(null, '', location.href);
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', block);
    window.addEventListener('dragstart', block);
    window.addEventListener('popstate', onPop);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', block);
      window.removeEventListener('dragstart', block);
      window.removeEventListener('popstate', onPop);
      sub?.unsubscribe();
    };
  }, []);

  const paired = state?.status === 'paired' ? (state as Paired) : null;

  return (
    <div className="tv" onDoubleClick={() => setSettings((v) => !v)}>
      {paired ? (
        <Screen content={paired.post?.content || initialContent} template={paired.screen.template} school={paired.school} large />
      ) : (
        <div className="tv-pairing">
          <Monitor size={56} />
          <h1>الشاشة اليومية</h1>
          {state?.status === 'pending' ? (
            <>
              <p>افتح لوحة الإدارة من هاتفك، ثم «إعداد الشاشة»، وأدخل هذا الرمز:</p>
              <div className="pair-code" dir="ltr">
                {state.code}
              </div>
              <small>ينتهي الرمز بعد ساعة. تبقى هذه الصفحة مفتوحة حتى يتم الربط.</small>
            </>
          ) : (
            <p>{error || 'جارٍ الاتصال…'}</p>
          )}
        </div>
      )}
      {settings && (
        <div className="tv-settings">
          <b>{online ? 'متصلة' : 'غير متصلة · تُعرض آخر شاشة محفوظة'}</b>
          {paired && <span>{paired.screen.name}</span>}
          <button onClick={() => location.reload()}>إعادة تحميل الشاشة</button>
          <button onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>تبديل ملء الشاشة</button>
          <button
            onClick={() => {
              if (confirm('إلغاء ربط هذا التلفزيون؟')) {
                localStorage.removeItem(TOKEN_KEY);
                location.reload();
              }
            }}
          >
            إلغاء الربط
          </button>
          <button onClick={() => setSettings(false)}>إغلاق</button>
        </div>
      )}
    </div>
  );
}
