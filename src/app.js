// -----------------------------------------------------------------------------
// The Atmo France integration: every handler, registered on a Gladys client.
//
// Brings the official French air quality index (ATMO) into Gladys, from the
// Atmo Data API of the Fédération Atmo France:
//   - devices (device.js): one per commune, found from a house of Gladys
//     (its coordinates) or typed by hand (geo.js): ATMO index today and
//     tomorrow, sub-indices of the five pollutants, pollution episodes of the
//     department, pollen allergy risk;
//   - scene triggers (events.js): air quality degraded, pollution episode
//     announced, pollen alert, forecast for tomorrow published;
//   - scene action: read the air quality of a commune, today or tomorrow;
//   - dashboard widgets (widgets.js): forecast, pollen.
//
// The data are rebuilt once a day by Atmo France: they are read on the
// integration's own timer (time.js slots, Paris time), never on a Gladys poll,
// and kept in /data so a restart costs no request. Transport: cloud only.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  hasCredentials,
  readLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createAtmoClient } from './atmo-api.js';
import { createGeoClient } from './geo.js';
import { createStore, DEFAULT_PATH } from './store.js';
import { buildForecasts } from './parse.js';
import { buildDevice, buildStates, idsOf, inseeOf } from './device.js';
import { detectEvents, forecastData, actionOutputs } from './events.js';
import {
  WIDGETS,
  messageContent,
  buildForecastWidget,
  buildPollenWidget,
  readWidgetSettings,
} from './widgets.js';
import {
  defaultTimeZone,
  localClock,
  addDays,
  nextSlot,
  previousSlot,
  nextMidnight,
  jitterOf,
  MINUTE_MS,
} from './time.js';
import { t, all, LANGUAGES, atmoLabel, shortTime } from './i18n.js';

const ACTIONS = { REFRESH: 'refresh', DIAGNOSTIC: 'diagnostic' };
const SCENE_ACTIONS = { GET_AIR_QUALITY: 'get_air_quality' };
// After a failed reading: new tries, then the next slot.
const RETRY_DELAYS_MIN = [15, 30, 60, 120];
// A manual refresh never reads again within this delay.
const REFRESH_MIN_INTERVAL_MS = 10 * MINUTE_MS;
// Longest wait of the timer (setTimeout caps at 24.8 days; a day is plenty).
const MAX_TIMER_MS = 6 * 3600 * 1000;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport of Atmo Data and geo.api.gouv.fr (tests).
 * @param {string} [options.storePath] - The file kept in /data.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of "today" (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    storePath = DEFAULT_PATH,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`. French
  // until a widget is shown: the service covers France only.
  let language = 'fr';
  let createdDevices = new Set();
  // The communes of the configured places: `{ insee, name, epci, department,
  // deviceId, slots }`, and the problems of the places that gave none.
  let communes = [];
  let placeErrors = [];
  let lastStatus = null;
  let lastDiscovery = null;
  let lastError = null;
  let failures = 0;
  let retryAt = null;
  let timer = null;
  let running = null;
  let stopped = false;

  const fetchOption = fetchFn ? { fetch: fetchFn } : {};
  const api = createAtmoClient({
    getCredentials: () => ({ username: config.username, password: config.password }),
    now,
    ...fetchOption,
  });
  const geo = createGeoClient(fetchOption);
  const store = createStore({ path: storePath, logger });

  const today = () => localClock(now(), timeZone).date;
  const slotOptions = () => ({
    overseas: communes.some((commune) => String(commune.department ?? '').startsWith('97')),
    jitter: jitterOf(config.username),
  });

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  // --- Places -> communes ------------------------------------------------------------

  /**
   * @description How a place is named in a message.
   * @param {object} place - `{ slot, house }`.
   * @param {object|null} house - The house, when found.
   * @returns {Function} `(language) => values` for t('statusPlace').
   */
  const placeName = (place, house) => (l) =>
    house ? t('placeHouse', l, { name: house.name }) : t('placeSlot', l, { slot: place.slot });

  /**
   * @description Find the commune of every configured place (cached in /data).
   * @returns {Promise<void>}
   */
  async function resolvePlaces() {
    const found = new Map();
    const errors = [];
    let houses = null;
    for (const place of config.places) {
      let house = null;
      let key;
      try {
        if (place.commune) {
          key = `commune:${place.commune.toLowerCase()}`;
        } else {
          if (houses === null) {
            houses = await gladys.getHouses().catch((err) => {
              logger.warn(`Unable to read the houses: ${err.message}`);
              return [];
            });
          }
          house = houses.find((candidate) => candidate.selector === place.house) ?? null;
          if (!house) {
            throw Object.assign(new Error('unknown house'), { message_key: 'placeUnknownHouse' });
          }
          if (typeof house.latitude !== 'number' || typeof house.longitude !== 'number') {
            throw Object.assign(new Error('no location'), { message_key: 'placeNoLocation' });
          }
          key = `house:${house.latitude.toFixed(4)},${house.longitude.toFixed(4)}`;
        }
        let commune = store.data.communes[key];
        if (!commune) {
          commune = place.commune
            ? await geo.byQuery(place.commune)
            : await geo.byCoordinates(house.latitude, house.longitude);
          store.data.communes[key] = commune;
        }
        const entry = found.get(commune.insee) ?? {
          ...commune,
          deviceId: idsOf(gladys, commune.insee).device,
          slots: [],
        };
        entry.slots.push(place.slot);
        found.set(commune.insee, entry);
      } catch (err) {
        logger.warn(`Place ${place.slot}: ${err.message}`);
        let detail;
        if (err.message_key) {
          detail = (l) => t(err.message_key, l);
        } else if (err.kind === 'not_found') {
          detail = (l) => t('placeNotFound', l, { query: place.commune });
        } else if (err.kind === 'outside') {
          detail = (l) => t('placeOutside', l);
        } else {
          detail = (l) => t('placeGeoError', l, { detail: err.message });
        }
        errors.push({ slot: place.slot, place: placeName(place, house), detail });
      }
    }
    communes = [...found.values()];
    placeErrors = errors;
    await store.save();
  }

  // --- Devices and states ------------------------------------------------------------

  /**
   * @description The today / tomorrow days of a commune.
   * @param {string} insee - The INSEE code.
   * @returns {{ today: object|null, tomorrow: object|null }} The days.
   */
  function daysOf(insee) {
    const dates = store.data.forecasts?.[insee]?.dates ?? {};
    const date = today();
    return { today: dates[date] ?? null, tomorrow: dates[addDays(date, 1)] ?? null };
  }

  /**
   * @description Offer the commune devices on the Discovery screen, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} The count.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = communes.map((commune) =>
      buildDevice(gladys, commune, { pollen: config.pollen, language: lang }),
    );
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Publish the states of the created devices (only the changed ones).
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const lang = textLanguage();
    const states = communes
      .filter((commune) => createdDevices.has(commune.deviceId))
      .flatMap((commune) =>
        buildStates(gladys, commune.insee, daysOf(commune.insee), {
          pollen: config.pollen,
          language: lang,
        }),
      );
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  const publishQuietly = () =>
    publishStates().catch((err) => logger.warn(`Unable to publish the states: ${err.message}`));

  /**
   * @description Ask every open widget to pull its content again.
   */
  function refreshWidgets() {
    for (const key of Object.values(WIDGETS)) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  // --- Reading -----------------------------------------------------------------------

  /**
   * @description The status message after a reading.
   * @returns {object} The multi-language message.
   */
  function connectedMessage() {
    const next = nextSlot(now(), slotOptions());
    const problems = placeErrors.map((error) => error);
    return Object.fromEntries(
      LANGUAGES.map((l) => {
        const places = communes
          .map((commune) => {
            const level = daysOf(commune.insee).today?.index?.level ?? null;
            return `${commune.name} ${atmoLabel(level, l).toLowerCase()}`;
          })
          .join(', ');
        const text = [
          t('statusConnected', l, { places: places || '-', next: shortTime(next, l, timeZone) }),
          ...problems.map((error) =>
            t('statusPlace', l, { place: error.place(l), detail: error.detail(l) }),
          ),
        ].join(' ');
        return [l, text];
      }),
    );
  }

  /**
   * @description The multi-language message of a failed reading.
   * @param {Error} err - The error.
   * @param {number} minutes - Minutes before the next try.
   * @returns {object} The message.
   */
  function errorMessage(err, minutes) {
    switch (err.kind) {
      case 'auth':
        return all('statusAuth');
      case 'rate_limited':
        return all('statusRateLimited', { minutes });
      default:
        return all('statusUnreachable', { detail: String(err.message).slice(0, 80), minutes });
    }
  }

  /**
   * @description Report what keeps the integration from reading, if anything.
   * @returns {Promise<boolean>} True when a reading can be made.
   */
  async function readyToRead() {
    if (!hasCredentials(config)) {
      await reportStatus(false, all('noCredentials'));
      return false;
    }
    if (communes.length === 0) {
      const message = placeErrors.length
        ? Object.fromEntries(
            LANGUAGES.map((l) => [
              l,
              placeErrors
                .map((error) =>
                  t('statusPlace', l, { place: error.place(l), detail: error.detail(l) }),
                )
                .join(' '),
            ]),
          )
        : all('noPlaces');
      await reportStatus(false, message);
      return false;
    }
    return true;
  }

  /**
   * @description Read Atmo Data for every commune, publish everything.
   * @param {object} [options] - `{ baselineOnly }`.
   * @returns {Promise<boolean>} True when the reading succeeded.
   */
  async function round() {
    if (!(await readyToRead())) {
      return false;
    }
    const date = today();
    const zones = [...new Set(communes.flatMap((c) => [c.insee, c.epci].filter(Boolean)))];
    const departments = [...new Set(communes.map((c) => c.department).filter(Boolean))];
    try {
      const rows = await api.round({ zones, departments, from: date, pollen: config.pollen });
      const forecasts = buildForecasts(communes, rows);
      store.data.forecasts = forecasts;
      store.data.fetchedAt = now();
      store.data.rows = {
        index: rows.index.length,
        episodes: rows.episodes.length,
        pollen: rows.pollen ? rows.pollen.length : null,
      };
      const { events, seen } = detectEvents({
        communes,
        forecasts,
        seen: store.data.seen,
        today: date,
        language: textLanguage(),
      });
      store.data.seen = { ...store.data.seen, ...seen };
      await store.save();
      failures = 0;
      retryAt = null;
      lastError = null;
      for (const event of events) {
        try {
          await gladys.publishSceneEvent(event.key, event.data);
        } catch (err) {
          logger.warn(`Unable to fire ${event.key}: ${err.message}`);
        }
      }
      logger.info(
        `Atmo Data read for ${communes.map((c) => c.name).join(', ')}: ${rows.index.length} index, ${rows.episodes.length} episode, ${rows.pollen ? rows.pollen.length : 0} pollen row(s), ${events.length} scene event(s)`,
      );
      await publishQuietly();
      refreshWidgets();
      await reportStatus(true, connectedMessage());
      return true;
    } catch (err) {
      failures += 1;
      lastError = { at: now(), kind: err.kind ?? 'error', message: err.message };
      let delay = RETRY_DELAYS_MIN[Math.min(failures, RETRY_DELAYS_MIN.length) - 1] * MINUTE_MS;
      if (err.kind === 'auth') {
        // A refused password is not retried before the next slot.
        delay = nextSlot(now(), slotOptions()) - now();
      } else if (err.kind === 'rate_limited' && err.retryAfter) {
        delay = Math.max(delay, err.retryAfter * 1000);
      }
      retryAt = now() + delay;
      logger.warn(`Atmo Data reading failed (${err.kind ?? 'error'}): ${err.message}`);
      await reportStatus(false, errorMessage(err, Math.round(delay / MINUTE_MS)));
      return false;
    }
  }

  /**
   * @description Run one reading at a time.
   * @returns {Promise<boolean>} The result of round().
   */
  function read() {
    if (!running) {
      running = round().finally(() => {
        running = null;
      });
    }
    return running;
  }

  /**
   * @description Whether the data kept in /data are still the latest ones.
   * @returns {boolean} True when they were read after the last slot, for these communes.
   */
  function cacheIsFresh() {
    const fetchedAt = store.data.fetchedAt;
    if (!fetchedAt || fetchedAt < previousSlot(now(), slotOptions())) {
      return false;
    }
    return communes.every((commune) => store.data.forecasts?.[commune.insee]);
  }

  // --- Timer -------------------------------------------------------------------------

  /**
   * @description Arm the timer for the next thing to do: a reading slot, a
   * retry, or local midnight (today becomes yesterday's tomorrow).
   */
  function schedule() {
    if (!timers || stopped) {
      return;
    }
    clearTimeout(timer);
    const current = now();
    const candidates = [nextSlot(current, slotOptions()), nextMidnight(current, timeZone)];
    if (retryAt) {
      candidates.push(retryAt);
    }
    const at = Math.min(...candidates);
    timer = setTimeout(tick, Math.min(MAX_TIMER_MS, Math.max(1000, at - current)));
    timer.unref?.();
  }

  /**
   * @description What the timer does when it fires.
   * @returns {Promise<void>}
   */
  async function tick() {
    try {
      const current = now();
      const due =
        (retryAt !== null && current >= retryAt) ||
        (store.data.fetchedAt ?? 0) < previousSlot(current, slotOptions());
      if (due) {
        await read();
      } else {
        // A new day: the states and widgets move by one day.
        await publishQuietly();
        refreshWidgets();
      }
    } catch (err) {
      logger.error('Timer', err);
    }
    schedule();
  }

  /**
   * @description Resolve the places, offer the devices, read when needed.
   * @param {object} [options] - `{ force }`: read even with fresh data.
   * @returns {Promise<void>}
   */
  async function refreshAll({ force = false } = {}) {
    await resolvePlaces();
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    if (!force && cacheIsFresh() && (await readyToRead())) {
      await publishQuietly();
      refreshWidgets();
      await reportStatus(true, connectedMessage());
    } else {
      await read();
    }
    schedule();
  }

  // --- Dashboard widgets -------------------------------------------------------------

  /**
   * @description The commune of a widget instance.
   * @param {object} settings - The settings.
   * @returns {object|null} The commune.
   */
  function communeOf(settings) {
    const { place } = readWidgetSettings(settings);
    const insee = inseeOf(place);
    return communes.find((commune) => commune.insee === insee) ?? communes[0] ?? null;
  }

  /**
   * @description Common checks of a widget request.
   * @param {object|null} commune - The commune.
   * @param {string} lang - The language.
   * @returns {object|null} A message content, null when the widget can be built.
   */
  function widgetProblem(commune, lang) {
    if (!hasCredentials(config)) {
      return messageContent(t('noCredentials', lang));
    }
    if (!commune) {
      return messageContent(t('widgetNoPlace', lang));
    }
    if (!store.data.forecasts?.[commune.insee]) {
      return messageContent(t('widgetNotRead', lang), 60);
    }
    return null;
  }

  gladys.onWidgetGet(WIDGETS.FORECAST, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const commune = communeOf(settings);
    return (
      widgetProblem(commune, lang) ??
      buildForecastWidget({
        commune,
        ...daysOf(commune.insee),
        todayDate: today(),
        tomorrowDate: addDays(today(), 1),
        pollen: config.pollen,
        language: lang,
        timeZone,
      })
    );
  });

  gladys.onWidgetGet(WIDGETS.POLLEN, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const commune = communeOf(settings);
    if (!config.pollen) {
      return messageContent(t('widgetNoPollen', lang));
    }
    return (
      widgetProblem(commune, lang) ??
      buildPollenWidget({ commune, ...daysOf(commune.insee), language: lang, timeZone })
    );
  });

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, async (fields = {}) => {
    const insee = inseeOf(fields.place);
    const commune =
      communes.find((candidate) => candidate.insee === insee) ?? (insee ? null : communes[0]);
    if (!commune) {
      throw new Error(`Unknown commune: ${fields.place ?? '(none)'}`);
    }
    if (!store.data.forecasts?.[commune.insee]) {
      throw new Error('The data of Atmo France have not been read yet');
    }
    const day = fields.day === 'tomorrow' ? 'tomorrow' : 'today';
    const date = day === 'tomorrow' ? addDays(today(), 1) : today();
    return actionOutputs(
      forecastData(
        { commune, deviceId: commune.deviceId, date, entry: daysOf(commune.insee)[day], day },
        textLanguage(),
      ),
    );
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (!hasCredentials(config)) {
      return all('noCredentials');
    }
    const fetchedAt = store.data.fetchedAt;
    if (fetchedAt && now() - fetchedAt < REFRESH_MIN_INTERVAL_MS && !lastError) {
      return all('refreshTooSoon', {
        minutes: Math.max(1, Math.round((now() - fetchedAt) / MINUTE_MS)),
      });
    }
    await resolvePlaces();
    await publishDiscoveredDevices().catch(() => {});
    const ok = await read();
    schedule();
    if (!ok) {
      const status = lastStatus ? JSON.parse(lastStatus)[1] : all('noPlaces');
      return status;
    }
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        t('refreshDone', l, {
          places: communes.map((commune) => commune.name).join(', '),
          today: communes
            .map((commune) => {
              const level = daysOf(commune.insee).today?.index?.level ?? null;
              return `${commune.name} ${atmoLabel(level, l).toLowerCase()}`;
            })
            .join(', '),
        }),
      ]),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      today: today(),
      pollen: config.pollen,
      credentials: hasCredentials(config),
      places: config.places.map(({ slot, house, commune }) => ({
        slot,
        house: Boolean(house),
        commune,
      })),
      communes: communes.map(({ insee, name, epci, department, slots }) => ({
        insee,
        name,
        epci,
        department,
        slots,
      })),
      placeErrors: placeErrors.map((error) => ({ slot: error.slot, detail: error.detail('en') })),
      created: communes
        .filter((commune) => createdDevices.has(commune.deviceId))
        .map((c) => c.insee),
      fetchedAt: store.data.fetchedAt ? new Date(store.data.fetchedAt).toISOString() : null,
      rows: store.data.rows ?? null,
      nextSlot: new Date(nextSlot(now(), slotOptions())).toISOString(),
      retryAt: retryAt ? new Date(retryAt).toISOString() : null,
      lastError,
      requests: api.requests.total,
      forecasts: store.data.forecasts,
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `Atmo diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await resolvePlaces();
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} commune(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishQuietly();
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const before = JSON.stringify([config.username, config.password, config.places, config.pollen]);
    await loadConfig(rawConfig);
    const after = JSON.stringify([config.username, config.password, config.places, config.pollen]);
    lastDiscovery = null;
    failures = 0;
    retryAt = null;
    logger.info('Configuration updated');
    // New account, places or pollen choice: read now; a language change only
    // renames the offered devices.
    await refreshAll({ force: before !== after });
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await loadConfig();
      await store.load();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await refreshAll();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearTimeout(timer);
  });

  return {
    store,
    api,
    read,
    tick,
    refreshAll,
    getConfig: () => config,
    getCommunes: () => communes,
    getRetryAt: () => retryAt,
    whenReady: () => startup,
  };
}

export { createApp, ACTIONS, SCENE_ACTIONS, RETRY_DELAYS_MIN, REFRESH_MIN_INTERVAL_MS };
