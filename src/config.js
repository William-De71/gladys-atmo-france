// -----------------------------------------------------------------------------
// Configuration of the Atmo France integration.
//
// Fields of the config_schema:
//   - `username`         the Atmo Data account (free, validated by Atmo France);
//   - `password`         its password (a `secret`: never sent back to the UI,
//                        never logged, never put in an URL);
//   - `house_<n>`        a house of Gladys (`source: "houses"`, its selector):
//                        its coordinates give the commune;
//   - `commune_<n>`      or a commune typed by hand: its name, its postal code,
//                        "name (postal code)" or its INSEE code. It wins over
//                        the house when both are set;
//   - `pollen`           also read the pollen allergy risk;
//   - `language`         language of the texts Gladys does not ask for in a
//                        language (feature names, scene summaries): `auto`
//                        follows the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`    language of the last widget request, kept for the
//                        texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const MAX_PLACES = 3;
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Read a boolean field (the form can send strings).
 * @param {unknown} raw - The raw value.
 * @param {boolean} fallback - The default.
 * @returns {boolean} The value.
 */
function readBoolean(raw, fallback) {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw === 'true' || raw === '1' || raw === 1) {
    return true;
  }
  if (raw === 'false' || raw === '0' || raw === 0) {
    return false;
  }
  return fallback;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ username, password, places: [{ slot, house, commune }],
 * pollen, language }`; a slot without a house nor a commune is left out.
 * @example
 * normalizeConfig({ username: 'me', password: 'p', commune_1: 'Mâcon' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const places = [];
  for (let slot = 1; slot <= MAX_PLACES; slot += 1) {
    const house = readString(config[`house_${slot}`]) || null;
    const commune = readString(config[`commune_${slot}`]) || null;
    if (house || commune) {
      places.push({ slot, house, commune });
    }
  }
  return {
    username: readString(config.username),
    // A secret is kept as typed.
    password: typeof config.password === 'string' ? config.password : '',
    places,
    pollen: readBoolean(config.pollen, true),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Whether the Atmo Data API can be called.
 * @param {object} config - A normalized config.
 * @returns {boolean} True with a user name and a password.
 */
const hasCredentials = (config) => Boolean(config.username && config.password);

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_PLACES,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  hasCredentials,
  readLanguage,
  readBoolean,
};
