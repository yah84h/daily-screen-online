import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyShow,
  showReduce,
  showSteps,
  showReadiness,
  partKey,
} from '../local-test/show-state.mjs';

const video = { op: 'add', item: { id: 'video-1', kind: 'video', name: 'intro.mp4' } };
const deck = { op: 'add', item: { id: 'deck-01', kind: 'deck', name: 'a.pptx', parts: 3 } };

test('decks expand to one step per slide, in item order', () => {
  let s = showReduce(emptyShow(), video);
  s = showReduce(s, deck);
  assert.deepEqual(
    showSteps(s.items).map((step) => step.item + ':' + step.part),
    ['video-1:0', 'deck-01:0', 'deck-01:1', 'deck-01:2'],
  );
});

test('start, next, previous, pause and end stay in range', () => {
  let s = showReduce(showReduce(emptyShow(), video), deck);
  assert.throws(() => showReduce(emptyShow(), { op: 'start' }));
  s = showReduce(s, { op: 'next' });
  assert.equal(s.step, 0, 'next before start does nothing');
  s = showReduce(s, { op: 'start' });
  for (let i = 0; i < 10; i++) s = showReduce(s, { op: 'next' });
  assert.equal(s.step, 3);
  s = showReduce(s, { op: 'standby' });
  assert.equal(s.phase, 'paused');
  s = showReduce(s, { op: 'resume' });
  assert.equal(s.phase, 'live');
  assert.equal(s.step, 3, 'resume keeps the position');
  s = showReduce(s, { op: 'end' });
  assert.deepEqual([s.phase, s.step], ['standby', 0]);
});

test('files cannot change while live; reorder and remove work in standby', () => {
  let s = showReduce(showReduce(emptyShow(), video), deck);
  s = showReduce(s, { op: 'start' });
  assert.throws(() => showReduce(s, { op: 'remove', id: 'video-1' }));
  s = showReduce(s, { op: 'end' });
  s = showReduce(s, { op: 'move', id: 'deck-01', by: -1 });
  assert.deepEqual(
    s.items.map((item) => item.id),
    ['deck-01', 'video-1'],
  );
  s = showReduce(s, { op: 'remove', id: 'deck-01' });
  assert.deepEqual(
    s.items.map((item) => item.id),
    ['video-1'],
  );
});

test('links must be https and items are sanitised', () => {
  assert.throws(() =>
    showReduce(emptyShow(), {
      op: 'add',
      item: { id: 'link-01', kind: 'video', source: 'link', url: 'http://x' },
    }),
  );
  assert.throws(() => showReduce(emptyShow(), { op: 'add', item: { id: '../x', kind: 'video' } }));
  const s = showReduce(emptyShow(), {
    op: 'add',
    item: { id: 'link-01', kind: 'image', source: 'link', url: 'https://drive.google.com/x' },
  });
  assert.equal(s.items[0].source, 'link');
});

test('readiness counts every slide of a deck', () => {
  const s = showReduce(showReduce(emptyShow(), video), deck);
  assert.deepEqual(showReadiness(s.items, { [partKey('video-1')]: true }), {
    total: 4,
    ready: 1,
    complete: false,
  });
  const all = Object.fromEntries(
    ['video-1#0', 'deck-01#0', 'deck-01#1', 'deck-01#2'].map((key) => [key, true]),
  );
  assert.equal(showReadiness(s.items, all).complete, true);
});

test('auto-advance, loop, blackout and settings', () => {
  let s = showReduce(showReduce(emptyShow(), video), deck);
  assert.deepEqual(s.settings, {
    autoNext: false,
    imageSeconds: 10,
    loop: false,
    loadingPage: true,
  });
  s = showReduce(s, { op: 'settings', settings: { imageSeconds: 1, loop: true, autoNext: true } });
  assert.deepEqual(s.settings, { autoNext: true, imageSeconds: 3, loop: true, loadingPage: true });
  s = showReduce(s, { op: 'advance' });
  assert.equal(s.step, 0, 'advance does nothing before start');
  s = showReduce(s, { op: 'start' });
  for (let i = 0; i < 3; i++) s = showReduce(s, { op: 'advance' });
  assert.equal(s.step, 3);
  s = showReduce(s, { op: 'advance' });
  assert.equal(s.step, 0, 'loop wraps to the start');
  s = showReduce(s, { op: 'settings', settings: { loop: false } });
  s = showReduce(s, { op: 'goto', index: 3 });
  assert.equal(showReduce(s, { op: 'advance' }).step, 3, 'no loop: stays on the last step');
  s = showReduce(s, { op: 'blackout' });
  assert.equal(s.blackout, true);
  s = showReduce(s, { op: 'next' });
  assert.equal(s.blackout, true, 'moving while black stays black');
  assert.equal(showReduce(s, { op: 'end' }).blackout, false);
  const old = { title: '', items: [], phase: 'standby', step: 0, revision: 0 };
  assert.deepEqual(showReduce(old, { op: 'title', title: 'x' }).settings.imageSeconds, 10);
});

test('standby background photo is set, sanitised and cleared', async () => {
  const { findPartOwner } = await import('../local-test/show-state.mjs');
  let s = showReduce(emptyShow(), {
    op: 'background',
    item: { id: 'background-1', name: 'hall.jpg', kind: 'video' },
  });
  assert.deepEqual(s.background, { id: 'background-1', name: 'hall.jpg', kind: 'video' });
  assert.equal(findPartOwner(s, 'background-1').kind, 'video', 'looping video background');
  const photo = showReduce(emptyShow(), {
    op: 'background',
    item: { id: 'background-2', name: 'hall.gif', kind: 'deck' },
  });
  assert.equal(findPartOwner(photo, 'background-2').kind, 'image', 'anything else is a photo/GIF');
  assert.equal(findPartOwner(s, 'nope'), null);
  assert.throws(() => showReduce(s, { op: 'background', item: { id: '../x', name: 'x' } }));
  s = showReduce(s, { op: 'background', item: null });
  assert.equal(s.background, null);
});

test('per-file end rules, early hand-over value, play out of order', () => {
  let s = showReduce(showReduce(emptyShow(), video), deck);
  s = showReduce(s, { op: 'add', item: { id: 'video-2', kind: 'video', name: 'b.mp4' } });
  assert.deepEqual([s.items[0].after, s.items[0].lead], ['auto', 0]);
  s = showReduce(s, { op: 'start' });
  // auto + auto-advance off → stays.
  assert.equal(showReduce(s, { op: 'finish' }).step, 0);
  // video-1 → back to standby; resume continues with the next file.
  s = showReduce(s, { op: 'item', id: 'video-1', options: { after: 'standby', lead: 4 } });
  assert.deepEqual([s.items[0].after, s.items[0].lead], ['standby', 4]);
  s = showReduce(s, { op: 'finish' });
  assert.deepEqual([s.phase, s.step], ['paused', 1]);
  s = showReduce(s, { op: 'resume' });
  assert.deepEqual([s.phase, s.step], ['live', 1]);
  // Middle slides of a deck follow auto-advance only; its rule applies on the last slide.
  s = showReduce(s, { op: 'item', id: 'deck-01', options: { after: 'next' } });
  assert.equal(showReduce(s, { op: 'finish' }).step, 1, 'slide 1 of 3 stays without auto-advance');
  s = showReduce(s, { op: 'goto', index: 3 });
  assert.equal(showReduce(s, { op: 'finish' }).step, 4, 'last slide → next file');
  // Play any file now; lead is clamped.
  s = showReduce(s, { op: 'play', id: 'video-1' });
  assert.deepEqual([s.phase, s.step], ['live', 0]);
  s = showReduce(s, { op: 'item', id: 'video-2', options: { lead: 99 } });
  assert.equal(s.items[2].lead, 10);
  assert.throws(() => showReduce(s, { op: 'play', id: 'nope' }));
  // Last file → standby ends the show.
  s = showReduce(s, { op: 'item', id: 'video-2', options: { after: 'standby' } });
  s = showReduce(s, { op: 'goto', index: 4 });
  assert.deepEqual(
    [showReduce(s, { op: 'finish' }).phase, showReduce(s, { op: 'finish' }).step],
    ['standby', 0],
  );
});

test('break items stop at the standby screen; wallpaper background has no file', async () => {
  const { findPartOwner } = await import('../local-test/show-state.mjs');
  let s = showReduce(emptyShow(), video);
  s = showReduce(s, { op: 'add', item: { id: 'break-01', kind: 'break', name: 'شاشة الانتظار' } });
  s = showReduce(s, deck);
  assert.deepEqual(
    showSteps(s.items).map((step) => step.kind),
    ['video', 'break', 'image', 'image', 'image'],
  );
  assert.equal(showReadiness(s.items, {}).total, 4, 'a break needs no file');
  s = showReduce(s, { op: 'background', item: { id: 'x', name: 'x', kind: 'wallpaper' } });
  assert.deepEqual(s.background, { id: 'wallpaper', name: 'wallpaper', kind: 'wallpaper' });
  assert.equal(findPartOwner(s, 'wallpaper'), null);
});
