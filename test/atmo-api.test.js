import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAtmoClient, dataPath, readRetryAfter, FEEDS } from '../src/atmo-api.js';
import { fakeApis, USERNAME, PASSWORD, TODAY, NOW } from './helpers/fixtures.js';

const client = (fake, password = PASSWORD) =>
  createAtmoClient({
    getCredentials: () => ({ username: USERNAME, password }),
    fetch: fake,
    now: () => NOW,
  });

test('the filter is a readable path segment, without geometries', () => {
  assert.equal(
    dataPath(112, {
      code_zone: { operator: 'IN', value: ['33063'] },
      date_ech: { operator: '>=', value: TODAY },
    }),
    '/api/data/112/%7B%22code_zone%22:%7B%22operator%22:%22IN%22,%22value%22:%5B%2233063%22%5D%7D,%22date_ech%22:%7B%22operator%22:%22%3E=%22,%22value%22:%222026-10-16%22%7D%7D?withGeom=false',
  );
});

test('one round: one login, then the index, the episodes and the pollen', async () => {
  const fake = fakeApis();
  const rows = await client(fake).round({
    zones: ['33063', '243300316'],
    departments: ['33'],
    from: TODAY,
    pollen: true,
  });
  const calls = fake.atmoCalls();
  assert.deepEqual(
    calls.map((call) => new URL(call.url).pathname.split('/').slice(0, 4).join('/')),
    [
      '/api/login',
      `/api/data/${FEEDS.INDEX}`,
      `/api/data/${FEEDS.EPISODES}`,
      `/api/data/${FEEDS.POLLEN}`,
    ],
  );
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].body), { username: USERNAME, password: PASSWORD });
  for (const call of calls) {
    assert.ok(!call.url.includes(PASSWORD), 'the password never goes in an URL');
  }
  assert.equal(rows.index.length, 2);
  assert.equal(rows.episodes.length, 3);
  assert.equal(rows.pollen.length, 2);
});

test('pollen off: no pollen request; no department: no episode request', async () => {
  const fake = fakeApis();
  const rows = await client(fake).round({
    zones: ['33063'],
    departments: [],
    from: TODAY,
    pollen: false,
  });
  assert.equal(fake.atmoCalls().length, 2);
  assert.equal(rows.pollen, null);
  assert.deepEqual(rows.episodes, []);
});

test('errors: refused password, quota, server error, empty body', async () => {
  const fake = fakeApis();
  await assert.rejects(client(fake, 'wrong').login(), { kind: 'auth', status: 401 });
  fake.state.fail = { status: 429, headers: { 'retry-after': '120' } };
  await assert.rejects(client(fake).login(), { kind: 'rate_limited', retryAfter: 120 });
  fake.state.fail = { status: 500 };
  await assert.rejects(client(fake).login(), { kind: 'unreachable', status: 500 });
  const empty = async (url) =>
    url.endsWith('/api/login')
      ? new Response(JSON.stringify({ token: 't' }))
      : new Response('', { status: 200 });
  assert.deepEqual(
    await createAtmoClient({ getCredentials: () => ({}), fetch: empty }).feed('t', 112, {}),
    [],
  );
  const down = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  };
  await assert.rejects(createAtmoClient({ getCredentials: () => ({}), fetch: down }).login(), {
    kind: 'unreachable',
    message: 'ENOTFOUND',
  });
});

test('Retry-After in seconds or as a date', () => {
  assert.equal(readRetryAfter('30', NOW), 30);
  assert.equal(readRetryAfter(new Date(NOW + 90000).toUTCString(), NOW), 90);
  assert.equal(readRetryAfter(null, NOW), null);
});
