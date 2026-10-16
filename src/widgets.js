// -----------------------------------------------------------------------------
// Dashboard widgets of the Atmo France integration.
//
//   - `forecast`  the air quality of a commune today and tomorrow: the five
//                 sub-indices of today as tiles, one card per day (ATMO level,
//                 sub-indices, episode, pollen in its detail panel), and the
//                 pollution episodes, the pollen, the source and the update
//                 time as a status list;
//   - `pollen`    the pollen allergy risk today and tomorrow, and the level
//                 of the six main taxa today.
//
// The contents come from the last reading kept by the integration: a widget
// never costs an API request. Colors are semantic (success, warning, danger),
// never the hexadecimal colors of the ATMO index. Every text exists in the
// four languages (the content is cached per language). Content budget of a
// card: 8 components, 1 main one, 6 tiles, 2 texts, 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { t, atmoLabel, pollenLabel, episodeLabel, shortDateTime, joinList } from './i18n.js';
import { POLLUTANTS, TAXA, mainPollutants, usableLevel } from './parse.js';
import { displayInstant } from './time.js';

const WIDGETS = { FORECAST: 'forecast', POLLEN: 'pollen' };
// The data change once a day: an hour of cache, nudged after each reading.
const TTL = { data: 3600, message: 300 };

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The color of an ATMO or pollen level.
 * @param {number|null} level - 1 to 6 (else neutral).
 * @returns {string} A semantic color.
 */
function levelColor(level) {
  if (!usableLevel(level ?? null)) {
    return 'neutral';
  }
  if (level <= 2) {
    return 'success';
  }
  return level === 3 ? 'warning' : 'danger';
}

/**
 * @description The color of an episode level.
 * @param {number|null} level - 0 to 3.
 * @returns {string} A semantic color.
 */
function episodeColor(level) {
  if (level === null || level === undefined) {
    return 'neutral';
  }
  if (level === 0) {
    return 'success';
  }
  return level === 1 ? 'warning' : 'danger';
}

/**
 * @description The text of an episode of a day.
 * @param {object|null} entry - A day of the forecast.
 * @param {string} language - The language.
 * @returns {{ value: string, level: number|null }} The status value.
 */
function episodeValue(entry, language) {
  if (!entry) {
    return { value: t('notPublished', language), level: null };
  }
  const level = entry.episode?.level ?? 0;
  if (level === 0) {
    return { value: episodeLabel(0, language), level };
  }
  const label = level <= 2 ? t(`episodeShort_${level}`, language) : episodeLabel(level, language);
  const pollutants = entry.episode.pollutants.map((p) => t(`pollutant_${p}`, language)).join(', ');
  return { value: clip(pollutants ? `${label} (${pollutants})` : label, 40), level };
}

/**
 * @description The card of a day of the forecast widget.
 * @param {object} input - `{ day, date, entry, language, pollen }`.
 * @returns {object} A card-list item.
 */
function dayCard({ day, date, entry, language, pollen }) {
  const level = entry?.index?.level ?? null;
  const label = atmoLabel(level, language);
  const lines = [];
  if (entry?.index) {
    const subIndices = POLLUTANTS.filter((p) => usableLevel(entry.index.pollutants[p])).map(
      (p) =>
        `${t(`pollutant_${p}`, language)} ${atmoLabel(entry.index.pollutants[p], language).toLowerCase()}`,
    );
    if (subIndices.length) {
      lines.push(t('widgetSubIndices', language, { list: subIndices.join(', ') }));
    }
  }
  lines.push(t('widgetEpisodeLine', language, { label: episodeValue(entry, language).value }));
  if (pollen && usableLevel(entry?.pollen?.level ?? null)) {
    const taxa = entry.pollen.responsible.map((taxon) => t(`taxon_${taxon}`, language));
    lines.push(
      t('widgetPollenLine', language, {
        label: taxa.length
          ? `${pollenLabel(entry.pollen.level, language)} (${joinList(taxa, language)})`
          : pollenLabel(entry.pollen.level, language),
      }),
    );
  }
  return {
    title: clip(t('widgetCardTitle', language, { day: t(`day_${day}`, language), label }), 60),
    date: displayInstant(date),
    ...(usableLevel(level)
      ? { badge: { text: t('widgetBadge', language, { level }), color: levelColor(level) } }
      : {}),
    description: clip(lines.join('\n'), 2000),
  };
}

/**
 * @description The update time and the source of a forecast.
 * @param {object[]} entries - Days of the forecast.
 * @param {string} kind - `index` or `pollen`.
 * @returns {{ updatedAt: number|null, source: string|null }} The latest ones.
 */
function provenance(entries, kind) {
  let updatedAt = null;
  let source = null;
  for (const entry of entries) {
    const part = entry?.[kind];
    if (part?.updatedAt && (updatedAt === null || part.updatedAt > updatedAt)) {
      updatedAt = part.updatedAt;
    }
    source = source ?? part?.source ?? null;
  }
  return { updatedAt, source };
}

/**
 * @description The forecast widget of a commune.
 * @param {object} input - Input.
 * @param {object} input.commune - `{ name }`.
 * @param {object|null} input.today - The day of today, or null.
 * @param {object|null} input.tomorrow - The day of tomorrow, or null.
 * @param {string} input.todayDate - `YYYY-MM-DD`.
 * @param {string} input.tomorrowDate - `YYYY-MM-DD`.
 * @param {boolean} input.pollen - Whether pollen is read.
 * @param {string} input.language - The language.
 * @param {string} [input.timeZone] - IANA timezone of the times.
 * @returns {object} The content.
 */
function buildForecastWidget({
  commune,
  today,
  tomorrow,
  todayDate,
  tomorrowDate,
  pollen,
  language,
  timeZone,
}) {
  const components = [{ type: 'text', variant: 'heading', text: clip(commune.name, 40) }];
  for (const pollutant of POLLUTANTS) {
    const level = usableLevel(today?.index?.pollutants?.[pollutant] ?? null);
    components.push({
      type: 'value',
      label: t(`pollutant_${pollutant}`, language),
      value: level ?? '-',
      unit: level ? '/6' : '',
      color: levelColor(level),
    });
  }
  components.push({
    type: 'card-list',
    display: 'list',
    items: [
      dayCard({ day: 'today', date: todayDate, entry: today, language, pollen }),
      dayCard({ day: 'tomorrow', date: tomorrowDate, entry: tomorrow, language, pollen }),
    ],
  });
  const items = [];
  const episodeToday = episodeValue(today, language);
  const episodeTomorrow = episodeValue(tomorrow, language);
  items.push({
    label: t('widgetEpisodeToday', language),
    value: episodeToday.value,
    color: episodeColor(episodeToday.level),
  });
  items.push({
    label: t('widgetEpisodeTomorrow', language),
    value: episodeTomorrow.value,
    color: episodeColor(episodeTomorrow.level),
  });
  if (pollen && usableLevel(today?.pollen?.level ?? null)) {
    const taxa = today.pollen.responsible.map((taxon) => t(`taxon_${taxon}`, language));
    items.push({
      label: t('widgetPollenToday', language),
      value: clip(
        taxa.length
          ? `${pollenLabel(today.pollen.level, language)} · ${taxa.join(', ')}`
          : pollenLabel(today.pollen.level, language),
        40,
      ),
      color: levelColor(today.pollen.level),
    });
  }
  const { updatedAt, source } = provenance([today, tomorrow], 'index');
  if (source) {
    items.push({ label: t('widgetSource', language), value: clip(source, 40), color: 'neutral' });
  }
  if (updatedAt) {
    items.push({
      label: t('widgetUpdated', language),
      value: shortDateTime(updatedAt, language, timeZone),
      color: 'neutral',
    });
  }
  components.push({ type: 'status', items });
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description The badge text of a pollen level (≤ 16 characters).
 * @param {number} level - 1 to 6.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
const pollenBadge = (level, language) =>
  level === 6 ? t('pollenShort_6', language) : pollenLabel(level, language);

/**
 * @description The pollen widget of a commune.
 * @param {object} input - `{ commune, today, tomorrow, language, timeZone }`.
 * @returns {object} The content.
 */
function buildPollenWidget({ commune, today, tomorrow, language, timeZone }) {
  const components = [{ type: 'text', variant: 'heading', text: clip(commune.name, 40) }];
  for (const [day, entry] of [
    ['widgetPollenToday', today],
    ['widgetPollenTomorrow', tomorrow],
  ]) {
    const level = usableLevel(entry?.pollen?.level ?? null);
    components.push({
      type: 'value',
      label: t(day, language),
      value: level ? clip(pollenBadge(level, language), 12) : '-',
      color: levelColor(level),
    });
  }
  const taxa = TAXA.filter((taxon) => usableLevel(today?.pollen?.taxa?.[taxon] ?? null))
    .map((taxon) => ({ taxon, level: today.pollen.taxa[taxon] }))
    .sort((a, b) => b.level - a.level);
  if (taxa.length) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: taxa.map(({ taxon, level }) => ({
        title: t(`taxon_${taxon}`, language),
        badge: { text: clip(pollenBadge(level, language), 16), color: levelColor(level) },
      })),
    });
  }
  const items = [];
  if (usableLevel(today?.pollen?.level ?? null)) {
    const responsible = today.pollen.responsible.map((taxon) => t(`taxon_${taxon}`, language));
    items.push({
      label: t('widgetMainPollen', language),
      value: clip(responsible.length ? responsible.join(', ') : '-', 40),
      color: levelColor(today.pollen.level),
    });
  }
  const { updatedAt, source } = provenance([today, tomorrow], 'pollen');
  if (source) {
    items.push({ label: t('widgetSource', language), value: clip(source, 40), color: 'neutral' });
  }
  if (updatedAt) {
    items.push({
      label: t('widgetUpdated', language),
      value: shortDateTime(updatedAt, language, timeZone),
      color: 'neutral',
    });
  }
  if (!taxa.length && !items.length) {
    components.push({ type: 'text', variant: 'body', text: t('widgetNoPollenData', language) });
  }
  if (items.length) {
    components.push({ type: 'status', items });
  }
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description Read the settings of a widget.
 * @param {object} [settings] - The settings.
 * @returns {{ place: string|null }} The device external id chosen, or null.
 */
const readWidgetSettings = (settings = {}) => ({
  place: typeof settings?.place === 'string' && settings.place ? settings.place : null,
});

export {
  WIDGETS,
  TTL,
  clip,
  messageContent,
  levelColor,
  episodeColor,
  buildForecastWidget,
  buildPollenWidget,
  readWidgetSettings,
  mainPollutants,
};
