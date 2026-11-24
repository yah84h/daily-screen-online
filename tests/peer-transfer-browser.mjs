import { chromium } from 'playwright';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd(),
  temp = await mkdtemp(join(tmpdir(), 'peer-browser-'));
await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{PeerVideoReceiver}from'./src/components/PeerVideoReceiver';import{PeerVideoSender}from'./src/pages/admin/PeerVideoSender';import*as transfer from './src/lib/peerTransfer';window.transfer=transfer;createRoot(document.getElementById('root')).render(location.pathname==='/tv'?<PeerVideoReceiver screen="test-screen" token="test-device-secret"/>:<PeerVideoSender/>);`,
    loader: 'tsx',
    resolveDir: root,
  },
  bundle: true,
  jsx: 'automatic',
  format: 'esm',
  outfile: join(temp, 'app.js'),
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'mock-signaling-only',
      setup(b) {
        b.onResolve({ filter: /supabase$|^\.\/store$|^@\// }, (args) => {
          if (args.path.endsWith('supabase')) return { path: 'mock-supabase', namespace: 'mock' };
          if (args.path === './store') return { path: 'mock-store', namespace: 'mock' };
          const base = resolve(root, 'src', args.path.slice(2));
          return { path: ['.ts', '.tsx'].map((ext) => base + ext).find(existsSync) || base };
        });
        b.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
          loader: 'js',
          contents:
            args.path === 'mock-store'
              ? `export const useAdmin=()=>({data:{screen:{id:'test-screen'},devices:[{token:'test-device-secret',label:'Test screen'}]}});`
              : `export const isLocalBackend=false;export const supabase={channel(name){const bus=new BroadcastChannel(name);let handler;return{on(type,filter,callback){handler=callback;return this;},subscribe(callback){bus.onmessage=e=>handler?.({payload:e.data});setTimeout(()=>callback('SUBSCRIBED'),0);return this;},async send(message){bus.postMessage(message.payload);return 'ok';},async unsubscribe(){bus.close();}};}};`,
        }));
      },
    },
  ],
});
const server = createServer(async (req, res) => {
  if (req.url === '/app.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(await readFile(join(temp, 'app.js')));
  } else
    res.end(
      '<html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
    );
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Native {
      constructor(config) {
        super({ ...config, iceServers: [] });
      }
    };
  });
  const errors = [];
  context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  const tv = await context.newPage();
  await tv.goto(base + '/tv');
  const admin = await context.newPage();
  await admin.goto(base + '/admin');
  const bytes = await readFile('tests/fixtures/drive-test.webm');
  await admin
    .getByLabel('فيديو للنقل المباشر')
    .setInputFiles({ name: 'test.webm', mimeType: 'video/webm', buffer: bytes });
  await admin
    .getByRole('button', { name: 'تشغيل الفيديو على الشاشة', exact: true })
    .waitFor({ timeout: 60000 });
  assert((await admin.getByRole('status').innerText()).includes('محفوظ'));
  const stored = await tv.evaluate(async () => {
    const file = await window.transfer.peerStore('test-screen');
    return {
      size: file.blob.size,
      name: file.name,
      bytes: Array.from(new Uint8Array(await file.blob.arrayBuffer())),
    };
  });
  assert.equal(stored.size, bytes.length);
  assert.equal(stored.name, 'test.webm');
  assert.deepEqual(stored.bytes, Array.from(bytes));
  await admin.getByRole('button', { name: 'تشغيل الفيديو على الشاشة', exact: true }).click();
  await tv.waitForFunction(() => document.querySelector('video')?.currentTime > 0);
  await admin.getByRole('button', { name: 'العودة إلى العرض المعتاد', exact: true }).click();
  await tv.locator('video').waitFor({ state: 'detached' });
  await tv.reload();
  await tv.waitForFunction(() => !!window.transfer);
  assert.equal(
    await tv.evaluate(async () => (await window.transfer.peerStore('test-screen')).blob.size),
    bytes.length,
  );
  // A second transfer is possible after cancelling/closing the first signaling session.
  await admin
    .getByLabel('فيديو للنقل المباشر')
    .setInputFiles({ name: 'again.webm', mimeType: 'video/webm', buffer: bytes });
  await admin
    .getByRole('button', { name: 'تشغيل الفيديو على الشاشة', exact: true })
    .waitFor({ timeout: 60000 });
  assert.equal(
    await tv.evaluate(async () => (await window.transfer.peerStore('test-screen')).name),
    'again.webm',
  );
  await admin
    .getByLabel('فيديو للنقل المباشر')
    .setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test') });
  await admin.getByRole('status').filter({ hasText: '٥١٢' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS actual WebRTC bytes, receiver cache acknowledgement, exact cached bytes, play/stop, cache survives reload, second transfer, unsupported file rejection. Supabase signaling mocked with BroadcastChannel; RTC and IndexedDB are real.',
  );
} catch (error) {
  for (const context of browser?.contexts() || [])
    for (const page of context.pages())
      console.log('DEBUG', page.url(), await page.locator('body').innerText());
  throw error;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await rm(temp, { recursive: true, force: true });
}
