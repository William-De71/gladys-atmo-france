// -----------------------------------------------------------------------------
// Rows of the Atmo Data feeds -> one forecast per commune and per date.
//
// Shapes (FAQ of the API, answers quoted by the Home Assistant integration
// and the Recosante project of the French government):
//   112 index   { code_zone, type_zone, lib_zone, date_ech 'YYYY-MM-DD',
//                 date_maj '2026/10/16 12:11:49.728+02', source, code_qual,
//                 code_no2, code_o3, code_pm10, code_pm25, code_so2 }
//                 levels 1 (good) to 6 (extremely poor), 0 unavailable,
//                 7 or 8 a special event (a fire, …);
//   114 episode { code_zone (department), lib_zone, date_ech, date_maj, etat
//                 'PAS DE DEPASSEMENT' | 'INFORMATION ET RECOMMANDATION' |
//                 'ALERTE SUR PERSISTANCE' | 'ALERTE', code_pol, lib_pol },
//                 one row per pollutant and date;
//   122 pollen  { code_zone, lib_zone, date_ech, date_maj, source, code_qual
//                 (0-6), pollen_resp 'GRAMINEE', code_ambr, code_arm,
//                 code_aul, code_boul, code_gram, code_oliv, … }.
//
// A commune without its own row takes the one of its EPCI (the AASQA of some
// regions publish per intercommunality only). Unknown is null, never 0.
// -----------------------------------------------------------------------------

import { parseApiDate } from './time.js';
import { fold } from './geo.js';

const POLLUTANTS = ['no2', 'o3', 'pm10', 'pm25', 'so2'];
const TAXA = ['ambr', 'arm', 'aul', 'boul', 'gram', 'oliv'];
// Episode levels: 0 none, 1 information and advice, 2 alert on persistence,
// 3 alert (the `risk` scale of Gladys: no, low, medium, high risk).
const EPISODE_LEVELS = { NONE: 0, INFORMATION: 1, PERSISTENCE: 2, ALERT: 3 };
// European pollutant codes of the episodes feed.
const POLLUTANT_CODES = { 1: 'so2', 5: 'pm10', 7: 'o3', 8: 'no2', 6001: 'pm25' };

/**
 * @description Read a level of the API.
 * @param {unknown} value - A number or a numeric string.
 * @returns {number|null} The integer level, null when absent.
 */
function readLevel(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const level = Number(value);
  return Number.isInteger(level) && level >= 0 && level <= 8 ? level : null;
}

/**
 * @description A real ATMO or pollen level, for a device state: 1 to 6.
 * @param {number|null} level - The level of the API.
 * @returns {number|null} The level, null when unavailable or an event.
 */
const usableLevel = (level) => (level !== null && level >= 1 && level <= 6 ? level : null);

/**
 * @description The level of an episode row.
 * @param {unknown} etat - The `etat` field.
 * @returns {number} 0 to 3.
 */
function episodeLevel(etat) {
  const text = fold(etat);
  if (text.includes('persistance')) {
    return EPISODE_LEVELS.PERSISTENCE;
  }
  if (text.includes('alerte')) {
    return EPISODE_LEVELS.ALERT;
  }
  if (text.includes('information') || text.includes('recommandation')) {
    return EPISODE_LEVELS.INFORMATION;
  }
  return EPISODE_LEVELS.NONE;
}

/**
 * @description The pollutant of an episode row.
 * @param {object} row - The row.
 * @returns {string|null} no2, o3, pm10, pm25, so2.
 */
function episodePollutant(row) {
  const byCode = POLLUTANT_CODES[Number(row.code_pol)];
  if (byCode) {
    return byCode;
  }
  const text = fold(row.lib_pol).replace(/\s/g, '');
  if (text.includes('azote') || text.includes('no2')) {
    return 'no2';
  }
  if (text.includes('ozone') || text === 'o3') {
    return 'o3';
  }
  if (text.includes('soufre') || text.includes('so2')) {
    return 'so2';
  }
  if (/2[.,]5/.test(text)) {
    return 'pm25';
  }
  if (text.includes('10')) {
    return 'pm10';
  }
  return null;
}

/**
 * @description The taxa a `pollen_resp` names, else the taxa at the highest level.
 * @param {object} row - A pollen row.
 * @param {number|null} level - The global pollen level.
 * @returns {string[]} Taxon keys.
 */
function responsibleTaxa(row, level) {
  const words = fold(row.pollen_resp)
    .split(/[\s,;/]+/)
    .filter(Boolean);
  const named = TAXA.filter((taxon) => words.some((word) => word.startsWith(taxon)));
  if (named.length > 0) {
    return named;
  }
  if (!usableLevel(level)) {
    return [];
  }
  return TAXA.filter((taxon) => readLevel(row[`code_${taxon}`]) === level);
}

/**
 * @description Group the rows of a feed per zone and date.
 * @param {object[]} rows - The rows.
 * @returns {Map<string, object>} `${zone}|${date}` -> row (the last update wins).
 */
function byZoneAndDate(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const zone = String(row.code_zone ?? '').trim();
    const date = String(row.date_ech ?? '').slice(0, 10);
    if (!zone || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }
    const key = `${zone}|${date}`;
    const previous = map.get(key);
    if (!previous || (parseApiDate(row.date_maj) ?? 0) >= (parseApiDate(previous.date_maj) ?? 0)) {
      map.set(key, row);
    }
  }
  return map;
}

/**
 * @description The dates of the rows of some zones.
 * @param {Map<string, object>} map - byZoneAndDate.
 * @param {string[]} zones - The zones.
 * @returns {string[]} Sorted dates.
 */
function datesOf(map, zones) {
  const dates = new Set();
  for (const key of map.keys()) {
    const [zone, date] = key.split('|');
    if (zones.includes(zone)) {
      dates.add(date);
    }
  }
  return [...dates].sort();
}

/**
 * @description The row of a commune for a date, else the one of its EPCI.
 * @param {Map<string, object>} map - byZoneAndDate.
 * @param {object} commune - `{ insee, epci }`.
 * @param {string} date - The date.
 * @returns {{ row: object, zone: string }|null} The row and its zone kind.
 */
function rowOf(map, commune, date) {
  const own = map.get(`${commune.insee}|${date}`);
  if (own) {
    return { row: own, zone: 'commune' };
  }
  const epci = commune.epci ? map.get(`${commune.epci}|${date}`) : null;
  return epci ? { row: epci, zone: 'epci' } : null;
}

/**
 * @description The ATMO index of a row.
 * @param {object} row - A 112 row.
 * @param {string} zone - commune or epci.
 * @returns {object} `{ level, pollutants: { no2, … }, zone, zoneName, source, updatedAt }`.
 */
function readIndex(row, zone) {
  return {
    level: readLevel(row.code_qual),
    pollutants: Object.fromEntries(POLLUTANTS.map((p) => [p, readLevel(row[`code_${p}`])])),
    zone,
    zoneName: row.lib_zone ? String(row.lib_zone) : null,
    source: row.source ? String(row.source) : null,
    updatedAt: parseApiDate(row.date_maj),
  };
}

/**
 * @description The pollen risk of a row.
 * @param {object} row - A 122 row.
 * @param {string} zone - commune or epci.
 * @returns {object} `{ level, taxa: { ambr, … }, responsible: [], zone, source, updatedAt }`.
 */
function readPollen(row, zone) {
  const level = readLevel(row.code_qual);
  return {
    level,
    taxa: Object.fromEntries(TAXA.map((taxon) => [taxon, readLevel(row[`code_${taxon}`])])),
    responsible: responsibleTaxa(row, level),
    zone,
    source: row.source ? String(row.source) : null,
    updatedAt: parseApiDate(row.date_maj),
  };
}

/**
 * @description The episodes of a department, per date.
 * @param {object[]} rows - The 114 rows.
 * @returns {Map<string, object>} `${department}|${date}` -> `{ level, pollutants, name }`.
 */
function readEpisodes(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const department = String(row.code_zone ?? '').trim();
    const date = String(row.date_ech ?? '').slice(0, 10);
    if (!department || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }
    const key = `${department}|${date}`;
    const entry = map.get(key) ?? {
      level: 0,
      pollutants: [],
      name: row.lib_zone ? String(row.lib_zone) : department,
    };
    const level = episodeLevel(row.etat);
    const pollutant = episodePollutant(row);
    if (level > entry.level) {
      entry.level = level;
      entry.pollutants = [];
    }
    if (level > 0 && level === entry.level && pollutant && !entry.pollutants.includes(pollutant)) {
      entry.pollutants.push(pollutant);
    }
    map.set(key, entry);
  }
  for (const entry of map.values()) {
    entry.pollutants.sort((a, b) => POLLUTANTS.indexOf(a) - POLLUTANTS.indexOf(b));
  }
  return map;
}

/**
 * @description The forecast of every commune, from the rows of a round.
 * @param {object[]} communes - `[{ insee, epci, department, name }]`.
 * @param {object} rows - `{ index, episodes, pollen }` (pollen null when not read).
 * @returns {object} insee -> `{ dates: { 'YYYY-MM-DD': { index, pollen, episode } } }`.
 */
function buildForecasts(communes, rows) {
  const index = byZoneAndDate(rows.index);
  const pollen = rows.pollen ? byZoneAndDate(rows.pollen) : null;
  const episodes = readEpisodes(rows.episodes);
  const result = {};
  for (const commune of communes) {
    const zones = [commune.insee, commune.epci].filter(Boolean);
    const dates = new Set([...datesOf(index, zones), ...(pollen ? datesOf(pollen, zones) : [])]);
    for (const key of episodes.keys()) {
      const [department, date] = key.split('|');
      if (department === commune.department) {
        dates.add(date);
      }
    }
    const days = {};
    for (const date of [...dates].sort()) {
      const indexRow = rowOf(index, commune, date);
      const pollenRow = pollen ? rowOf(pollen, commune, date) : null;
      const episode = episodes.get(`${commune.department}|${date}`) ?? null;
      days[date] = {
        index: indexRow ? readIndex(indexRow.row, indexRow.zone) : null,
        pollen: pollenRow ? readPollen(pollenRow.row, pollenRow.zone) : null,
        episode,
      };
    }
    result[commune.insee] = { dates: days };
  }
  return result;
}

/**
 * @description The pollutants at the highest sub-index of a day (the ones
 * that make the ATMO index).
 * @param {object|null} index - readIndex.
 * @returns {string[]} Pollutant keys.
 */
function mainPollutants(index) {
  const level = usableLevel(index?.level ?? null);
  if (!level || level < 2) {
    return [];
  }
  return POLLUTANTS.filter((p) => index.pollutants[p] === level);
}

export {
  POLLUTANTS,
  TAXA,
  EPISODE_LEVELS,
  readLevel,
  usableLevel,
  episodeLevel,
  episodePollutant,
  responsibleTaxa,
  readEpisodes,
  buildForecasts,
  mainPollutants,
};
