// -----------------------------------------------------------------------------
// Scene triggers and scene action outputs.
//
// Triggers (one event per transition, never a periodic snapshot):
//   - `air_quality_degraded`  the ATMO index of today or tomorrow reaches
//                             "Moderate" (3) or worse, or worsens again;
//   - `pollution_episode`     a pollution episode (information and advice,
//                             alert) is announced for the department, today
//                             or tomorrow, or rises to a higher level;
//   - `pollen_alert`          the pollen risk of today or tomorrow reaches
//                             "Moderate" (3) or more, or rises again;
//   - `forecast_published`    the forecast for tomorrow was published (once a
//                             day): the morning message of a scene.
//
// What was announced is remembered per commune and date (`seen`, kept in
// /data): a restart or the morning reading never fires the same event twice.
// The first reading of a commune is a baseline: no event replays it.
// -----------------------------------------------------------------------------

import { t, atmoLabel, pollenLabel, episodeLabel, joinList } from './i18n.js';
import { mainPollutants, usableLevel } from './parse.js';
import { addDays } from './time.js';

const TRIGGERS = {
  AIR_QUALITY_DEGRADED: 'air_quality_degraded',
  POLLUTION_EPISODE: 'pollution_episode',
  POLLEN_ALERT: 'pollen_alert',
  FORECAST_PUBLISHED: 'forecast_published',
};
const DEGRADED_FROM = 3;
const POLLEN_FROM = 3;
const EPISODE_KEYS = { 1: 'information', 2: 'persistence', 3: 'alert' };
// `seen` keeps a few days back, then forgets.
const SEEN_DAYS = 3;
// The outputs of the `get_air_quality` scene action (manifest order).
const ACTION_OUTPUTS = [
  'place_name',
  'date',
  'level',
  'label',
  'pollutants',
  'episode_level',
  'episode_label',
  'pollen_level',
  'pollen_label',
  'pollen_taxa',
  'summary',
];

/**
 * @description The pollutant names of a list.
 * @param {string[]} list - Pollutant keys.
 * @param {string} language - The language.
 * @returns {string} "NO₂ and O₃", '' for none.
 */
const pollutantNames = (list, language) =>
  list.length
    ? joinList(
        list.map((p) => t(`pollutant_${p}`, language)),
        language,
      )
    : '';

/**
 * @description The taxon names of a list.
 * @param {string[]} list - Taxon keys.
 * @param {string} language - The language.
 * @returns {string} "Birch and Grasses", '' for none.
 */
const taxonNames = (list, language) =>
  list.length
    ? joinList(
        list.map((taxon) => t(`taxon_${taxon}`, language)),
        language,
      )
    : '';

/**
 * @description The sentence of the ATMO index of a day.
 * @param {object} input - `{ commune, day, entry }` (entry: a day of the forecast, or null).
 * @param {string} language - The language.
 * @returns {string} The summary.
 */
function indexSummary({ commune, day, entry }, language) {
  const level = entry?.index?.level ?? null;
  if (level === null || level === 0) {
    return t('summaryIndexUnknown', language, {
      day: t(`dayLower_${day}`, language),
      commune: commune.name,
    });
  }
  const pollutants = pollutantNames(mainPollutants(entry.index), language);
  return t('summaryIndex', language, {
    day: t(`dayLower_${day}`, language),
    commune: commune.name,
    label: atmoLabel(level, language).toLowerCase(),
    level: level >= 7 ? '-' : level,
    pollutants: pollutants ? t('summaryPollutants', language, { list: pollutants }) : '',
  });
}

/**
 * @description The sentence of the pollen risk of a day.
 * @param {object} input - `{ commune, day, entry }`.
 * @param {string} language - The language.
 * @returns {string} The summary, '' without pollen data.
 */
function pollenSummary({ commune, day, entry }, language) {
  const level = usableLevel(entry?.pollen?.level ?? null);
  if (!level) {
    return '';
  }
  const taxa = taxonNames(entry.pollen.responsible, language);
  return t('summaryPollen', language, {
    day: t(`dayLower_${day}`, language),
    commune: commune.name,
    label: pollenLabel(level, language).toLowerCase(),
    level,
    taxa: taxa ? t('summaryTaxa', language, { list: taxa }) : '',
  });
}

/**
 * @description The sentence of a pollution episode.
 * @param {object} input - `{ commune, day, entry }`.
 * @param {string} language - The language.
 * @returns {string} The summary, '' without an episode.
 */
function episodeSummary({ day, entry, commune }, language) {
  const episode = entry?.episode;
  if (!episode || episode.level === 0) {
    return '';
  }
  return t('summaryEpisode', language, {
    day: t(`dayLower_${day}`, language),
    department: episode.name || commune.department,
    label: episodeLabel(episode.level, language).toLowerCase(),
    pollutants: pollutantNames(episode.pollutants, language) || '?',
  });
}

/**
 * @description The common part of the event data.
 * @param {object} input - `{ deviceId, commune, day, date }`.
 * @returns {object} The data.
 */
const base = ({ deviceId, commune, day, date }) => ({
  place: deviceId,
  place_name: commune.name,
  insee: commune.insee,
  day,
  date,
});

/**
 * @description The scene events of a reading, and the new `seen`.
 * @param {object} input - Input.
 * @param {object[]} input.communes - The communes, with `deviceId`.
 * @param {object} input.forecasts - buildForecasts.
 * @param {object} input.seen - What was already announced (not modified).
 * @param {string} input.today - `YYYY-MM-DD`, local.
 * @param {string} input.language - Language of the summaries.
 * @returns {{ events: Array<{ key: string, data: object }>, seen: object }} The events and the new memory.
 */
function detectEvents({ communes, forecasts, seen = {}, today, language }) {
  const events = [];
  const next = {};
  const tomorrow = addDays(today, 1);
  const oldest = addDays(today, -SEEN_DAYS);
  for (const commune of communes) {
    const before = seen[commune.insee];
    // A commune never met: its first reading is the reference.
    const baseline = !before;
    const memory = Object.fromEntries(
      Object.entries(before ?? {}).filter(([date]) => date >= oldest),
    );
    const dates = forecasts[commune.insee]?.dates ?? {};
    for (const [day, date] of [
      ['today', today],
      ['tomorrow', tomorrow],
    ]) {
      const entry = dates[date];
      if (!entry) {
        continue;
      }
      const known = memory[date] ?? { index: 0, episode: 0, pollen: 0, forecast: false };
      const context = { deviceId: commune.deviceId, commune, day, date };
      const index = usableLevel(entry.index?.level ?? null);
      if (index && index >= DEGRADED_FROM && index > known.index && !baseline) {
        events.push({
          key: TRIGGERS.AIR_QUALITY_DEGRADED,
          data: {
            ...base(context),
            level: index,
            label: atmoLabel(index, language),
            pollutants: pollutantNames(mainPollutants(entry.index), language),
            summary: indexSummary({ commune, day, entry }, language),
          },
        });
      }
      const episode = entry.episode?.level ?? 0;
      if (episode >= 1 && episode > known.episode && !baseline) {
        events.push({
          key: TRIGGERS.POLLUTION_EPISODE,
          data: {
            ...base(context),
            department: entry.episode.name || commune.department,
            level: EPISODE_KEYS[episode],
            level_number: episode,
            label: episodeLabel(episode, language),
            pollutants: pollutantNames(entry.episode.pollutants, language),
            summary: episodeSummary({ commune, day, entry }, language),
          },
        });
      }
      const pollen = usableLevel(entry.pollen?.level ?? null);
      if (pollen && pollen >= POLLEN_FROM && pollen > known.pollen && !baseline) {
        events.push({
          key: TRIGGERS.POLLEN_ALERT,
          data: {
            ...base(context),
            level: pollen,
            label: pollenLabel(pollen, language),
            taxa: taxonNames(entry.pollen.responsible, language),
            summary: pollenSummary({ commune, day, entry }, language),
          },
        });
      }
      const published = day === 'tomorrow' && entry.index !== null && (entry.index.level ?? 0) > 0;
      if (published && !known.forecast && !baseline) {
        events.push({
          key: TRIGGERS.FORECAST_PUBLISHED,
          data: forecastData({ commune, deviceId: commune.deviceId, date, entry }, language),
        });
      }
      memory[date] = {
        index: Math.max(known.index, index ?? 0),
        episode: Math.max(known.episode, episode),
        pollen: Math.max(known.pollen, pollen ?? 0),
        forecast: known.forecast || published,
      };
    }
    next[commune.insee] = memory;
  }
  return { events, seen: next };
}

/**
 * @description The data of `forecast_published`, and the outputs of the
 * `get_air_quality` scene action: everything known about one day.
 * @param {object} input - `{ commune, deviceId, date, entry, day }`.
 * @param {string} language - The language.
 * @returns {object} Flat scalars.
 */
function forecastData({ commune, deviceId, date, entry, day = 'tomorrow' }, language) {
  const level = entry?.index?.level ?? null;
  const pollen = usableLevel(entry?.pollen?.level ?? null);
  const episode = entry?.episode?.level ?? 0;
  const parts = [
    indexSummary({ commune, day, entry }, language),
    episodeSummary({ commune, day, entry }, language),
    pollenSummary({ commune, day, entry }, language),
  ].filter(Boolean);
  return {
    place: deviceId,
    place_name: commune.name,
    insee: commune.insee,
    day,
    date,
    level: usableLevel(level),
    label: atmoLabel(level, language),
    pollutants: pollutantNames(mainPollutants(entry?.index ?? null), language),
    episode_level: episode,
    episode_label: episodeLabel(episode, language),
    pollen_level: pollen,
    pollen_label: pollen ? pollenLabel(pollen, language) : '',
    pollen_taxa: pollen ? taxonNames(entry.pollen.responsible, language) : '',
    summary: parts.join(' '),
  };
}

/**
 * @description The outputs of the `get_air_quality` scene action.
 * @param {object} data - forecastData.
 * @returns {object} Only the declared outputs.
 */
const actionOutputs = (data) =>
  Object.fromEntries(ACTION_OUTPUTS.map((key) => [key, data[key] ?? null]));

export {
  TRIGGERS,
  ACTION_OUTPUTS,
  actionOutputs,
  DEGRADED_FROM,
  POLLEN_FROM,
  EPISODE_KEYS,
  detectEvents,
  forecastData,
  indexSummary,
  pollenSummary,
  episodeSummary,
  pollutantNames,
  taxonNames,
};
