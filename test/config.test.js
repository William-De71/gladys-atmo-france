import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, hasCredentials, readLanguage, MAX_PLACES } from '../src/config.js';

test('the places keep their slot; an empty slot is left out', () => {
  const config = normalizeConfig({
    username: ' me ',
    password: ' p ',
    house_1: 'home',
    commune_2: '',
    commune_3: ' Mâcon 71000 ',
  });
  assert.equal(config.username, 'me');
  assert.equal(config.password, ' p ', 'a secret is kept as typed');
  assert.deepEqual(config.places, [
    { slot: 1, house: 'home', commune: null },
    { slot: 3, house: null, commune: 'Mâcon 71000' },
  ]);
  assert.equal(MAX_PLACES, 3);
});

test('defaults: pollen on, automatic language, no credentials', () => {
  const config = normalizeConfig();
  assert.equal(config.pollen, true);
  assert.equal(config.language, 'auto');
  assert.equal(hasCredentials(config), false);
  assert.equal(normalizeConfig({ pollen: 'false' }).pollen, false);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'auto');
  assert.equal(normalizeConfig({ language: 'de' }).language, 'de');
});

test('the language of the last widget request is read back', () => {
  assert.equal(readLanguage({ last_language: 'es' }, 'fr'), 'es');
  assert.equal(readLanguage({ last_language: 'nope!' }, 'fr'), 'fr');
});
