// Every widget content through validateWidgetContent (the checks of the core,
// which only run in debug mode in production) and the content budget of a
// card, in the four languages and in the edge cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildForecastWidget,
  buildPollenWidget,
  messageContent,
  readWidgetSettings,
  levelColor,
  episodeColor,
} from '../src/widgets.js';
import { buildForecasts } from '../src/parse.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  usualRows,
  episodeRow,
  pollenRow,
  indexRow,
  TODAY,
  TOMORROW,
  TZ,
} from './helpers/fixtures.js';

const types = (content) => content.components.map((component) => component.type);
const COMMUNE = { insee: '33063', epci: '243300316', department: '33', name: 'Bordeaux' };

/**
 * @description Assert a content is valid and within the budget of a card.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
  const count = (list) => types(content).filter((type) => list.includes(type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(count(['status']) <= 1, label);
  assert.ok(count(['button']) <= 4, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
  for (const component of content.components) {
    if (component.type === 'value') {
      assert.ok(String(component.value).length <= 12, `${label}: ${component.value}`);
      assert.ok(component.label.length <= 24, `${label}: ${component.label}`);
    }
    for (const item of component.items ?? []) {
      if (component.type === 'status') {
        assert.ok(item.value, `${label}: a status row without value is dropped`);
        assert.ok(item.label.length <= 40 && String(item.value).length <= 40, label);
      }
      if (item.badge) {
        assert.ok(item.badge.text.length <= 16, `${label}: ${item.badge.text}`);
      }
    }
  }
}

/**
 * @description The days of a set of rows.
 * @param {object} rows - The rows.
 * @returns {{ today: object|null, tomorrow: object|null }} The days.
 */
function days(rows) {
  const dates = buildForecasts([COMMUNE], rows)['33063'].dates;
  return { today: dates[TODAY] ?? null, tomorrow: dates[TOMORROW] ?? null };
}

const forecast = (rows, language, pollen = true) =>
  buildForecastWidget({
    commune: COMMUNE,
    ...days(rows),
    todayDate: TODAY,
    tomorrowDate: TOMORROW,
    pollen,
    language,
    timeZone: TZ,
  });

test('forecast: heading, five sub-indices, a card per day, the status list', () => {
  for (const language of LANGUAGES) {
    const content = forecast(usualRows(), language);
    assertValid(content, `forecast ${language}`);
    assert.deepEqual(types(content), [
      'text',
      'value',
      'value',
      'value',
      'value',
      'value',
      'card-list',
      'status',
    ]);
  }
  const content = forecast(usualRows(), 'fr');
  const list = content.components.find((c) => c.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.date, item.badge.text, item.badge.color]),
    [
      ['Aujourd’hui : Moyen', `${TODAY}T00:00:00.000Z`, 'ATMO 2', 'success'],
      ['Demain : Dégradé', `${TOMORROW}T00:00:00.000Z`, 'ATMO 3', 'warning'],
    ],
  );
  assert.match(list.items[0].description, /Sous-indices : NO₂ bon, O₃ moyen/);
  const status = content.components.find((c) => c.type === 'status').items;
  assert.deepEqual(
    status.map((item) => item.label),
    ['Épisode aujourd’hui', 'Épisode demain', 'Pollens aujourd’hui', 'Source', 'Mise à jour'],
  );
  assert.equal(status[2].value, 'Faible · Graminées');
  assert.equal(status[3].value, 'Atmo Nouvelle-Aquitaine');
  assert.equal(status[4].value, '15/10 12:11');
});

test('forecast: an alert, an extremely poor day, nothing for tomorrow yet', () => {
  const rows = {
    index: [indexRow({ code_qual: 6, code_pm10: 6, code_pm25: 6 })],
    episodes: [episodeRow({ etat: 'ALERTE SUR PERSISTANCE', lib_pol: 'PM10', code_pol: '5' })],
    pollen: [],
  };
  for (const language of LANGUAGES) {
    const content = forecast(rows, language);
    assertValid(content, `alert ${language}`);
    const list = content.components.find((c) => c.type === 'card-list');
    assert.equal(list.items[1].badge, undefined, 'no badge for an unknown day');
    const status = content.components.find((c) => c.type === 'status').items;
    assert.equal(status[0].color, 'danger');
    assert.equal(status[1].color, 'neutral');
  }
  const content = forecast(rows, 'fr', false);
  const status = content.components.find((c) => c.type === 'status').items;
  assert.equal(status[0].value, 'Alerte persistance (PM10)');
});

test('pollen: two tiles, the taxa as cards, the main pollen', () => {
  const rows = usualRows();
  rows.pollen.push(
    pollenRow({
      date_ech: TODAY,
      code_qual: 6,
      code_boul: 6,
      pollen_resp: 'BOULEAU',
      date_maj: '2026/10/15 20:00:00+02',
    }),
  );
  for (const language of LANGUAGES) {
    const content = buildPollenWidget({ commune: COMMUNE, ...days(rows), language, timeZone: TZ });
    assertValid(content, `pollen ${language}`);
    assert.deepEqual(types(content), ['text', 'value', 'value', 'card-list', 'status']);
  }
  const content = buildPollenWidget({
    commune: COMMUNE,
    ...days(rows),
    language: 'fr',
    timeZone: TZ,
  });
  assert.equal(content.components[1].value, 'Extrême');
  const list = content.components[3].items;
  assert.deepEqual(list[0], { title: 'Bouleau', badge: { text: 'Extrême', color: 'danger' } });
  const empty = buildPollenWidget({
    commune: COMMUNE,
    today: null,
    tomorrow: null,
    language: 'en',
    timeZone: TZ,
  });
  assertValid(empty, 'pollen empty');
  assert.deepEqual(types(empty), ['text', 'value', 'value', 'text']);
});

test('messages, settings and colors', () => {
  assertValid(messageContent('x'.repeat(400)), 'message');
  assert.deepEqual(readWidgetSettings({ place: 'ext:a:commune:33063' }), {
    place: 'ext:a:commune:33063',
  });
  assert.deepEqual(readWidgetSettings(undefined), { place: null });
  assert.deepEqual([null, 1, 2, 3, 4, 6, 8].map(levelColor), [
    'neutral',
    'success',
    'success',
    'warning',
    'danger',
    'danger',
    'neutral',
  ]);
  assert.deepEqual([null, 0, 1, 2, 3].map(episodeColor), [
    'neutral',
    'success',
    'warning',
    'danger',
    'danger',
  ]);
});
