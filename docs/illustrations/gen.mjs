// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets for Bordeaux on a made-up but realistic day (fixed date):
// rows of the three Atmo Data feeds go through the real parser
// (src/parse.js) and the real widget builders (src/widgets.js). Tomorrow is
// "moderate" because of ozone, with an information procedure announced for
// the department, and the grasses pollen is moderate.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildForecastWidget, buildPollenWidget } = await load('src/widgets.js');
const { buildForecasts } = await load('src/parse.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Friday 16 October 2026, 16:30 in Paris.
const NOW = Date.parse('2026-10-16T14:30:00Z');
const TODAY = '2026-10-16';
const TOMORROW = '2026-10-17';
const commune = { insee: '33063', epci: '243300316', department: '33', name: 'Bordeaux' };

const index = (date, values) => ({
  code_zone: '33063',
  type_zone: 'commune',
  lib_zone: 'Bordeaux',
  source: 'Atmo Nouvelle-Aquitaine',
  date_ech: date,
  date_maj: '2026/10/16 13:42:10.000+02',
  ...values,
});
const rows = {
  index: [
    index(TODAY, {
      code_qual: 2,
      code_no2: 2,
      code_o3: 2,
      code_pm10: 1,
      code_pm25: 2,
      code_so2: 1,
    }),
    index(TOMORROW, {
      code_qual: 3,
      code_no2: 2,
      code_o3: 3,
      code_pm10: 2,
      code_pm25: 2,
      code_so2: 1,
    }),
  ],
  episodes: [
    {
      code_zone: '33',
      lib_zone: 'Gironde',
      date_ech: TODAY,
      etat: 'PAS DE DEPASSEMENT',
      code_pol: '7',
    },
    {
      code_zone: '33',
      lib_zone: 'Gironde',
      date_ech: TOMORROW,
      etat: 'INFORMATION ET RECOMMANDATION',
      code_pol: '7',
      lib_pol: 'Ozone',
    },
  ],
  pollen: [
    {
      code_zone: '33063',
      lib_zone: 'Bordeaux',
      source: 'Atmo Nouvelle-Aquitaine',
      date_ech: TODAY,
      date_maj: '2026/10/16 13:50:00.000+02',
      code_qual: 3,
      pollen_resp: 'GRAMINEE',
      code_ambr: 2,
      code_arm: 1,
      code_aul: 1,
      code_boul: 1,
      code_gram: 3,
      code_oliv: 1,
    },
    {
      code_zone: '33063',
      lib_zone: 'Bordeaux',
      source: 'Atmo Nouvelle-Aquitaine',
      date_ech: TOMORROW,
      date_maj: '2026/10/16 13:50:00.000+02',
      code_qual: 2,
      pollen_resp: 'GRAMINEE',
      code_gram: 2,
    },
  ],
};
const dates = buildForecasts([commune], rows)['33063'].dates;
const days = { today: dates[TODAY], tomorrow: dates[TOMORROW] };

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    forecast: buildForecastWidget({
      commune,
      ...days,
      todayDate: TODAY,
      tomorrowDate: TOMORROW,
      pollen: true,
      language,
      timeZone: 'Europe/Paris',
    }),
    pollen: buildPollenWidget({ commune, ...days, language, timeZone: 'Europe/Paris' }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
