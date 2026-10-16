import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildForecasts,
  episodeLevel,
  episodePollutant,
  readEpisodes,
  responsibleTaxa,
  mainPollutants,
  usableLevel,
  readLevel,
} from '../src/parse.js';
import { usualRows, indexRow, episodeRow, pollenRow, TODAY, TOMORROW } from './helpers/fixtures.js';

const BORDEAUX = { insee: '33063', epci: '243300316', department: '33', name: 'Bordeaux' };
const MACON = { insee: '71270', epci: '200070308', department: '71', name: 'Mâcon' };

test('levels: 1 to 6 are usable, 0 (unavailable) and 7-8 (event) are not', () => {
  assert.equal(readLevel('3'), 3);
  assert.equal(readLevel(''), null);
  assert.equal(readLevel(12), null);
  assert.deepEqual([0, 1, 6, 7, 8, null].map(usableLevel), [null, 1, 6, null, null, null]);
});

test('the forecast of a commune, its own rows first, else its EPCI', () => {
  const forecasts = buildForecasts([BORDEAUX, MACON], usualRows());
  const bordeaux = forecasts['33063'].dates;
  assert.deepEqual(Object.keys(bordeaux), [TODAY, TOMORROW]);
  assert.equal(bordeaux[TODAY].index.level, 2);
  assert.equal(bordeaux[TODAY].index.zone, 'commune');
  assert.deepEqual(bordeaux[TODAY].index.pollutants, { no2: 1, o3: 2, pm10: 2, pm25: 1, so2: 1 });
  assert.equal(bordeaux[TODAY].index.source, 'Atmo Nouvelle-Aquitaine');
  assert.equal(new Date(bordeaux[TODAY].index.updatedAt).toISOString(), '2026-10-15T10:11:49.000Z');
  assert.equal(bordeaux[TOMORROW].index.level, 3);
  assert.deepEqual(bordeaux[TODAY].episode, { level: 0, pollutants: [], name: 'Gironde' });
  assert.equal(bordeaux[TODAY].pollen.level, 2);
  assert.deepEqual(bordeaux[TODAY].pollen.responsible, ['gram']);
  const macon = forecasts['71270'].dates;
  assert.equal(macon[TODAY].index.zone, 'epci');
  assert.equal(macon[TODAY].index.level, 1);
  assert.equal(macon[TODAY].pollen, null, 'no pollen row for Mâcon');
});

test('the latest update of a zone and date wins', () => {
  const rows = {
    index: [
      indexRow({ code_qual: 4, date_maj: '2026/10/15 18:00:00+02' }),
      indexRow({ code_qual: 2, date_maj: '2026/10/15 12:00:00+02' }),
    ],
    episodes: [],
    pollen: null,
  };
  assert.equal(buildForecasts([BORDEAUX], rows)['33063'].dates[TODAY].index.level, 4);
});

test('episodes: the highest procedure of the day, with its pollutants', () => {
  assert.deepEqual(
    [
      'PAS DE DEPASSEMENT',
      'INFORMATION ET RECOMMANDATION',
      'ALERTE SUR PERSISTANCE',
      'ALERTE',
      'Alerte',
    ].map(episodeLevel),
    [0, 1, 2, 3, 3],
  );
  assert.equal(episodePollutant({ code_pol: '6001' }), 'pm25');
  assert.equal(episodePollutant({ lib_pol: 'Particules fines, diamètre < 10 µm' }), 'pm10');
  assert.equal(episodePollutant({ lib_pol: 'PM2.5' }), 'pm25');
  assert.equal(episodePollutant({ lib_pol: "Dioxyde d'azote" }), 'no2');
  const map = readEpisodes([
    episodeRow({}),
    episodeRow({ etat: 'INFORMATION ET RECOMMANDATION', lib_pol: 'PM10', code_pol: '5' }),
    episodeRow({ etat: 'INFORMATION ET RECOMMANDATION', lib_pol: 'Ozone', code_pol: '7' }),
    episodeRow({ etat: 'ALERTE', date_ech: TOMORROW }),
  ]);
  assert.deepEqual(map.get(`33|${TODAY}`), {
    level: 1,
    pollutants: ['o3', 'pm10'],
    name: 'Gironde',
  });
  assert.deepEqual(map.get(`33|${TOMORROW}`), { level: 3, pollutants: ['o3'], name: 'Gironde' });
});

test('the main pollen and the main pollutants', () => {
  assert.deepEqual(responsibleTaxa(pollenRow({ pollen_resp: 'BOULEAU GRAMINEE' }), 3), [
    'boul',
    'gram',
  ]);
  assert.deepEqual(responsibleTaxa(pollenRow({ pollen_resp: '', code_aul: 3 }), 3), ['aul']);
  assert.deepEqual(responsibleTaxa(pollenRow({ pollen_resp: null }), 0), []);
  assert.deepEqual(
    mainPollutants({ level: 3, pollutants: { no2: 1, o3: 3, pm10: 3, pm25: 2, so2: 1 } }),
    ['o3', 'pm10'],
  );
  assert.deepEqual(mainPollutants({ level: 1, pollutants: { no2: 1 } }), [], 'good: no culprit');
  assert.deepEqual(mainPollutants(null), []);
});
