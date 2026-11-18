import { reloadDisplay } from '@/lib/reloadDisplay';
import { RemoteMediaReceiver } from '@/components/RemoteMediaReceiver';
import { clearShowCache } from '@/lib/assetCache';
import { BackgroundAudio } from '@/components/BackgroundAudio';
import DisplayControls from '@/components/DisplayControls';
import { useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';
import { PreparedDisplay } from '@/components/PreparedDisplay';
import { CacheStatusLine } from '@/components/CacheStatusLine';
import { fetchTv, requestPairing, screenChannel } from '@/lib/api';
import { cacheTvState, readTvCache } from '@/lib/offline';
import { initialContent, type TvState } from '@/lib/types';
import { TvErrorBoundary } from '@/components/TvErrorBoundary';
import { buildStatus, installGlobalErrorLog, publishStatus, recordError } from '@/lib/tvHealth';
import { acceptCommand, backoffDelay, createWindowCounter } from '@/lib/tvWatchdog';

const TOKEN_KEY = location.pathname === '/tv' ? 'tv-token' : 'tv-token:' + location.pathname;
const urlToken = new URLSearchParams(location.search).get('token') || '';
const CACHE_KEY = urlToken || (location.pathname === '/tv' ? 'last' : TOKEN_KEY);
const POLL_MS = 5_000;
const HEARTBEAT_MS = 30_000;
const BLACKOUT_KEY = 'tv-blackout';
// Watchdog: after this many failed polls in a row (~10 min with backoff) while the
// browser thinks it is online, reload the page once; at most once every 30 minutes.
const WATCHDOG_FAILURES = 12;
const WATCHDOG_KEY = 'tv-watchdog-reload';
const watchdogReload = () => {
  try {
    const last = Number(localStorage.getItem(WATCHDOG_KEY)) || 0;
    if (Date.now() - last < 30 * 60_000) return;
    localStorage.setItem(WATCHDOG_KEY, String(Date.now()));
  } catch {}
  void reloadDisplay();
};
const readBlackout = () => {
  try {
    return localStorage.getItem(BLACKOUT_KEY) === '1';
  } catch {
    return false;
  }
};

type Paired = Extract<TvState, { status: 'paired' }>;

export default function Tv() {
  const [state, setState] = useState<TvState | null>(null);
  const [online, setOnline] = useState(true);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState('');
  const [closeHint, setCloseHint] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const lastVersion = useRef('');
  const [blackout, setBlackout] = useState(readBlackout);
  const live = useRef({ online: true, blackout: readBlackout(), failures: 0, mode: '' });
  live.current.online = online;
  live.current.blackout = blackout;
  live.current.mode =
    state?.status === 'paired'
      ? (state as Paired).screen.template?.displayMode || 'daily'
      : state?.status || 'loading';

  //تأكيد داخل الصفحة (نوافذ confirm قد لا تظهر في وضع Kiosk)
  const stopDisplay = () => {
    if (!confirmStop) {
      setConfirmStop(true);
      setTimeout(() => setConfirmStop(false), 5000); // يلغى التأكيد تلقائيًا بعد 5 ثوانٍ
      return;
    }
    window.close();
    // إن لم يسمح المتصفح بالإغلاق (فُتحت الصفحة يدويًا لا عبر Start-TV) نعرض البديل
    setTimeout(() => setCloseHint(true), 400);
  };

  // الحالة المحفوظة تظهر فورًا قبل الاتصال
  useEffect(() => {
    readTvCache(CACHE_KEY).then((c) => c && setState((s) => s ?? c));
  }, []);

  useEffect(() => {
    let active = true;
    let token = urlToken || localStorage.getItem(TOKEN_KEY) || '';
    let sub: ReturnType<typeof screenChannel> | null = null;

    let requestId = 0;
    let pollTimer = 0;
    let screenId = '';
    const seen = new Set<string>();
    const globalErrors = createWindowCounter(5 * 60_000);
    installGlobalErrorLog(() => {
      // A burst of uncaught errors usually means the page is wedged: start fresh.
      if (globalErrors.add() >= 25) watchdogReload();
    });
    const heartbeat = () => {
      if (!screenId || !token) return;
      void publishStatus(screenId, token, buildStatus({ token, ...live.current })).catch(() => {});
    };
    const runCommand = (raw: unknown) => {
      const cmd = acceptCommand(raw, token, seen);
      if (!cmd) return;
      if (cmd.name === 'reload') location.reload();
      else if (cmd.name === 'restart') void reloadDisplay();
      else if (cmd.name === 'blackout' || cmd.name === 'wake') {
        const on = cmd.name === 'blackout';
        try {
          localStorage.setItem(BLACKOUT_KEY, on ? '1' : '0');
        } catch {}
        live.current.blackout = on;
        setBlackout(on);
      }
      setTimeout(heartbeat, 300); // confirm quickly (also answers 'ping')
    };
    const schedule = () => {
      clearTimeout(pollTimer);
      if (active) pollTimer = window.setTimeout(load, backoffDelay(live.current.failures, POLL_MS));
    };
    const load = async () => {
      const request = ++requestId;
      try {
        if (!token) {
          const p = await requestPairing();
          token = p.token;
          localStorage.setItem(TOKEN_KEY, token);
        }
        const data = await fetchTv(token);
        if (!active || request !== requestId) return;
        if (data.status === 'unknown') {
          // الرمز انتهى أو حُذف الجهاز من اللوحة → ابدأ ربطًا جديدًا
          localStorage.removeItem(TOKEN_KEY);
          token = '';
          return load();
        }
        live.current.failures = 0;
        setOnline(true);
        setError('');
        setState(data);
        if (data.status === 'paired') {
          if (data.version !== lastVersion.current) {
            lastVersion.current = data.version;
            cacheTvState(data, CACHE_KEY);
          }
          if (!sub) {
            screenId = data.screen.id;
            sub = screenChannel(data.screen.id);
            sub
              .on('broadcast', { event: 'update' }, () => load())
              .on('broadcast', { event: 'command' }, (m) => runCommand(m.payload))
              .subscribe((s) => s === 'SUBSCRIBED' && heartbeat());
          }
        }
      } catch (e) {
        if (!active || request !== requestId) return;
        live.current.failures += 1;
        recordError(e);
        setOnline(false);
        setError((e as Error).message);
        if (live.current.failures >= WATCHDOG_FAILURES && navigator.onLine) watchdogReload();
      } finally {
        if (request === requestId) schedule();
      }
    };

    load();
    const beat = setInterval(heartbeat, HEARTBEAT_MS);
    const onOnline = () => {
      live.current.failures = 0;
      void load();
    };
    window.addEventListener('online', onOnline);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') setSettings((v) => !v);
      if (e.key === 'Escape') setSettings(false);
      // وضع العرض فقط: منع مفاتيح التنقل والتحكم بالمتصفح
      const nav =
        e.key === 'Backspace' ||
        (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home')) ||
        (e.ctrlKey && /^[lLtTnNwWoOpPjJhHuUsSdD]$/.test(e.key)) ||
        e.key === 'F1' ||
        e.key === 'F3' ||
        e.key === 'F6' ||
        e.key === 'F7' ||
        e.key === 'F12';
      if (nav) e.preventDefault();
    };
    const block = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', block);
    window.addEventListener('dragstart', block);
    return () => {
      active = false;
      clearTimeout(pollTimer);
      clearInterval(beat);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', block);
      window.removeEventListener('dragstart', block);
      sub?.unsubscribe();
    };
  }, []);

  const paired = state?.status === 'paired' ? (state as Paired) : null;

  return (
    <div className="tv" onDoubleClick={() => setSettings((v) => !v)}>
      {paired ? (
        <TvErrorBoundary>
          <PreparedDisplay
            key={paired.screen.id}
            content={paired.post?.content || initialContent}
            template={paired.screen.template}
            school={paired.school}
            large
            presentationContext={{
              screenId: paired.screen.id,
              token: urlToken || localStorage.getItem(TOKEN_KEY) || '',
            }}
          />
        </TvErrorBoundary>
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
      <TvErrorBoundary fallback={null}>
        <BackgroundAudio
          source={blackout ? undefined : paired?.post?.content.backgroundAudio}
          controls={settings}
        />
      </TvErrorBoundary>
      {paired && (
        <TvErrorBoundary fallback={null}>
          <RemoteMediaReceiver
            key={paired.screen.id}
            screen={paired.screen.id}
            token={urlToken || localStorage.getItem(TOKEN_KEY) || ''}
          />
        </TvErrorBoundary>
      )}
      {blackout && <div className="tv-blackout" aria-label="الشاشة مطفأة عن بُعد" />}
      {/* Presentations keep progress off the audience's screen; the phone shows it. */}
      {!['presentation', 'show'].includes(paired?.screen.template?.displayMode || '') && (
        <CacheStatusLine />
      )}
      <DisplayControls />
      {settings && (
        <div className="tv-settings">
          <b>{online ? 'متصلة' : 'غير متصلة · تُعرض آخر شاشة محفوظة'}</b>
          {blackout && (
            <button
              onClick={() => {
                try {
                  localStorage.setItem(BLACKOUT_KEY, '0');
                } catch {}
                setBlackout(false);
              }}
            >
              إلغاء الشاشة السوداء
            </button>
          )}
          {paired && <span>{paired.screen.name}</span>}
          <button onClick={() => void reloadDisplay()}>تحديث الموقع وإعادة تحميل الشاشة</button>
          <button
            onClick={() => {
              void clearShowCache()
                .then(() => location.reload())
                .catch(() => alert('تعذر مسح ذاكرة الوسائط.'));
            }}
          >
            مسح ذاكرة قوائم الوسائط على هذا الجهاز
          </button>
          <button
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
            }
          >
            تبديل ملء الشاشة
          </button>
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
          <button onClick={stopDisplay} className={'danger ' + (confirmStop ? 'armed' : '')}>
            {confirmStop ? 'اضغط مرة أخرى للتأكيد' : 'إيقاف العرض'}
          </button>
          {closeHint && (
            <small>لم يسمح المتصفح بالإغلاق من الصفحة. اضغط Alt+F4 أو شغّل Stop-TV.bat.</small>
          )}
          <button
            onClick={() => {
              setSettings(false);
              setConfirmStop(false);
            }}
          >
            إغلاق القائمة
          </button>
        </div>
      )}
    </div>
  );
}
