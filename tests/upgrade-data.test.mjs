import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
test('upgrade copies accounts, content and media while retaining old data and refusing overwrites', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'native-upgrade-'));
  try {
    const old = path.join(temp, 'SchoolScreen-Local-Server'),
      next = path.join(temp, 'SchoolScreen-Local-Server-0.3.0');
    fs.mkdirSync(path.join(old, 'data', 'media'), { recursive: true });
    fs.mkdirSync(next);
    fs.writeFileSync(
      path.join(old, 'data', 'state.json'),
      JSON.stringify({ screens: [{ name: 'Existing screen' }], posts: [] }),
    );
    fs.writeFileSync(
      path.join(old, 'data', 'staff.json'),
      JSON.stringify({ users: [{ username: 'teacher', hash: 'preserve-this-hash' }] }),
    );
    fs.writeFileSync(path.join(old, 'data', 'media', 'image.jpg'), 'preserve-media');
    fs.copyFileSync(
      new URL('../local-test/upgrade-data.mjs', import.meta.url),
      path.join(next, 'upgrade-data.mjs'),
    );
    const run = () =>
      spawnSync(process.execPath, [path.join(next, 'upgrade-data.mjs')], {
        env: { ...process.env, PORT: '28946' },
        encoding: 'utf8',
      });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    for (const relative of ['state.json', 'staff.json', 'media/image.jpg'])
      assert.deepEqual(
        fs.readFileSync(path.join(old, 'data', relative)),
        fs.readFileSync(path.join(next, 'data', relative)),
      );
    fs.writeFileSync(path.join(old, 'data', 'state.json'), '{}');
    const second = run();
    assert.equal(second.status, 0);
    assert(second.stdout.includes('Nothing was overwritten'));
    assert(JSON.parse(fs.readFileSync(path.join(next, 'data', 'state.json'))).screens.length === 1);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
