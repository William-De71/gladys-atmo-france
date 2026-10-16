// A fake Atmo Data API and a fake geo.api.gouv.fr for the tests, served
// through the `fetch` option of the integration. The rows have the shape of
// the real answers (FAQ of the API, answers quoted by the Home Assistant
// integration and the Recosante project): Bordeaux (33063, its own index)
// and Mâcon (71270, published by its EPCI only). Tests never touch the
// network.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 2026-10-16 10:00 in Paris.
const NOW = Date.parse('2026-10-16T08:00:00Z');
const TODAY = '2026-10-16';
const TOMORROW = '2026-10-17';
const TZ = 'Europe/Paris';
const USERNAME = 'me@example.com';
const PASSWORD = 'hunter2';
const TOKEN = 'jwt-1';

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'atmo-')), 'atmo-france.json');

const BORDEAUX = {
  nom: 'Bordeaux',
  code: '33063',
  codesPostaux: ['33000', '33100', '33200', '33300', '33800'],
  codeEpci: '243300316',
  codeDepartement: '33',
  population: 267991,
};
const MACON = {
  nom: 'Mâcon',
  code: '71270',
  codesPostaux: ['71000'],
  codeEpci: '200070308',
  codeDepartement: '71',
  population: 35177,
};
const SANCE = {
  nom: 'Sancé',
  code: '71497',
  codesPostaux: ['71000'],
  codeEpci: '200070308',
  codeDepartement: '71',
  population: 2151,
};

/**
 * @description A row of the index feed (112).
 * @param {object} values - Fields to override.
 * @returns {object} The properties.
 */
const indexRow = (values) => ({
  gml_id: 835197777,
  aasqa: '75',
  partition_field: '752026w42',
  date_maj: '2026/10/15 12:11:49.728+02',
  date_dif: '2026/10/15',
  type_zone: 'commune',
  source: 'Atmo Nouvelle-Aquitaine',
  code_zone: '33063',
  lib_zone: 'Bordeaux',
  date_ech: TODAY,
  code_qual: 2,
  lib_qual: 'Moyen',
  coul_qual: '#50CCAA',
  code_no2: 1,
  code_o3: 2,
  code_pm10: 2,
  code_pm25: 1,
  code_so2: 1,
  ...values,
});

/**
 * @description A row of the episodes feed (114).
 * @param {object} values - Fields to override.
 * @returns {object} The properties.
 */
const episodeRow = (values) => ({
  gml_id: 4169287,
  aasqa: '75',
  date_maj: '2026/10/15 17:00:42.488+02',
  partition_field: '752026w42',
  etat: 'PAS DE DEPASSEMENT',
  lib_zone: 'Gironde',
  lib_pol: 'Ozone',
  date_ech: TODAY,
  date_dif: '2026/10/15',
  code_zone: '33',
  code_pol: '7',
  ...values,
});

/**
 * @description A row of the pollen feed (122).
 * @param {object} values - Fields to override.
 * @returns {object} The properties.
 */
const pollenRow = (values) => ({
  aasqa: '75',
  date_maj: '2026/10/15 13:30:00.000+02',
  alerte: false,
  code_zone: '33063',
  type_zone: 'commune',
  date_dif: '2026/10/15',
  date_ech: TODAY,
  lib_qual: 'Faible',
  lib_zone: 'Bordeaux',
  source: 'Atmo Nouvelle-Aquitaine',
  code_qual: 2,
  pollen_resp: 'GRAMINEE',
  code_ambr: 1,
  code_arm: 1,
  code_aul: 0,
  code_boul: 1,
  code_gram: 2,
  code_oliv: 1,
  ...values,
});

/**
 * @description The rows of a usual day: Bordeaux fair today, moderate
 * tomorrow (ozone), Mâcon through its EPCI, no episode, low pollen.
 * @returns {{ index: object[], episodes: object[], pollen: object[] }} The rows.
 */
const usualRows = () => ({
  index: [
    indexRow({}),
    indexRow({ date_ech: TOMORROW, code_qual: 3, lib_qual: 'Dégradé', code_o3: 3 }),
    indexRow({
      code_zone: '200070308',
      type_zone: 'EPCI',
      lib_zone: 'CA Mâconnais Beaujolais Agglomération',
      source: 'Atmo Bourgogne-Franche-Comté',
      aasqa: '27',
      code_qual: 1,
      code_o3: 1,
      code_pm10: 1,
    }),
    indexRow({
      code_zone: '200070308',
      type_zone: 'EPCI',
      lib_zone: 'CA Mâconnais Beaujolais Agglomération',
      source: 'Atmo Bourgogne-Franche-Comté',
      date_ech: TOMORROW,
      code_qual: 2,
    }),
    // A commune nobody follows.
    indexRow({ code_zone: '33281', lib_zone: 'Mérignac', code_qual: 5 }),
  ],
  episodes: [
    episodeRow({}),
    episodeRow({ lib_pol: 'Dioxyde d’azote', code_pol: '8' }),
    episodeRow({ date_ech: TOMORROW }),
    episodeRow({ code_zone: '71', lib_zone: 'Saône-et-Loire' }),
  ],
  pollen: [
    pollenRow({}),
    pollenRow({ date_ech: TOMORROW, code_qual: 3, lib_qual: 'Modéré', code_gram: 3 }),
  ],
});

/**
 * @description The fake APIs.
 * @param {object} [options] - `{ rows, houses }`.
 * @returns {Function} A fetch function, with `.calls`, `.state`.
 */
function fakeApis({ rows = usualRows() } = {}) {
  const state = {
    rows,
    password: PASSWORD,
    fail: null, // { status, headers, body } for every Atmo Data request
    geoDown: false,
  };
  const calls = [];
  const json = (body, status = 200, headers = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });

  /**
   * @description Rows of a feed matching a filter.
   * @param {object[]} list - The rows.
   * @param {object} filter - The JSON filter.
   * @returns {object[]} The matching rows.
   */
  function filtered(list, filter) {
    return list.filter((row) =>
      Object.entries(filter).every(([field, { operator, value }]) => {
        const actual = String(row[field]);
        if (operator === 'IN') {
          return value.map(String).includes(actual);
        }
        if (operator === '>=') {
          return actual >= value;
        }
        if (operator === '=') {
          return actual === String(value);
        }
        throw new Error(`operator ${operator}`);
      }),
    );
  }

  const fetchFn = async (url, init = {}) => {
    const target = new URL(url);
    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    calls.push({ url: String(url), method: init.method ?? 'GET', headers, body: init.body });
    if (target.hostname === 'geo.api.gouv.fr') {
      if (state.geoDown) {
        return json({ message: 'down' }, 503);
      }
      const all = [BORDEAUX, MACON, SANCE];
      const p = target.searchParams;
      if (target.pathname.startsWith('/communes/')) {
        const code = target.pathname.split('/')[2];
        const found = all.find((c) => c.code === code);
        return found ? json(found) : json({ code: 404, message: 'Not found' }, 404);
      }
      if (p.has('lat')) {
        const lat = Number(p.get('lat'));
        if (lat > 44 && lat < 45.5) {
          return json([BORDEAUX]);
        }
        if (lat > 46 && lat < 46.5) {
          return json([MACON]);
        }
        return json([]);
      }
      if (p.has('codePostal')) {
        return json(all.filter((c) => c.codesPostaux.includes(p.get('codePostal'))));
      }
      if (p.has('nom')) {
        // Like the real API: accents and case do not matter.
        const plain = (text) =>
          text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const wanted = plain(p.get('nom'));
        return json(all.filter((c) => plain(c.nom).includes(wanted.slice(0, 3))));
      }
      return json([]);
    }
    assert(target.hostname === 'admindata.atmo-france.org', `unexpected host ${target.hostname}`);
    if (state.fail) {
      return json(state.fail.body ?? { message: 'fail' }, state.fail.status, state.fail.headers);
    }
    if (target.pathname === '/api/login') {
      const body = JSON.parse(init.body);
      if (body.username !== USERNAME || body.password !== state.password) {
        return json({ code: 401, message: 'Identifiants invalides.' }, 401);
      }
      return json({ token: TOKEN });
    }
    if (headers.authorization !== `Bearer ${TOKEN}`) {
      return json({ code: 401, message: 'JWT Token not found' }, 401);
    }
    const match = /^\/api\/data\/(\d+)\/(.+)$/.exec(target.pathname);
    assert(match, target.pathname);
    assert(target.searchParams.get('withGeom') === 'false', 'withGeom=false');
    const filter = JSON.parse(decodeURIComponent(match[2]));
    const feed = { 112: 'index', 114: 'episodes', 122: 'pollen' }[match[1]];
    return json({
      type: 'FeatureCollection',
      name: `national_data.feed_${match[1]}`,
      features: filtered(state.rows[feed], filter).map((properties) => ({
        type: 'Feature',
        geometry: null,
        properties,
      })),
    });
  };
  fetchFn.calls = calls;
  fetchFn.state = state;
  fetchFn.atmoCalls = () => calls.filter((call) => call.url.includes('admindata'));
  return fetchFn;
}

/**
 * @description A minimal assertion, so this module stays free of node:assert.
 * @param {unknown} ok - The condition.
 * @param {string} message - The message.
 */
function assert(ok, message) {
  if (!ok) {
    throw new Error(message);
  }
}

// What externalIds builds, without a Gladys client.
const fakeGladys = {
  externalIds: (type, id) => {
    const device = `ext:test-integration:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

const HOUSES = [
  { id: 'h1', name: 'Home', selector: 'home', latitude: 44.8378, longitude: -0.5792 },
  { id: 'h2', name: 'Cottage', selector: 'cottage', latitude: 46.3069, longitude: 4.8283 },
  { id: 'h3', name: 'Nowhere', selector: 'nowhere', latitude: null, longitude: null },
];

export {
  NOW,
  TODAY,
  TOMORROW,
  TZ,
  USERNAME,
  PASSWORD,
  TOKEN,
  BORDEAUX,
  MACON,
  HOUSES,
  silent,
  storePath,
  indexRow,
  episodeRow,
  pollenRow,
  usualRows,
  fakeApis,
  fakeGladys,
};
