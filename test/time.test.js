import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  localClock,
  addDays,
  zonedInstant,
  nextSlot,
  previousSlot,
  nextMidnight,
  jitterOf,
  parseApiDate,
  displayInstant,
  JITTER_MINUTES,
} from '../src/time.js';

const iso = (ms) => new Date(ms).toISOString();

test('local clock and calendar dates', () => {
  assert.deepEqual(localClock(Date.parse('2026-10-16T22:30:00Z'), 'Europe/Paris'), {
    date: '2026-10-17',
    minutes: 30,
  });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(displayInstant('2026-10-16'), '2026-10-16T00:00:00.000Z');
});

test('a Paris wall-clock time, across the DST change', () => {
  assert.equal(
    iso(zonedInstant('2026-10-16', 15 * 60 + 30, 'Europe/Paris')),
    '2026-10-16T13:30:00.000Z',
  );
  // Winter time from 2026-10-25.
  assert.equal(
    iso(zonedInstant('2026-10-26', 7 * 60 + 30, 'Europe/Paris')),
    '2026-10-26T06:30:00.000Z',
  );
});

test('reading slots at 07:30 and 15:30 Paris time, plus 20:30 for overseas', () => {
  const morning = Date.parse('2026-10-16T08:00:00Z'); // 10:00 Paris
  assert.equal(iso(nextSlot(morning)), '2026-10-16T13:30:00.000Z');
  assert.equal(iso(previousSlot(morning)), '2026-10-16T05:30:00.000Z');
  const evening = Date.parse('2026-10-16T17:00:00Z'); // 19:00 Paris
  assert.equal(iso(nextSlot(evening)), '2026-10-17T05:30:00.000Z');
  assert.equal(iso(nextSlot(evening, { overseas: true })), '2026-10-16T18:30:00.000Z');
  assert.equal(iso(nextSlot(morning, { jitter: 7 })), '2026-10-16T13:37:00.000Z');
});

test('a stable jitter per account, below the bound', () => {
  assert.equal(jitterOf('me@example.com'), jitterOf('me@example.com'));
  for (const seed of ['', 'a', 'someone@example.org', 'x'.repeat(200)]) {
    const jitter = jitterOf(seed);
    assert.ok(jitter >= 0 && jitter < JITTER_MINUTES, seed);
  }
});

test('next local midnight', () => {
  assert.equal(
    iso(nextMidnight(Date.parse('2026-10-16T08:00:00Z'), 'Europe/Paris')),
    '2026-10-16T22:01:00.000Z',
  );
});

test('dates of the API', () => {
  assert.equal(iso(parseApiDate('2026/10/16 12:11:49.728+02')), '2026-10-16T10:11:49.000Z');
  assert.equal(iso(parseApiDate('2026-10-16')), '2026-10-16T00:00:00.000Z');
  assert.equal(parseApiDate('soon'), null);
  assert.equal(parseApiDate(null), null);
});
