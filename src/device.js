// -----------------------------------------------------------------------------
// One Gladys device per commune: "Air quality Bordeaux".
//
// External ids: `ext:<selector>:commune:<INSEE code>` and
// `…:commune:<INSEE code>:<feature key>` (lower case: Corsica is 2a…). The
// INSEE code is the official,
// stable identifier of the commune: never its name.
//
// Features (category / type, chosen from the SDK constants):
//   - ATMO index today and tomorrow, and the five sub-indices of today
//     (NO₂, O₃, PM10, PM2.5, SO₂): `airquality-sensor` / `aqi`, 1 (good) to
//     6 (extremely poor). They are levels, not concentrations: the
//     `pm25-sensor`, `no2-sensor`… categories hold µg/m³ and would be wrong;
//   - the air quality today as text ("Moyen"), in the configured language;
//   - the pollution episode of the department today and tomorrow: `risk` /
//     `integer`, 0 none, 1 information and advice, 2 alert on persistence,
//     3 alert (Gladys shows them as no / low / medium / high risk);
//   - with pollen on: the pollen index today and tomorrow, its six main
//     taxa today (`airquality-sensor` / `aqi`, 1 to 6) and the main pollen
//     as text.
//
// No state is published for an unavailable level (0) or a special event (7,
// 8): a scene comparing "index ≥ 4" must not see a fake value.
// `should_poll` stays false: the data are read on the integration's own timer.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

import { t, atmoLabel, joinList } from './i18n.js';
import { POLLUTANTS, TAXA, usableLevel } from './parse.js';

const DEVICE_TYPE = 'commune';
const MODEL = 'Atmo France';

const aqi = {
  category: CATEGORIES.AIRQUALITY_SENSOR,
  type: TYPES.AIRQUALITY_SENSOR.AQI,
  unit: UNITS.AQI,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 1,
  max: 6,
};
const risk = {
  category: CATEGORIES.RISK,
  type: TYPES.RISK.INTEGER,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: 3,
};
const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
};

// The features: key (eternal), name (TEXTS key and values), shape, and the
// state of a commune's `{ today, tomorrow }` days (null: nothing to publish).
const FEATURES = [
  {
    key: 'index',
    name: ['feature_index'],
    shape: aqi,
    state: ({ today }) => usableLevel(today?.index?.level ?? null),
  },
  {
    key: 'index_tomorrow',
    name: ['feature_index_tomorrow'],
    shape: aqi,
    state: ({ tomorrow }) => usableLevel(tomorrow?.index?.level ?? null),
  },
  {
    key: 'quality',
    name: ['feature_quality'],
    shape: text,
    state: ({ today }, language) =>
      today?.index?.level !== null && today?.index?.level !== undefined && today.index.level > 0
        ? { text: atmoLabel(today.index.level, language) }
        : null,
  },
  ...POLLUTANTS.map((pollutant) => ({
    key: pollutant,
    name: [
      'feature_pollutant',
      (language) => ({ pollutant: t(`pollutant_${pollutant}`, language) }),
    ],
    shape: aqi,
    state: ({ today }) => usableLevel(today?.index?.pollutants?.[pollutant] ?? null),
  })),
  {
    key: 'episode',
    name: ['feature_episode'],
    shape: risk,
    // No episode row for a known index: no episode.
    state: ({ today }) => today?.episode?.level ?? (today?.index ? 0 : null),
  },
  {
    key: 'episode_tomorrow',
    name: ['feature_episode_tomorrow'],
    shape: risk,
    state: ({ tomorrow }) => tomorrow?.episode?.level ?? (tomorrow?.index ? 0 : null),
  },
];

const POLLEN_FEATURES = [
  {
    key: 'pollen',
    name: ['feature_pollen'],
    shape: aqi,
    state: ({ today }) => usableLevel(today?.pollen?.level ?? null),
  },
  {
    key: 'pollen_tomorrow',
    name: ['feature_pollen_tomorrow'],
    shape: aqi,
    state: ({ tomorrow }) => usableLevel(tomorrow?.pollen?.level ?? null),
  },
  {
    key: 'pollen_taxa',
    name: ['feature_pollen_taxa'],
    shape: text,
    state: ({ today }, language) => {
      if (!today?.pollen || !usableLevel(today.pollen.level)) {
        return null;
      }
      const list = today.pollen.responsible.map((taxon) => t(`taxon_${taxon}`, language));
      return { text: list.length ? joinList(list, language) : '-' };
    },
  },
  ...TAXA.map((taxon) => ({
    key: `pollen_${taxon}`,
    name: ['feature_taxon', (language) => ({ taxon: t(`taxon_${taxon}`, language) })],
    shape: aqi,
    state: ({ today }) => usableLevel(today?.pollen?.taxa?.[taxon] ?? null),
  })),
];

/**
 * @description The feature specs of a device.
 * @param {boolean} pollen - Whether pollen is read.
 * @returns {object[]} The specs.
 */
const specsOf = (pollen) => (pollen ? [...FEATURES, ...POLLEN_FEATURES] : FEATURES);

/**
 * @description The ids of a commune device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} insee - The INSEE code.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, insee) => gladys.externalIds(DEVICE_TYPE, String(insee).toLowerCase());

/**
 * @description The INSEE code a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {string|null} The code.
 * @example
 * inseeOf('ext:atmo:commune:33063:index'); // -> '33063'
 */
function inseeOf(externalId) {
  const match = /:commune:([0-9][0-9ab][0-9]{3})(?::[a-z0-9_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1].toUpperCase() : null;
}

/**
 * @description The name of a feature.
 * @param {object} spec - The spec.
 * @param {string} language - The language.
 * @returns {string} The name.
 */
function featureName(spec, language) {
  const [key, values] = spec.name;
  return t(key, language, typeof values === 'function' ? values(language) : {});
}

/**
 * @description The device of a commune.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} commune - `{ insee, name, department, epci }`.
 * @param {object} options - `{ pollen, language }`.
 * @returns {object} The discovered device.
 */
function buildDevice(gladys, commune, { pollen, language = 'en' }) {
  const ids = idsOf(gladys, commune.insee);
  return {
    name: t('deviceName', language, { commune: commune.name }),
    external_id: ids.device,
    model: MODEL,
    should_poll: false,
    params: [
      { name: 'INSEE', value: commune.insee },
      ...(commune.department ? [{ name: 'DEPARTMENT', value: commune.department }] : []),
      ...(commune.epci ? [{ name: 'EPCI', value: commune.epci }] : []),
    ],
    features: specsOf(pollen).map((spec) => ({
      name: featureName(spec, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a commune device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} insee - The INSEE code.
 * @param {object} days - `{ today, tomorrow }` (the days of the forecast, or null).
 * @param {object} options - `{ pollen, language }`.
 * @returns {object[]} The states.
 */
function buildStates(gladys, insee, days, { pollen, language = 'en' }) {
  const ids = idsOf(gladys, insee);
  return specsOf(pollen).flatMap((spec) => {
    const value = spec.state(days, language);
    if (value === null || value === undefined) {
      return [];
    }
    const id = ids.feature(spec.key);
    return [
      typeof value === 'object'
        ? { device_feature_external_id: id, text: value.text }
        : { device_feature_external_id: id, state: value },
    ];
  });
}

export {
  DEVICE_TYPE,
  FEATURES,
  POLLEN_FEATURES,
  specsOf,
  idsOf,
  inseeOf,
  buildDevice,
  buildStates,
};
