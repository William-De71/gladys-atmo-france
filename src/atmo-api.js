// -----------------------------------------------------------------------------
// Client of the Atmo Data API (https://admindata.atmo-france.org/api/doc).
//
//   POST /api/login            { username, password } -> { token } (a JWT valid
//                              one hour); 401 "Identifiants invalides."
//   GET  /api/data/{id}/{json} the rows of a feed, filtered by a JSON object
//                              {"field":{"operator":"=","value":"…"}}, as a
//                              GeoJSON FeatureCollection (?withGeom=false);
//                              401 "JWT Token not found" without a token.
//
// Feeds used (FAQ of the API, April 2023):
//   112  ATMO index per commune or EPCI and date (code_qual, code_no2, …)
//   114  pollution episodes per department, the day before, today, tomorrow
//   122  pollen allergy risk per commune or EPCI and date
//
// The feeds are rebuilt once a day: one login per reading round, never per
// request, and a 429 is respected (Retry-After). The password never appears
// in a log or an URL.
// -----------------------------------------------------------------------------

const BASE_URL = 'https://admindata.atmo-france.org';
const FEEDS = { INDEX: 112, EPISODES: 114, POLLEN: 122 };
const TIMEOUT_MS = 60000;
const USER_AGENT = 'gladys-atmo-france (+https://github.com/William-De71/gladys-atmo-france)';

class AtmoError extends Error {
  /**
   * @param {string} kind - `auth`, `rate_limited`, `unreachable` or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status, retryAfter }` (retryAfter in seconds).
   */
  constructor(kind, message, { status = null, retryAfter = null } = {}) {
    super(message);
    this.name = 'AtmoError';
    this.kind = kind;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/**
 * @description Read a Retry-After header (seconds or an HTTP date).
 * @param {string|null} value - The header.
 * @param {number} now - Now, in ms.
 * @returns {number|null} Seconds to wait.
 */
function readRetryAfter(value, now) {
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.round(seconds));
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.round((date - now) / 1000)) : null;
}

/**
 * @description The path of a filtered feed. The JSON filter is a path segment:
 * its quotes, braces and brackets are percent-encoded, the rest kept readable.
 * @param {number} feed - The feed id.
 * @param {object} filter - The filter object.
 * @returns {string} The path and query.
 * @example
 * dataPath(112, { code_zone: { operator: '=', value: '33063' } });
 */
function dataPath(feed, filter) {
  return `/api/data/${feed}/${encodeURI(JSON.stringify(filter))}?withGeom=false`;
}

/**
 * @description A client of the Atmo Data API.
 * @param {object} options - Options.
 * @param {Function} options.getCredentials - `() => ({ username, password })`.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @returns {object} `{ login, feed, round, requests }`.
 */
function createAtmoClient({
  getCredentials,
  fetch: fetchFn = globalThis.fetch,
  now = () => Date.now(),
}) {
  // Requests made, for the diagnostic.
  const requests = { total: 0, last: null };

  /**
   * @description One HTTP request to the API.
   * @param {string} path - The path.
   * @param {object} init - The fetch options.
   * @returns {Promise<Response>} The response.
   */
  async function call(path, init) {
    requests.total += 1;
    requests.last = now();
    try {
      return await fetchFn(`${BASE_URL}${path}`, {
        ...init,
        headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new AtmoError('unreachable', err.cause?.code ?? err.message);
    }
  }

  /**
   * @description Turn a failed response into an AtmoError.
   * @param {Response} response - The response.
   * @returns {Promise<AtmoError>} The error.
   */
  async function failure(response) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) {
        detail = `${detail} ${String(body.message).slice(0, 120)}`;
      }
    } catch {
      // Not JSON: the status says enough.
    }
    if (response.status === 401 || response.status === 403) {
      return new AtmoError('auth', detail, { status: response.status });
    }
    if (response.status === 429) {
      return new AtmoError('rate_limited', detail, {
        status: 429,
        retryAfter: readRetryAfter(response.headers.get('retry-after'), now()),
      });
    }
    return new AtmoError('unreachable', detail, { status: response.status });
  }

  /**
   * @description Log in and get a token.
   * @returns {Promise<string>} The JWT.
   */
  async function login() {
    const { username, password } = getCredentials();
    const response = await call('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      throw await failure(response);
    }
    const body = await response.json().catch(() => null);
    if (!body || typeof body.token !== 'string' || !body.token) {
      throw new AtmoError('invalid', 'No token in the login answer');
    }
    return body.token;
  }

  /**
   * @description The rows of a feed.
   * @param {string} token - The JWT.
   * @param {number} feed - The feed id.
   * @param {object} filter - The filter object.
   * @returns {Promise<object[]>} The `properties` of each feature.
   */
  async function feed(token, feed, filter) {
    const response = await call(dataPath(feed, filter), {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw await failure(response);
    }
    const text = await response.text();
    // An empty body means no row (seen on days without data).
    if (!text.trim()) {
      return [];
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AtmoError('invalid', `Feed ${feed}: not JSON`);
    }
    if (!body || !Array.isArray(body.features)) {
      throw new AtmoError('invalid', `Feed ${feed}: no features`);
    }
    return body.features.map((feature) => feature?.properties).filter(Boolean);
  }

  /**
   * @description One reading round: a login, then the index (and pollen) of
   * the zones and the episodes of the departments, from a date on.
   * @param {object} input - `{ zones: string[], departments: string[], from: 'YYYY-MM-DD', pollen: boolean }`.
   * @returns {Promise<{ index: object[], episodes: object[], pollen: object[]|null }>} The rows.
   */
  async function round({ zones, departments, from, pollen }) {
    const token = await login();
    const date = { operator: '>=', value: from };
    const index = await feed(token, FEEDS.INDEX, {
      code_zone: { operator: 'IN', value: zones },
      date_ech: date,
    });
    const episodes = departments.length
      ? await feed(token, FEEDS.EPISODES, {
          code_zone: { operator: 'IN', value: departments },
          date_ech: date,
        })
      : [];
    const pollenRows = pollen
      ? await feed(token, FEEDS.POLLEN, {
          code_zone: { operator: 'IN', value: zones },
          date_ech: date,
        })
      : null;
    return { index, episodes, pollen: pollenRows };
  }

  return { login, feed, round, requests };
}

export { BASE_URL, FEEDS, AtmoError, createAtmoClient, dataPath, readRetryAfter };
