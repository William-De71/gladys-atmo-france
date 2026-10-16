// -----------------------------------------------------------------------------
// Calendar dates and the reading schedule.
//
// The ATMO index is a calendar date ("2026-10-16"), the local day of the
// commune: "today" is read in the timezone of the Gladys instance, which the
// supervisor injects as TZ. The publication schedule of Atmo Data, though, is
// Paris time: the feeds are rebuilt once a day from 13:00 to 15:00 for
// mainland France (from 18:00 for overseas), and Atmo France asks to read
// them once or twice a day outside that window.
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;
const MINUTE_MS = 60 * 1000;
const PARIS = 'Europe/Paris';

// Reading slots, Paris time (minutes after midnight): the morning catches the
// revisions of the day, the afternoon one the new forecast for tomorrow.
const SLOTS = [7 * 60 + 30, 15 * 60 + 30];
// Overseas feeds are published from 18:00 Paris time.
const OVERSEAS_SLOT = 20 * 60 + 30;
// Each instance reads a little after the slot, never all at once.
const JITTER_MINUTES = 30;

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description The local date and time of an instant in a timezone.
 * @param {number} instant - The instant, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {{ date: string, minutes: number }} `YYYY-MM-DD` and minutes since midnight.
 * @example
 * localClock(Date.parse('2026-10-16T12:00:00Z'), 'Europe/Paris'); // 2026-10-16, 840
 */
function localClock(instant, timeZone = defaultTimeZone()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * @description Shift a calendar date by a number of days.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {number} days - Days to add (negative to go back).
 * @returns {string} `YYYY-MM-DD`.
 */
function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @description The instant of a local wall-clock time in a timezone.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {number} minutes - Minutes after midnight.
 * @param {string} timeZone - IANA timezone.
 * @returns {number} The instant, in ms.
 */
function zonedInstant(date, minutes, timeZone) {
  const wanted = Date.parse(`${date}T00:00:00Z`) + minutes * MINUTE_MS;
  let guess = wanted;
  // Two passes settle the offset, DST changes included.
  for (let pass = 0; pass < 2; pass += 1) {
    const clock = localClock(guess, timeZone);
    const seen = Date.parse(`${clock.date}T00:00:00Z`) + clock.minutes * MINUTE_MS;
    guess += wanted - seen;
  }
  return guess;
}

/**
 * @description A stable jitter, in minutes, from a seed (the account name):
 * the same instance always reads at the same minutes.
 * @param {string} seed - The seed.
 * @returns {number} 0 to JITTER_MINUTES - 1.
 */
function jitterOf(seed) {
  let hash = 0;
  for (const char of String(seed ?? '')) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return hash % JITTER_MINUTES;
}

/**
 * @description The reading slots of a day, Paris time.
 * @param {boolean} overseas - Whether a place is overseas.
 * @returns {number[]} Minutes after midnight, sorted.
 */
const slotsOf = (overseas) => (overseas ? [...SLOTS, OVERSEAS_SLOT] : [...SLOTS]);

/**
 * @description The instant of the next reading slot after `now`.
 * @param {number} now - Now, in ms.
 * @param {object} [options] - `{ overseas, jitter }`.
 * @returns {number} The instant, in ms.
 */
function nextSlot(now, { overseas = false, jitter = 0 } = {}) {
  const today = localClock(now, PARIS).date;
  for (let day = 0; day < 3; day += 1) {
    const date = addDays(today, day);
    for (const slot of slotsOf(overseas)) {
      const instant = zonedInstant(date, slot + jitter, PARIS);
      if (instant > now) {
        return instant;
      }
    }
  }
  return now + DAY_MS;
}

/**
 * @description The instant of the last reading slot at or before `now`.
 * @param {number} now - Now, in ms.
 * @param {object} [options] - `{ overseas, jitter }`.
 * @returns {number} The instant, in ms.
 */
function previousSlot(now, { overseas = false, jitter = 0 } = {}) {
  const today = localClock(now, PARIS).date;
  for (let day = 0; day > -3; day -= 1) {
    const date = addDays(today, day);
    for (const slot of slotsOf(overseas).reverse()) {
      const instant = zonedInstant(date, slot + jitter, PARIS);
      if (instant <= now) {
        return instant;
      }
    }
  }
  return now - DAY_MS;
}

/**
 * @description The next local midnight (a little after), when "today" and
 * "tomorrow" move.
 * @param {number} now - Now, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {number} The instant, in ms.
 */
function nextMidnight(now, timeZone = defaultTimeZone()) {
  const tomorrow = addDays(localClock(now, timeZone).date, 1);
  return zonedInstant(tomorrow, 1, timeZone);
}

/**
 * @description A calendar date for a widget card. Gladys shows a date of
 * that exact form as the calendar day itself, without a time, in every
 * timezone (front 5.1.1+).
 * @param {string} date - `YYYY-MM-DD`.
 * @returns {string} ISO 8601 date.
 */
const displayInstant = (date) => `${date}T00:00:00.000Z`;

/**
 * @description Read a date of the API ("2026/10/16 12:11:49.728+02" or
 * "2026-10-16") into an instant.
 * @param {unknown} value - The value.
 * @returns {number|null} The instant, in ms.
 */
function parseApiDate(value) {
  const match =
    /^(\d{4})[/-](\d{2})[/-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(
      String(value ?? '').trim(),
    );
  if (!match) {
    return null;
  }
  const [, y, mo, d, h = '00', mi = '00', s = '00', zone] = match;
  let offset = 'Z';
  if (zone && zone !== 'Z') {
    const sign = zone[0];
    const digits = zone.slice(1).replace(':', '');
    offset = `${sign}${digits.slice(0, 2)}:${digits.slice(2, 4) || '00'}`;
  }
  const instant = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`);
  return Number.isFinite(instant) ? instant : null;
}

export {
  DAY_MS,
  MINUTE_MS,
  PARIS,
  SLOTS,
  OVERSEAS_SLOT,
  JITTER_MINUTES,
  defaultTimeZone,
  localClock,
  addDays,
  zonedInstant,
  jitterOf,
  nextSlot,
  previousSlot,
  nextMidnight,
  displayInstant,
  parseApiDate,
};
