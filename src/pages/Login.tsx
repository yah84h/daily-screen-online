import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Monitor, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!loading && session) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error)
        setError(
          error.message === "Invalid login credentials"
            ? "البريد أو كلمة المرور غير صحيحة."
            : error.message,
        );
    } catch {
      setError("تعذّر الاتصال. تحقق من الشبكة وحاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <Monitor size={30} />
        </div>
        <span className="login-school">مدارس الموهوبين التقنيه بجدة</span>
        <h1>أهلًا بعودتك.</h1>
        <p>سجّل الدخول، وحدّث يومك على الشاشة في ثوانٍ</p>
        {!supabaseConfigured && (
          <p className="login-error" role="alert">
            لم تُضبط مفاتيح Supabase. أضف VITE_SUPABASE_URL
            وVITE_SUPABASE_ANON_KEY.
          </p>
        )}
        <label>
          البريد الإلكتروني
          <input
            type="email"
            dir="ltr"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          كلمة المرور
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              aria-label="كلمة المرور"
              dir="ltr"
              autoComplete="current-password"
              disabled={busy}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={
                showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
              }
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </label>
        <button
          type="submit"
          className="button primary"
          disabled={busy || !supabaseConfigured}
        >
          {busy ? <Loader2 className="spin" size={18} /> : null} تسجيل الدخول
        </button>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <div className="login-foot">
          تُنشأ حسابات المسؤولين من لوحة Supabase · لا تسجيل ذاتي
        </div>
      </form>
    </div>
  );
}
