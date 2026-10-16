# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for Atmo France: a Node.js service
(Node 22+, ESM, no build step) that runs in its own sandboxed Docker container
and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the Atmo Data API of the Fédération
Atmo France (`admindata.atmo-france.org`, free account: login -> JWT, feeds
112 index, 114 pollution episodes, 122 pollen) twice a day, and finds the
communes on `geo.api.gouv.fr`. Transport: cloud only.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timer
src/atmo-api.js         Atmo Data client (one login per round, error kinds, 429)
src/geo.js              communes from geo.api.gouv.fr (coordinates, name, postal code, INSEE)
src/parse.js            feed rows -> forecast per commune and date (EPCI fallback)
src/time.js             calendar dates (TZ), reading slots (Paris time), midnight
src/store.js            /data/atmo-france.json: communes, forecasts, `seen`
src/events.js           scene trigger transitions, payloads, scene action outputs
src/device.js           one device per commune, its states
src/widgets.js          forecast and pollen dashboard widgets
src/config.js           configuration (account, three places, pollen, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`commune:<INSEE code in lower case>`: never a name),
  feature `category` / `type` / `unit` / `min` / `max` / `step`, the keys of
  `config_schema`, `actions`, the widgets and their settings, scene triggers
  (fields, options, variables) and scene actions (fields, outputs).
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** The ATMO and pollen levels (1-6) are
  `airquality-sensor` / `aqi`; the sub-indices are levels, never the µg/m³
  categories (`pm25-sensor`, `no2-sensor`…). Episodes are `risk` / `integer`
  (0-3). No state for level 0 (unavailable) or 7/8 (special event).
- **`should_poll` stays false**: the data change once a day; the integration
  reads at 07:30 and 15:30 Paris time (+20:30 with an overseas commune) plus a
  stable per-account jitter, never between 13:00 and 15:00 (asked by Atmo
  France). One login and at most three data requests per round, every commune
  at once (`IN` filters). A refused password waits for the next slot; a 429
  waits its Retry-After. The forecasts are kept in /data: a restart before the
  next slot makes no request.
- **Events once.** `seen` (in /data) remembers per commune and date what was
  announced; the first reading of a commune is a baseline. A scene action or a
  widget never fires an event.
- **The container rootfs is read-only.** Write only under `/data`. Never log
  the user name or the password; never put them in an URL (the Diagnostic
  action leaves them out).
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. A field older cores do not know needs a higher `gladys_version`
  minimum (see `src/constants.js` of the integration-store): a
  `source: "houses"` select needs 5.2.0. `location: true` is needed for the coordinates of
  the houses. Transport: `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (a local server on 127.0.0.1 at
  most).
