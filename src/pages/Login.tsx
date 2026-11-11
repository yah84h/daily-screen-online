import '@/login.css';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Radio,
  Layers,
  CalendarDays,
  Monitor,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { signInUsername } from '@/lib/staff';
export default function Login() {
  const { session, loading, permissions, error: authError, refresh } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (
    !loading &&
    session &&
    !authError &&
    (permissions.admin || permissions.daily || permissions.news)
  )
    return (
      <Navigate
        to={
          permissions.admin || permissions.daily
            ? new URLSearchParams(location.search).get('next') === '/news' && permissions.news
              ? '/news'
              : '/admin'
            : '/news'
        }
        replace
      />
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await signInUsername(username, password);
      if (r.error) throw Error(r.error.message);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page login-redesign" dir="rtl">
      <section className="login-story" aria-label="الشاشة اليومية">
        <a className="login-wordmark" href="/login">
          <span>
            <Monitor size={23} />
          </span>{' '}
          الشاشة اليومية
        </a>
        <div className="login-story-copy">
          <span className="login-kicker">مساحة واحدة. كل شاشاتك.</span>
          <h1>
            رسالتك اليوم،
            <br />
            <em>أمام الجميع.</em>
          </h1>
          <p>من فكرة بسيطة على جوالك، إلى محتوى واضح على شاشة مدرستك.</p>
        </div>
        <div className="login-scene" aria-hidden="true">
          <div className="scene-glow" />
          <div className="scene-screen">
            <div className="scene-top">
              <span>شاشة المدرسة</span>
              <i>عرض مباشر</i>
            </div>
            <div className="scene-message">
              <small>رسالة اليوم</small>
              <strong>
                بداية صغيرة.
                <br />
                أثر كبير.
              </strong>
              <div className="scene-line" />
              <p>معًا نصنع يومًا أجمل.</p>
            </div>
            <div className="scene-clock">
              <span>09:15</span>
              <small>صباح مليء بالفرص</small>
              <div className="scene-progress">
                <i />
              </div>
            </div>
            <div className="scene-bottom">
              <span>الشاشة اليومية</span>
              <span>١٦ : ٩</span>
            </div>
          </div>
          <div className="scene-note">
            <Radio size={17} />
            <span>من جوالك، إلى شاشتك.</span>
          </div>
        </div>
        <div className="login-story-foot">
          <span>
            <Layers size={16} /> محتوى بهوية مدرستك
          </span>
          <span>
            <CalendarDays size={16} /> جاهز لكل يوم
          </span>
        </div>
      </section>
      <div className="login-form-side">
        <form className="login-card" onSubmit={submit} aria-busy={busy || loading}>
          <div className="login-logo">
            <Monitor size={30} />
          </div>
          <span className="login-school">مساحة المدرسة</span>
          <h2>أهلًا بعودتك</h2>
          <p>سجّل دخولك، وخلّ شاشتك تحكي رسالتك.</p>
          {!supabaseConfigured && (
            <p className="login-error">تسجيل الدخول غير مهيأ بعد. تواصل مع مسؤول المدرسة.</p>
          )}
          <label>
            اسم المستخدم أو البريد الإلكتروني
            <input
              aria-label="اسم المستخدم"
              type="text"
              dir="ltr"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="اسم المستخدم أو البريد الإلكتروني"
              required
              disabled={busy}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            كلمة المرور
            <div className="password-field">
              <input
                type={show ? 'text' : 'password'}
                aria-label="كلمة المرور"
                dir="ltr"
                autoComplete="current-password"
                required
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-pressed={show}
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={busy || loading || !supabaseConfigured}
          >
            {busy ? <Loader2 className="spin" size={18} /> : <ArrowLeft size={18} />}{' '}
            {busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
          </button>
          {(error || authError) && (
            <p className="login-error" role="alert">
              {error || authError}
            </p>
          )}
          {session && !permissions.admin && !permissions.daily && !permissions.news && (
            <p className="login-error">
              الحساب لا يملك صلاحيات. تواصل مع المسؤول أو{' '}
              <button type="button" onClick={() => supabase.auth.signOut()}>
                سجّل الخروج
              </button>
              .
            </p>
          )}
          <div className="login-foot">تحتاج إلى حساب؟ تواصل مع مسؤول المدرسة.</div>
        </form>
        <span className="login-copyright">الشاشة اليومية · مساحة أبسط ليوم أجمل</span>
      </div>
    </div>
  );
}
