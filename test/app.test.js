// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and fake
// Atmo Data and geo.api.gouv.fr services.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS, REFRESH_MIN_INTERVAL_MS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import {
  fakeApis,
  storePath,
  silent,
  usualRows,
  indexRow,
  episodeRow,
  NOW,
  TZ,
  USERNAME,
  PASSWORD,
  HOUSES,
  TODAY,
  TOMORROW,
} from './helpers/fixtures.js';

const CONFIG = { username: USERNAME, password: PASSWORD, house_1: 'home', commune_2: 'Mâcon' };
const PREFIX = 'ext:test-integration:commune';
const BORDEAUX = `${PREFIX}:33063`;
const MACON = `${PREFIX}:71270`;
const HOUR = 3600 * 1000;

/**
 * @description The integration, connected to a fake Gladys and fake services.
 * @param {object} [options] - `{ config, apis, path, now }`.
 * @returns {Promise<object>} `{ gladys, app, apis, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  apis = fakeApis(),
  path = storePath(),
  now = NOW,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config, houses: HOUSES });
  const app = createApp(gladys, {
    fetch: apis,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, apis, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);

test('a house and a typed commune become two devices, read in one round of four requests', async (t) => {
  const { gladys, app, apis } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [BORDEAUX, 'Qualité de l’air Bordeaux'],
      [MACON, 'Qualité de l’air Mâcon'],
    ],
  );
  assert.equal(apis.atmoCalls().length, 4, 'login, index, episodes, pollen');
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(
    gladys.fake.connectionStatus.message.fr,
    /Bordeaux moyen, Mâcon bon\. Prochaine mise à jour vers 15:/,
  );
  assert.deepEqual(gladys.fake.sceneEvents, [], 'the first reading is a baseline');
  assert.equal(app.store.data.forecasts['71270'].dates[TODAY].index.zone, 'epci');
});

test('states of a created device, sent again when it is created', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.states.length, 0, 'nothing before a device exists');
  await created(gladys, BORDEAUX);
  assert.equal(gladys.fake.lastState(`${BORDEAUX}:index`), 2);
  assert.equal(gladys.fake.lastState(`${BORDEAUX}:index_tomorrow`), 3);
  assert.equal(gladys.fake.lastState(`${BORDEAUX}:quality`), 'Moyen');
  assert.equal(gladys.fake.lastState(`${BORDEAUX}:pollen_taxa`), 'Graminées');
  assert.equal(gladys.fake.lastState(`${MACON}:index`), undefined);
});

test('a restart before the next slot reads nothing: the data kept in /data are used', async (t) => {
  const path = storePath();
  const first = await startApp({ path });
  await first.gladys.fake.shutdown();
  const apis = fakeApis();
  const { gladys } = await startApp({ path, apis, now: NOW + HOUR });
  t.after(() => gladys.fake.shutdown());
  assert.equal(apis.atmoCalls().length, 0);
  assert.equal(apis.calls.length, 0, 'the communes are kept too');
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('the afternoon slot reads again and fires the transitions once', async (t) => {
  const { gladys, app, apis, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  apis.state.rows = usualRows();
  apis.state.rows.index.push(
    indexRow({ date_ech: TOMORROW, code_qual: 4, code_o3: 4, date_maj: '2026/10/16 14:00:00+02' }),
  );
  apis.state.rows.episodes.push(
    episodeRow({ date_ech: TOMORROW, etat: 'ALERTE', date_maj: '2026/10/16 14:00:00+02' }),
  );
  clock.now = Date.parse('2026-10-16T14:10:00Z'); // 16:10 Paris, after the 15:30 slot (+ jitter)
  await app.tick();
  assert.equal(apis.atmoCalls().length, 8);
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => [event.key, event.data.place_name, event.data.level]),
    [
      [TRIGGERS.AIR_QUALITY_DEGRADED, 'Bordeaux', 4],
      [TRIGGERS.POLLUTION_EPISODE, 'Bordeaux', 'alert'],
    ],
  );
  // A tick before the next slot: the states move with the day, no request.
  clock.now += HOUR;
  await app.tick();
  assert.equal(apis.atmoCalls().length, 8);
  assert.equal(gladys.fake.sceneEvents.length, 2);
});

test('the next day: tomorrow becomes today without a request', async (t) => {
  const { gladys, app, apis, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, BORDEAUX);
  clock.now = Date.parse('2026-10-16T14:10:00Z'); // the afternoon reading
  await app.tick();
  assert.equal(apis.atmoCalls().length, 8);
  assert.equal(gladys.fake.lastState(`${BORDEAUX}:index`), 2);
  clock.now = Date.parse('2026-10-16T22:05:00Z'); // 00:05 Paris, the 17th
  await app.tick();
  assert.equal(apis.atmoCalls().length, 8);
  assert.equal(gladys.fake.lastState(`${BORDEAUX}:index`), 3);
});

test('a refused password: status, no retry before the next slot', async (t) => {
  const { gladys, app, apis } = await startApp({ config: { ...CONFIG, password: 'wrong' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(apis.atmoCalls().length, 1);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /refused the user name or the password/);
  assert.equal(new Date(app.getRetryAt()).toISOString().slice(0, 13), '2026-10-16T13');
});

test('a quota answer: Retry-After is respected, then the retry reads', async (t) => {
  const apis = fakeApis();
  apis.state.fail = { status: 429, headers: { 'retry-after': '3600' } };
  const { gladys, app, clock } = await startApp({ apis });
  t.after(() => gladys.fake.shutdown());
  assert.equal(app.getRetryAt(), NOW + HOUR);
  assert.match(gladys.fake.connectionStatus.message.fr, /trop de requêtes.*60 min/);
  apis.state.fail = null;
  clock.now = NOW + HOUR;
  await app.tick();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(app.getRetryAt(), null);
});

test('missing settings and unknown places are reported', async (t) => {
  const { gladys, apis } = await startApp({ config: { house_1: 'home' } });
  t.after(() => gladys.fake.shutdown());
  assert.match(gladys.fake.connectionStatus.message.en, /user name and the password/);
  assert.equal(apis.atmoCalls().length, 0);
  await gladys.fake.configUpdated({
    username: USERNAME,
    password: PASSWORD,
    house_1: 'nowhere',
    commune_2: 'Zzz',
  });
  const message = gladys.fake.connectionStatus.message.fr;
  assert.match(message, /la maison « Nowhere » : la maison n’a pas de position/);
  assert.match(message, /le lieu 2 : « Zzz » ne correspond à aucune commune/);
  assert.equal(gladys.fake.connectionStatus.connected, false);
});

test('a configuration change reads again; pollen off removes its features', async (t) => {
  const { gladys, apis } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.configUpdated({ ...CONFIG, pollen: false });
  assert.equal(apis.atmoCalls().length, 4 + 3);
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === BORDEAUX);
  assert.equal(device.features.length, 10);
});

test('widgets: valid contents, the commune of the settings, messages otherwise', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const key of Object.values(WIDGETS)) {
      for (const settings of [{}, { place: MACON }]) {
        const ack = await gladys.fake.widgetGet(key, { settings, language });
        assert.equal(ack.success, true);
        assert.deepEqual(validateWidgetContent(ack.data.content), [], `${key} ${language}`);
      }
    }
  }
  const macon = await gladys.fake.widgetGet(WIDGETS.FORECAST, {
    settings: { place: MACON },
    language: 'fr',
  });
  assert.equal(macon.data.content.components[0].text, 'Mâcon');
  await gladys.fake.configUpdated({ ...CONFIG, pollen: false });
  const pollen = await gladys.fake.widgetGet(WIDGETS.POLLEN, { language: 'en' });
  assert.match(pollen.data.content.components[0].text, /Pollen is not read/);
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.FORECAST));
});

test('scene action: the air quality of a commune, today or tomorrow', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const today = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, { place: BORDEAUX });
  assert.equal(today.success, true);
  assert.equal(today.data.outputs.level, 2);
  assert.equal(today.data.outputs.label, 'Moyen');
  const tomorrow = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, {
    place: MACON,
    day: 'tomorrow',
  });
  assert.equal(tomorrow.data.outputs.date, TOMORROW);
  assert.equal(tomorrow.data.outputs.level, 2);
  const unknown = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, {
    place: `${PREFIX}:75056`,
  });
  assert.equal(unknown.success, false);
});

test('configuration actions: read now (not twice in 10 minutes), diagnostic without secrets', async (t) => {
  const logs = [];
  const apis = fakeApis();
  const clock = { now: NOW };
  const gladys = createFakeGladys({ config: CONFIG, houses: HOUSES });
  const app = createApp(gladys, {
    fetch: apis,
    storePath: storePath(),
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: { ...silent, info: (line) => logs.push(line) },
  });
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  await app.whenReady();
  const tooSoon = await gladys.fake.action(ACTIONS.REFRESH);
  assert.match(tooSoon.data.message.fr, /une fois par jour/);
  clock.now += REFRESH_MIN_INTERVAL_MS;
  const done = await gladys.fake.action(ACTIONS.REFRESH);
  assert.match(
    done.data.message.en,
    /Data read for Bordeaux, Mâcon\. Today: Bordeaux fair, Mâcon good\./,
  );
  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diagnostic.data.message.en, /Diagnostic written/);
  const lines = logs.filter((line) => line.startsWith('Atmo diagnostic'));
  assert.ok(lines.length >= 1);
  const text = lines.join('');
  assert.ok(!text.includes(PASSWORD) && !text.includes(USERNAME), 'no credentials');
  assert.match(text, /"insee":"33063"/);
});

test('no event is fired by the scene action or a widget', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, { place: BORDEAUX });
  await gladys.fake.widgetGet(WIDGETS.FORECAST, { language: 'en' });
  assert.equal(eventsOf(gladys, TRIGGERS.FORECAST_PUBLISHED).length, 0);
  assert.equal(gladys.fake.sceneEvents.length, 0);
  JSON.parse(
    readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
  );
});
