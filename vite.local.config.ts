import { mergeConfig, type ProxyOptions } from 'vite';
import base from './vite.config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const backend: ProxyOptions = {
  target: 'http://127.0.0.1:8081',
  changeOrigin: false,
  configure(proxy) {
    proxy.on('proxyReq', (outgoing, request) => {
      if (request.headers.host) outgoing.setHeader('host', request.headers.host);
    });
  },
};
export default mergeConfig(base, {
  plugins: [
    {
      name: 'local-demo-backend',
      enforce: 'pre',
      async load(id: string) {
        if (id === fileURLToPath(new URL('./src/lib/supabase.ts', import.meta.url)))
          return readFile(new URL('./local-test/adapter.ts', import.meta.url), 'utf8');
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: { '/api': backend, '^/local(?:/|$)': backend, '/storage': backend },
  },
});
