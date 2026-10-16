// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import { buildDevice, buildStates, inseeOf, idsOf } from '../src/device.js';
import { buildForecasts } from '../src/parse.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, usualRows, TODAY, TOMORROW } from './helpers/fixtures.js';

const BORDEAUX = { insee: '33063', name: 'Bordeaux', epci: '243300316', department: '33' };
const AJACCIO = { insee: '2A004', name: 'Ajaccio', epci: '242010056', department: '2A' };

const devices = (language, pollen = true) => [
  buildDevice(fakeGladys, BORDEAUX, { pollen, language }),
  buildDevice(fakeGladys, AJACCIO, { pollen, language }),
];

// DEVICE_FEATURE_UNITS_BY_CATEGORY of the Gladys core (server/utils/constants.js, v5.2.1).
const UNITS = { 'airquality-sensor': [DEVICE_FEATURE_UNITS.AQI] };
// Pairs with an icon in the Gladys front (front/src/utils/consts.js) and a
// badge color (BadgeNumberDeviceValue.jsx).
const PAIRS = [
  [DEVICE_FEATURE_CATEGORIES.AIRQUALITY_SENSOR, DEVICE_FEATURE_TYPES.AIRQUALITY_SENSOR.AQI],
  [DEVICE_FEATURE_CATEGORIES.RISK, DEVICE_FEATURE_TYPES.RISK.INTEGER],
  [DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name.length > 0 && feature.name.length <= 255);
      }
    }
  }
});

test('category / type pairs and units known to the Gladys front', () => {
  for (const feature of devices('en').flatMap((device) => device.features)) {
    assert.ok(
      PAIRS.some(([category, type]) => feature.category === category && feature.type === type),
      `${feature.external_id}: ${feature.category}/${feature.type}`,
    );
    if (UNITS[feature.category]) {
      assert.ok(UNITS[feature.category].includes(feature.unit), feature.external_id);
    }
  }
  // The sub-indices are levels, never concentrations (pm25-sensor holds µg/m³).
  const categories = new Set(devices('en').flatMap((d) => d.features.map((f) => f.category)));
  for (const forbidden of ['pm25-sensor', 'pm10-sensor', 'no2-sensor', 'o3-sensor', 'so2-sensor']) {
    assert.ok(!categories.has(forbidden), forbidden);
  }
});

test('ids from the INSEE code (lower case), read back; pollen adds 9 features', () => {
  const [bordeaux, ajaccio] = devices('fr');
  assert.equal(bordeaux.external_id, 'ext:test-integration:commune:33063');
  assert.equal(ajaccio.external_id, 'ext:test-integration:commune:2a004');
  assert.equal(inseeOf('ext:test-integration:commune:2a004:pm25'), '2A004');
  assert.equal(inseeOf('ext:test-integration:commune:33063'), '33063');
  assert.equal(inseeOf('something else'), null);
  assert.equal(bordeaux.name, 'Qualité de l’air Bordeaux');
  assert.equal(bordeaux.features.length, 19);
  assert.equal(devices('fr', false)[0].features.length, 10);
  const names = new Set(bordeaux.features.map((feature) => feature.name));
  assert.equal(names.size, bordeaux.features.length, 'every feature has its own name');
});

test('states: levels 1 to 6, nothing for an unavailable level or an event', () => {
  const forecasts = buildForecasts([BORDEAUX], usualRows());
  const dates = forecasts['33063'].dates;
  const states = buildStates(
    fakeGladys,
    '33063',
    { today: dates[TODAY], tomorrow: dates[TOMORROW] },
    { pollen: true, language: 'fr' },
  );
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
  );
  assert.deepEqual(byKey, {
    index: 2,
    index_tomorrow: 3,
    quality: 'Moyen',
    no2: 1,
    o3: 2,
    pm10: 2,
    pm25: 1,
    so2: 1,
    episode: 0,
    episode_tomorrow: 0,
    pollen: 2,
    pollen_tomorrow: 3,
    pollen_taxa: 'Graminées',
    pollen_ambr: 1,
    pollen_arm: 1,
    pollen_boul: 1,
    pollen_gram: 2,
    pollen_oliv: 1,
  });
  const event = {
    today: { index: { level: 8, pollutants: {} }, episode: null, pollen: null },
    tomorrow: null,
  };
  const eventStates = buildStates(fakeGladys, '33063', event, { pollen: true, language: 'en' });
  assert.deepEqual(
    eventStates.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
    [
      ['quality', 'Special event'],
      ['episode', 0],
    ],
  );
  assert.deepEqual(
    buildStates(fakeGladys, '33063', { today: null, tomorrow: null }, { pollen: true }),
    [],
  );
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices(devices(language));
  }
  const device = gladys.fake.discoveredDevices[0];
  await gladys.fake.deviceCreated(device);
  const dates = buildForecasts([BORDEAUX], usualRows())['33063'].dates;
  await gladys.publishStates(
    buildStates(
      gladys,
      '33063',
      { today: dates[TODAY], tomorrow: dates[TOMORROW] },
      { pollen: true },
    ),
  );
  assert.equal(idsOf(gladys, '33063').device, device.external_id);
});
