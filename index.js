// -----------------------------------------------------------------------------
// Entry point of the Atmo France external integration.
//
// Brings the official French air quality index (ATMO) into Gladys, from the
// Atmo Data API of the Fédération Atmo France (free account):
//   - devices: one per commune (from a house of Gladys or typed by hand), with
//     the ATMO index today and tomorrow, the sub-indices of NO₂, O₃, PM10,
//     PM2.5 and SO₂, the pollution episodes and the pollen allergy risk
//     (see src/device.js);
//   - scene triggers: air quality degraded, pollution episode announced,
//     pollen alert, forecast for tomorrow published;
//   - scene action: read the air quality of a commune;
//   - dashboard widgets: forecast, pollen.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Atmo France integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
