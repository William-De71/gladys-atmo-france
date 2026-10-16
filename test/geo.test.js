import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGeoClient, splitQuery, fold, GeoError } from '../src/geo.js';
import { fakeApis } from './helpers/fixtures.js';

test('what the user types is split into a name and a code', () => {
  assert.deepEqual(splitQuery('Sancé (71000)'), { name: 'Sancé', code: '71000' });
  assert.deepEqual(splitQuery('Saint-Denis 93200'), { name: 'Saint-Denis', code: '93200' });
  assert.deepEqual(splitQuery('71270'), { name: '', code: '71270' });
  assert.deepEqual(splitQuery('2a004'), { name: '', code: '2A004' });
  assert.deepEqual(splitQuery('Mâcon'), { name: 'Mâcon', code: null });
  assert.equal(fold('Saint-Étienne'), 'saint etienne');
});

test('a commune by coordinates, postal code, name or INSEE code', async () => {
  const geo = createGeoClient({ fetch: fakeApis() });
  assert.equal((await geo.byCoordinates(44.84, -0.58)).insee, '33063');
  // A postal code shared by several communes: the most populated one…
  assert.equal((await geo.byQuery('71000')).name, 'Mâcon');
  // …unless the name says otherwise.
  assert.equal((await geo.byQuery('Sancé 71000')).insee, '71497');
  assert.deepEqual(await geo.byQuery('macon'), {
    insee: '71270',
    name: 'Mâcon',
    epci: '200070308',
    department: '71',
    population: 35177,
  });
  // Not a postal code: an INSEE code.
  assert.equal((await geo.byQuery('33063')).name, 'Bordeaux');
});

test('nothing found, outside France, service down', async () => {
  const fake = fakeApis();
  const geo = createGeoClient({ fetch: fake });
  await assert.rejects(
    geo.byQuery('Zzz'),
    (err) => err instanceof GeoError && err.kind === 'not_found',
  );
  await assert.rejects(geo.byQuery('99999'), { kind: 'not_found' });
  await assert.rejects(geo.byCoordinates(51.5, -0.12), { kind: 'outside' });
  fake.state.geoDown = true;
  await assert.rejects(geo.byQuery('Mâcon'), { kind: 'unreachable' });
});
