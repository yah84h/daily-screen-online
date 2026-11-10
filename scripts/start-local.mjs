import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error(
    'Install Node.js 22 or newer, then reopen Start-Windows.bat (Windows) or Start-Mac.command (Mac).',
  );
  process.exit(1);
}
// Server-only settings stay outside the browser bundle. Existing shell settings take precedence.
for (const name of ['.env', '.env.local'])
  if (fs.existsSync(path.join(root, name))) process.loadEnvFile(path.join(root, name));
const port = Number(process.env.PORT) || 8080,
  origin = 'http://127.0.0.1:' + port;
const instance = createHash('sha256')
  .update(path.join(root, 'local-test'))
  .digest('hex')
  .slice(0, 20);
let existing = null;
try {
  const response = await fetch(origin + '/local/status', { signal: AbortSignal.timeout(1500) });
  if (response.ok) existing = await response.json();
} catch {}
function openAdmin() {
  if (!process.argv.includes('--no-open')) {
    const child = spawn(
      process.platform === 'win32' ? 'rundll32.exe' : 'open',
      process.platform === 'win32'
        ? ['url.dll,FileProtocolHandler', origin + '/admin']
        : [origin + '/admin'],
      { stdio: 'ignore' },
    );
    child.on('error', () => {});
  }
}
if (existing?.kind === 'daily-screen-local' && existing.instance !== instance) {
  console.error(
    'Another local server is using this port. Stop its Terminal window before starting this project.',
  );
  process.exit(1);
}
if (existing?.instance === instance && existing.webReady) {
  console.log('This website is already running: ' + origin + '/admin');
  openAdmin();
  process.exit(0);
}
let active,
  stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopping = true;
    active?.kill(signal);
  });
async function run(command, args) {
  if (stopping) return;
  await new Promise((resolve, reject) => {
    active = spawn(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
    active.on('error', reject);
    active.on('exit', (code, signal) => {
      active = null;
      if (code === 0 || stopping) resolve();
      else reject(Error(`Local startup stopped (${signal || code}).`));
    });
  });
}
try {
  if (
    !fs.existsSync(path.join(root, 'node_modules/vite/package.json')) ||
    !fs.existsSync(path.join(root, 'node_modules/@web-ppt/core/package.json'))
  ) {
    console.log('Preparing local dependencies (first run only)…');
    if (process.platform === 'win32') {
      const npm = path.join(
        path.dirname(process.execPath),
        'node_modules',
        'npm',
        'bin',
        'npm-cli.js',
      );
      if (!fs.existsSync(npm))
        throw Error('Install the standard Node.js LTS Windows installer, then retry.');
      await run(process.execPath, [npm, 'ci', '--no-fund', '--no-audit']);
    } else await run('npm', ['ci', '--no-fund', '--no-audit']);
  }
  console.log('Building the school website. Existing data folders are preserved.');
  await run(process.execPath, ['scripts/build-local.mjs']);
  if (!stopping && existing?.instance === instance) {
    console.log('The existing local server can now serve its built website: ' + origin + '/admin');
    openAdmin();
  } else if (!stopping) {
    console.log('Starting the local server. Keep this window open; stop with Control+C.');
    const args = [
      'local-test/server.mjs',
      ...(process.argv.includes('--localhost') ? ['--localhost'] : ['--lan']),
      ...(process.argv.includes('--no-open') ? [] : ['--open']),
    ];
    await run(process.execPath, args);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
