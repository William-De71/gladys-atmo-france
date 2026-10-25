# Atmo France

## Überblick

Diese Integration bringt den **offiziellen französischen Luftqualitätsindex ATMO** in Gladys, für eine bis drei Gemeinden: den Index für heute und morgen, die Teilindizes der fünf Schadstoffe (NO₂, O₃, PM10, PM2,5, SO₂), die für das Departement angekündigten **Schadstoffepisoden** und auf Wunsch das **Pollenallergierisiko**. Jede Gemeinde wird zu einem Gerät, das Sie auf einem Dashboard anzeigen und in Szenen verwenden können.

Die Daten stammen von **Atmo Data**, dem Open-Data-Dienst der Fédération Atmo France und der regionalen Luftgüte-Verbände (AASQA). Sie werden einmal täglich am frühen Nachmittag veröffentlicht. Die Integration liest sie zweimal täglich (gegen 07:30 und 15:30 Uhr Pariser Zeit) und speichert sie, sodass ein Neustart keine Anfrage kostet.

Es ist eine **Cloud**-Integration: Sie kontaktiert `admindata.atmo-france.org` mit Ihrem Konto und `geo.api.gouv.fr` (den offenen Gemeindedienst des französischen Staates), um die Gemeinde Ihres Hauses zu finden.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Ein kostenloses Atmo-Data-Konto. Beantragen Sie es unter <https://admindata.atmo-france.org/inscription-api>: Atmo France bestätigt den Antrag per E-Mail, meist innerhalb weniger Tage, danach wählen Sie Ihr Passwort.
- Der Standort Ihres Hauses in Gladys (Einstellungen > Häuser) oder der Name der zu verfolgenden Gemeinde. Gemeinden auf dem Festland, auf Korsika und in Übersee werden abgedeckt.

## Konfiguration

| Feld                   | Was eintragen                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Benutzername, Passwort | Das Atmo-Data-Konto.                                                                                      |
| Haus                   | Ein Haus von Gladys: Sein Standort ergibt die Gemeinde.                                                   |
| Oder eine Gemeinde     | „Mâcon“, „71000“, „Saint-Denis 93200“ oder der INSEE-Code. Ausgefüllt hat sie Vorrang vor dem Haus.       |
| Ort 2, Ort 3           | Weitere Gemeinden (Zweitwohnsitz, Arbeitsplatz, Schule). Optional.                                        |
| Pollen                 | Auch das Pollenrisiko lesen. Eine Änderung fügt Funktionen hinzu oder entfernt sie: Geräte aktualisieren. |
| Sprache der Texte      | Gerätenamen, Luftqualität als Text und Szenen-Zusammenfassungen.                                          |

Speichern: Der Status oben auf der Seite zeigt die gefundenen Gemeinden, die heutige Luftqualität und die Uhrzeit der nächsten Abfrage. **Jetzt lesen** liest sofort neu (höchstens alle 10 Minuten).

## Verwendung

### Geräte

Legen Sie im Tab **Entdecken** das Gerät „Luftqualität …“ jeder Gemeinde an. Es enthält:

- den ATMO-Index für heute und morgen, von 1 (gut) bis 6 (extrem schlecht), und die Luftqualität als Text;
- den Teilindex jedes Schadstoffs heute, von 1 bis 6: eine Stufe, keine Konzentration in µg/m³;
- die Schadstoffepisode des Departements heute und morgen: 0 keine, 1 Information und Empfehlungen, 2 Alarm wegen Andauern, 3 Alarm (von Gladys als kein, geringes, mittleres oder hohes Risiko angezeigt);
- mit Pollen: den Pollenindex für heute und morgen, den Hauptpollen und die Stufe von Ambrosia, Beifuß, Erle, Birke, Gräsern und Olive heute.

Hat Atmo France für einen Tag keinen Wert oder meldet ein Sonderereignis (einen Brand), wird nichts veröffentlicht. Das Abzeichen des Index bleibt in Gladys unabhängig vom Wert grün (Gladys färbt es nach der US-Skala von 0 bis 500): Die Widgets zeigen die richtigen Farben. Die „morgen“-Funktionen behalten die vorherige Prognose zwischen Mitternacht und der Nachmittagsabfrage.

### Dashboard-Widgets

![Das Widget Luftqualität für Bordeaux (Teilindizes, heute und morgen, Episoden, Pollen) und das Widget Pollen (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-atmo-france/main/docs/assets/widgets.de.png)

- **Luftqualität**: die Teilindizes von heute, eine Karte für heute und eine für morgen (antippen für Details), die Episoden, die Pollen, die Quelle und die Aktualisierungszeit.
- **Pollen**: das Risiko heute und morgen und die Stufe jeder Art.

Wählen Sie die Gemeinde in den Einstellungen des Widgets (leer: die erste).

### Szenen

Auslöser, einmal pro Änderung und nie zweimal für denselben Tag:

- **Atmo: Luftqualität verschlechtert**: Der Index von heute oder morgen erreicht „Mäßig“ oder schlechter oder verschlechtert sich weiter.
- **Atmo: Schadstoffepisode**: Ein Informations- oder Alarmverfahren wird angekündigt oder steigt auf eine höhere Stufe.
- **Atmo: Pollenrisiko**: Das Pollenrisiko erreicht „Mäßig“ oder mehr oder steigt.
- **Atmo: Prognose für morgen**: einmal täglich am Nachmittag veröffentlicht.

Jeder liefert einen fertigen Satz, `{{triggerEvent.data.summary}}`, und seine Werte (Stufe, Schadstoffe, Pollen …). Die Aktion **Atmo: Luftqualität lesen** liefert dieselben Werte für heute oder morgen, für eine Nachricht oder eine Bedingung.

Beispiele:

- Wenn für morgen eine Alarm-Episode angekündigt wird → die Zusammenfassung an die Familie senden.
- Wenn die Prognose für morgen veröffentlicht wird → sie jeden Nachmittag senden.
- Wenn die Gräserpollen hoch sind → die Rollläden im Schlafzimmer schließen.

### Transport

Nur Cloud: Die Daten kommen aus dem Internet (Atmo Data und geo.api.gouv.fr). Nur Ihr Konto, die Koordinaten des gewählten Hauses und die Gemeinden verlassen Ihr Netzwerk.

## Fehlerbehebung

- **„hat Benutzernamen oder Passwort abgelehnt“**: Prüfen Sie beide und ob Atmo France Ihr Konto freigeschaltet hat (Bestätigungs-E-Mail). Ein abgelehntes Passwort wird erst bei der nächsten Abfrage erneut versucht.
- **„Gemeinde nicht gefunden“**: Das Haus hat keinen Standort, oder der Name ist mehrdeutig: Geben Sie „Name Postleitzahl“ oder den INSEE-Code ein.
- **Kein Wert für eine Gemeinde**: Manche Regionen veröffentlichen nur je Gemeindeverband, den die Integration dann stattdessen liest; um die tägliche Aktualisierung herum kann ein Wert einige Stunden fehlen.
- **„zu viele Anfragen“**: Atmo Data hat um Geduld gebeten; die Integration wartet die verlangte Zeit.
- **Ein Problem melden**: Drücken Sie **Diagnose** und kopieren Sie die Zeilen, die im Tab Protokolle mit „Atmo diagnostic“ beginnen, in ein Issue auf GitHub oder eine Antwort im Forum, mit den Versionen von Gladys und der Integration. Sie enthalten weder Ihren Benutzernamen noch Ihr Passwort.
