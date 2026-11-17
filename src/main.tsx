import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import './style.css';
import './loop.css';
import './reference-ui.css';
import './qudrat.css';
import './loop-variants.css';

const Admin = lazy(() => import('@/pages/admin/Admin'));
const Login = lazy(() => import('@/pages/Login'));
const Password = lazy(() => import('@/pages/Password'));
const Users = lazy(() => import('@/pages/Users'));
const News = lazy(() => import('@/pages/News'));
const Tv = lazy(() => import('@/pages/Tv'));

// After a new deploy, a page opened earlier asks for code files that no longer exist
// ("Failed to fetch dynamically imported module"). Reload once to pick up the new version.
const CHUNK_RELOAD_KEY = 'daily-screen-chunk-reload';
window.addEventListener('vite:preloadError', () => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0;
  } catch {}
  if (Date.now() - last < 30000) return; // already reloaded: let the real error show
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {}
  location.reload();
});

// Service Worker لصفحة التلفزيون فقط (إعادة تحميل دون اتصال)
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  (location.pathname.startsWith('/tv') || /^\/(?:display|tv)\d*$/.test(location.pathname))
) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="loading-page" />}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/password" element={<Password />} />
            <Route path="/users" element={<Users />} />
            <Route path="/news" element={<News />} />
            <Route path="/login" element={<Login />} />
            <Route path="/tv" element={<Tv />} />
            <Route path="/display" element={<Tv />} />
            <Route
              path="*"
              element={
                /^\/(?:display|tv)\d+$/.test(location.pathname) ? (
                  <Tv />
                ) : (
                  <Navigate to="/admin" replace />
                )
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);

import './presentation.css';
