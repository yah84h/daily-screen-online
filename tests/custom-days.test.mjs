import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeCustomDay, customDayDate } from '../src/lib/customDays.ts';
test('custom designs activate for the exact Riyadh day, then fall back without changing the regular template', () => {
  const day = { id: 'test', enabled: true, date: '2026-11-14', html: '<main>Diabetes day</main>' };
  const template = { displayMode: 'loop', customDays: [day] };
  assert.equal(customDayDate(new Date('2026-11-13T21:00:00Z')), '2026-11-14');
  assert.equal(activeCustomDay(template, new Date('2026-11-13T20:59:59Z')), undefined);
  assert.equal(activeCustomDay(template, new Date('2026-11-13T21:00:00Z')), day);
  assert.equal(activeCustomDay(template, new Date('2026-11-14T20:59:59Z')), day);
  assert.equal(activeCustomDay(template, new Date('2026-11-14T21:00:00Z')), undefined);
  assert.equal(template.displayMode, 'loop');
  assert.equal(
    activeCustomDay(
      { displayMode: 'loop', customDays: [{ ...day, enabled: false }] },
      new Date('2026-11-14T10:00:00Z'),
    ),
    undefined,
  );
  assert.equal(
    activeCustomDay(
      { displayMode: 'loop', customDays: [{ ...day, html: '' }] },
      new Date('2026-11-14T10:00:00Z'),
    ),
    undefined,
  );
});

test('custom day designs leave non-background modes unchanged', () => {
  const day = { enabled: true, date: '2026-11-14', html: '<main>test</main>' };
  for (const displayMode of ['daily', 'media', 'slideshow', 'presentation', undefined])
    assert.equal(
      activeCustomDay({ displayMode, customDays: [day] }, new Date('2026-11-14T10:00:00Z')),
      undefined,
    );
});
