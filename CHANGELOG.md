# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([bcc188d](https://github.com/William-De71/gladys-atmo-france/commit/bcc188d45f036d96800721a547958d4bc21d8e4b))

## [0.1.0] - 2026-10-16

### Added

- One device per commune, found from the location of a house of Gladys or typed by hand (name, postal code or INSEE code): ATMO index today and tomorrow, sub-indices of NO₂, O₃, PM10, PM2.5 and SO₂, air quality as text, pollution episodes of the department today and tomorrow.
- Pollen allergy risk (optional): pollen index today and tomorrow, main pollen, level of ragweed, mugwort, alder, birch, grasses and olive.
- Scene triggers: air quality degraded, pollution episode announced, pollen risk, tomorrow's forecast published.
- Scene action: read the air quality of a commune, today or tomorrow, with a ready-made summary.
- Dashboard widgets: air quality forecast (today and tomorrow) and pollen.
- Configuration actions: read now, and a diagnostic written to the Logs tab.
- Cloud transport: the Atmo Data API of the Fédération Atmo France is read twice a day on the integration's own timer, outside its publication window, and kept in `/data`.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.1]: https://github.com/William-De71/gladys-atmo-france/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-atmo-france/releases/tag/v0.1.0
