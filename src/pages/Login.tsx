import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Monitor, Loader2 } from "lucide-react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!loading && session) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
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
    setBusy(false);
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <Monitor size={30} />
        </div>
        <h1>الشاشة اليومية</h1>
        <p>سجّل دخول مسؤول المدرسة للتحكم في الشاشة من أي مكان</p>
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
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          كلمة المرور
          <input
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
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
