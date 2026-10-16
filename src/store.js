// -----------------------------------------------------------------------------
// What the integration keeps across restarts, in /data/atmo-france.json (the
// only writable place of the container):
//   - `communes`   the communes found for each place (no geo request at each
//                  start), keyed by what the place was made of;
//   - `forecasts`  the last forecasts read, so a restart neither calls Atmo
//                  Data again before the next slot nor loses the widgets;
//   - `fetchedAt`  when they were read;
//   - `seen`       what the scene triggers already announced, per commune and
//                  date, so a restart never fires the same event twice.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/atmo-france.json';
const EMPTY = () => ({ communes: {}, forecasts: {}, fetchedAt: null, seen: {} });

/**
 * @description The store.
 * @param {object} [options] - `{ path, logger }`.
 * @returns {object} `{ data, load, save }`.
 */
function createStore({ path = DEFAULT_PATH, logger } = {}) {
  const store = {
    data: EMPTY(),
    /**
     * @description Read the file; an absent or broken file is an empty store.
     * @returns {Promise<void>}
     */
    async load() {
      try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        store.data = { ...EMPTY(), ...(raw && typeof raw === 'object' ? raw : {}) };
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger?.warn(`Unable to read ${path}: ${err.message}`);
        }
        store.data = EMPTY();
      }
    },
    /**
     * @description Write the file (atomically: a temporary file, then a rename).
     * @returns {Promise<void>}
     */
    async save() {
      try {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(store.data));
        await rename(temporary, path);
      } catch (err) {
        logger?.warn(`Unable to write ${path}: ${err.message}`);
      }
    },
  };
  return store;
}

export { DEFAULT_PATH, createStore };
