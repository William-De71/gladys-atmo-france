# Atmo France

## Overview

This integration brings the **official French air quality index (ATMO)** into Gladys, for one to three communes: the index today and tomorrow, the sub-indices of the five pollutants (NO₂, O₃, PM10, PM2.5, SO₂), the **pollution episodes** announced for the department and, if you wish, the **pollen allergy risk**. Each commune becomes a device you can show on a dashboard and use in scenes.

The data come from **Atmo Data**, the open data service of the Fédération Atmo France and of the regional air quality agencies (AASQA). They are published once a day, early in the afternoon. The integration reads them twice a day (about 07:30 and 15:30, Paris time) and keeps them, so a restart costs no request.

It is a **cloud** integration: it contacts `admindata.atmo-france.org` with your account, and `geo.api.gouv.fr` (the open commune service of the French government) to find the commune of your house.

## Prerequisites

- Gladys Assistant 5.3.0 or later.
- A free Atmo Data account. Request it at <https://admindata.atmo-france.org/inscription-api>: Atmo France validates the request by e-mail, usually within a few days, then you choose your password.
- The location of your house in Gladys (Settings > Houses), or the name of the commune to follow. Communes of mainland France, Corsica and overseas are covered.

## Configuration

| Field                 | What to enter                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------- |
| User name, Password   | The account of Atmo Data.                                                                     |
| House                 | A house of Gladys: its location gives the commune.                                            |
| Or a commune          | "Mâcon", "71000", "Saint-Denis 93200" or the INSEE code. When filled, it wins over the house. |
| Place 2, Place 3      | Other communes (a second home, the office, the school). Optional.                             |
| Pollen                | Also read the pollen risk. Changing it adds or removes features: update the devices.          |
| Language of the texts | Device names, the air quality as text and the scene summaries.                                |

Save: the status at the top of the page shows the communes found, today's air quality and the time of the next reading. **Read now** reads again at once (at most every 10 minutes).

## Usage

### Devices

In the **Discover** tab, create the "Air quality …" device of each commune. It holds:

- the ATMO index today and tomorrow, from 1 (good) to 6 (extremely poor), and the air quality as text;
- the sub-index of each pollutant today, from 1 to 6: a level, not a concentration in µg/m³;
- the pollution episode of the department today and tomorrow: 0 none, 1 information and advice, 2 alert on persistence, 3 alert (shown by Gladys as no, low, medium or high risk);
- with pollen: the pollen index today and tomorrow, the main pollen, and the level of ragweed, mugwort, alder, birch, grasses and olive today.

When Atmo France has no value for a day, or announces a special event (a fire), nothing is published. The badge of the index stays green in Gladys whatever its value (Gladys colors it on the US scale, 0 to 500): use the widgets to see the right colors. The "tomorrow" features keep the previous forecast between midnight and the afternoon reading.

### Dashboard widgets

![The Air quality widget for Bordeaux (sub-indices, today and tomorrow, episodes, pollen) and the Pollen widget (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-atmo-france/main/docs/assets/widgets.en.png)

- **Air quality**: the sub-indices of today, a card for today and one for tomorrow (tap it for the details), the episodes, the pollen, the source and the update time.
- **Pollen**: the risk today and tomorrow and the level of each taxon.

Choose the commune in the settings of the widget (empty: the first one).

### Scenes

Triggers, fired once per change and never twice for the same day:

- **Atmo: air quality degraded**: the index of today or tomorrow reaches "Moderate" or worse, or worsens again.
- **Atmo: pollution episode**: an information or alert procedure is announced, or rises to a higher level.
- **Atmo: pollen risk**: the pollen risk reaches "Moderate" or more, or rises.
- **Atmo: tomorrow's forecast**: published once a day, in the afternoon.

Each one gives a ready-made sentence, `{{triggerEvent.data.summary}}`, and its values (level, pollutants, pollen…). The action **Atmo: read the air quality** returns the same values for today or tomorrow, to put in a message or test in a condition.

Examples:

- When an alert episode is announced for tomorrow → send the summary to the family.
- When tomorrow's forecast is published → send it every afternoon.
- When the grasses pollen is high → close the bedroom shutters.

### Transport

Cloud only: the data come from the internet (Atmo Data and geo.api.gouv.fr). Only your account, the coordinates of the chosen house and the communes leave your network.

## Troubleshooting

- **"refused the user name or the password"**: check them, and that Atmo France has validated your account (validation e-mail). A refused password is not retried before the next reading.
- **"Commune not found"**: the house has no location, or the name is ambiguous: type "name postal code", or the INSEE code.
- **No value for a commune**: some regions publish per intercommunality only, which the integration reads instead; a value can be missing for a few hours around the daily update.
- **"too many requests"**: Atmo Data asked to wait; the integration waits the requested time.
- **To report a problem**: press **Diagnostic**, then copy the lines starting with "Atmo diagnostic" from the Logs tab into an issue on GitHub or a reply on the forum, with the versions of Gladys and of the integration. They contain neither your user name nor your password.
