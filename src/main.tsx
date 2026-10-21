import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import './style.css';
import './loop.css';

const Admin = lazy(() => import('@/pages/admin/Admin'));
const Login = lazy(() => import('@/pages/Login'));
const Tv = lazy(() => import('@/pages/Tv'));

// Service Worker لصفحة التلفزيون فقط (إعادة تحميل دون اتصال)
if ('serviceWorker' in navigator && location.pathname.startsWith('/tv')) {
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
            <Route path="/login" element={<Login />} />
            <Route path="/tv" element={<Tv />} />
            <Route path="/display" element={<Navigate to="/tv" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
