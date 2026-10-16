import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  detectEvents,
  forecastData,
  actionOutputs,
  TRIGGERS,
  ACTION_OUTPUTS,
} from '../src/events.js';
import { buildForecasts } from '../src/parse.js';
import { usualRows, indexRow, episodeRow, TODAY, TOMORROW } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const BORDEAUX = {
  insee: '33063',
  epci: '243300316',
  department: '33',
  name: 'Bordeaux',
  deviceId: 'ext:test-integration:commune:33063',
};
const run = (rows, seen) =>
  detectEvents({
    communes: [BORDEAUX],
    forecasts: buildForecasts([BORDEAUX], rows),
    seen,
    today: TODAY,
    language: 'fr',
  });

/**
 * @description Check an event payload against the limits of the core and its declaration.
 * @param {object} event - `{ key, data }`.
 */
function checkPayload({ key, data }) {
  const declaration = manifest.scene_triggers.find((trigger) => trigger.key === key);
  assert.ok(declaration, key);
  const entries = Object.entries(data);
  assert.ok(entries.length <= 30, key);
  for (const [name, value] of entries) {
    assert.ok(
      value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.length <= 1000),
      `${key}.${name}`,
    );
  }
  for (const variable of declaration.variables) {
    assert.ok(variable.key in data, `${key}: variable ${variable.key} missing`);
  }
  for (const field of declaration.fields) {
    assert.ok(field.key in data, `${key}: filter ${field.key} missing`);
    if (field.options) {
      const values = field.options.map((option) => option.value);
      assert.ok(
        values.includes(String(data[field.key])),
        `${key}.${field.key}: ${data[field.key]}`,
      );
    }
  }
}

test('the first reading of a commune is a baseline: no event', () => {
  const { events, seen } = run(usualRows(), {});
  assert.deepEqual(events, []);
  assert.deepEqual(seen['33063'][TOMORROW], { index: 3, episode: 0, pollen: 3, forecast: true });
});

test('tomorrow degraded, an episode, a pollen alert and the forecast: one event each', () => {
  const { seen } = run({ index: [indexRow({})], episodes: [], pollen: [] }, {});
  const rows = usualRows();
  rows.episodes.push(
    episodeRow({
      date_ech: TOMORROW,
      etat: 'INFORMATION ET RECOMMANDATION',
      lib_pol: 'Ozone',
      code_pol: '7',
    }),
  );
  const { events, seen: after } = run(rows, seen);
  assert.deepEqual(
    events.map((event) => [event.key, event.data.day]),
    [
      [TRIGGERS.AIR_QUALITY_DEGRADED, 'tomorrow'],
      [TRIGGERS.POLLUTION_EPISODE, 'tomorrow'],
      [TRIGGERS.POLLEN_ALERT, 'tomorrow'],
      [TRIGGERS.FORECAST_PUBLISHED, 'tomorrow'],
    ],
  );
  events.forEach(checkPayload);
  const degraded = events[0].data;
  assert.equal(degraded.place, BORDEAUX.deviceId);
  assert.equal(degraded.level, 3);
  assert.equal(degraded.label, 'Dégradé');
  assert.equal(degraded.pollutants, 'O₃');
  assert.equal(
    degraded.summary,
    'Qualité de l’air demain à Bordeaux : dégradé (ATMO 3/6), à cause de : O₃.',
  );
  assert.equal(events[1].data.level, 'information');
  assert.equal(events[1].data.department, 'Gironde');
  assert.equal(events[2].data.taxa, 'Graminées');
  assert.match(
    events[3].data.summary,
    /dégradé .*Épisode de pollution demain \(Gironde\) .*Pollens demain/,
  );
  // The same data again (the morning reading, a restart): nothing.
  assert.deepEqual(run(rows, after).events, []);
});

test('an index that worsens again fires again; one that improves does not', () => {
  const { seen } = run({ index: [indexRow({ code_qual: 3 })], episodes: [], pollen: [] }, {});
  const worse = run(
    { index: [indexRow({ code_qual: 5, code_pm10: 5 })], episodes: [], pollen: [] },
    seen,
  );
  assert.deepEqual(
    worse.events.map((e) => [e.key, e.data.level, e.data.pollutants]),
    [[TRIGGERS.AIR_QUALITY_DEGRADED, 5, 'PM10']],
  );
  const better = run({ index: [indexRow({ code_qual: 2 })], episodes: [], pollen: [] }, worse.seen);
  assert.deepEqual(better.events, []);
});

test('old dates are forgotten', () => {
  const { seen } = run(usualRows(), {
    33063: { '2026-10-01': { index: 1, episode: 0, pollen: 0, forecast: true } },
  });
  assert.deepEqual(Object.keys(seen['33063']).sort(), [TODAY, TOMORROW]);
});

test('the outputs of the scene action are the declared ones, scalars', () => {
  const dates = buildForecasts([BORDEAUX], usualRows())['33063'].dates;
  const outputs = actionOutputs(
    forecastData(
      {
        commune: BORDEAUX,
        deviceId: BORDEAUX.deviceId,
        date: TODAY,
        entry: dates[TODAY],
        day: 'today',
      },
      'en',
    ),
  );
  const declared = manifest.scene_actions
    .find((a) => a.key === 'get_air_quality')
    .outputs.map((o) => o.key);
  assert.deepEqual(Object.keys(outputs), declared);
  assert.deepEqual(ACTION_OUTPUTS, declared);
  assert.equal(outputs.level, 2);
  assert.equal(outputs.label, 'Fair');
  assert.equal(outputs.pollutants, 'O₃ and PM10');
  assert.equal(outputs.episode_level, 0);
  assert.equal(outputs.pollen_taxa, 'Grasses');
  assert.equal(
    outputs.summary,
    'Air quality today in Bordeaux: fair (ATMO 2/6), because of O₃ and PM10. Pollen today in Bordeaux: low (2/6), mostly Grasses.',
  );
  const unknown = actionOutputs(
    forecastData({ commune: BORDEAUX, date: TOMORROW, entry: null, day: 'tomorrow' }, 'de'),
  );
  assert.equal(unknown.level, null);
  assert.equal(unknown.summary, 'Luftqualität morgen in Bordeaux: noch nicht veröffentlicht.');
});
