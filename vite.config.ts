import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const commit = (process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || 'local').slice(0, 7);
const appVersion = `${commit} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist', sourcemap: false },
});
