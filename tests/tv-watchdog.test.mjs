import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptCommand,
  backoffDelay,
  createWindowCounter,
  tokenTag,
} from '../src/lib/tvWatchdog.ts';

test('backoff: normal interval on success, doubles on failure, capped', () => {
  const mid = () => 0.5; // no jitter
  assert.equal(backoffDelay(0, 5000, 60000, mid), 5000);
  assert.equal(backoffDelay(1, 5000, 60000, mid), 10000);
  assert.equal(backoffDelay(2, 5000, 60000, mid), 20000);
  assert.equal(backoffDelay(50, 5000, 60000, mid), 60000);
  assert.ok(backoffDelay(3, 5000, 60000, () => 0) >= 32000);
});

test('window counter forgets old events', () => {
  const c = createWindowCounter(1000);
  assert.equal(c.add(0), 1);
  assert.equal(c.add(500), 2);
  assert.equal(c.add(1600), 1);
});

test('commands: targeting, validation, replay protection, expiry', () => {
  const token = 'abcdef0123456789';
  const seen = new Set();
  const now = 1_000_000;
  const cmd = { id: '1', name: 'reload', target: tokenTag(token), at: now };
  assert.deepEqual(acceptCommand(cmd, token, seen, now), cmd);
  assert.equal(acceptCommand(cmd, token, seen, now), null, 'same id twice is ignored');
  assert.equal(acceptCommand({ ...cmd, id: '2', target: 'zzzzzz' }, token, seen, now), null);
  assert.ok(acceptCommand({ ...cmd, id: '3', target: 'all' }, token, seen, now));
  assert.equal(acceptCommand({ ...cmd, id: '4', name: 'format-disk' }, token, seen, now), null);
  assert.equal(acceptCommand({ ...cmd, id: '5', at: now - 11 * 60_000 }, token, seen, now), null);
  assert.equal(acceptCommand(null, token, seen, now), null);
  assert.equal(tokenTag(token), 'abcdef');
});
