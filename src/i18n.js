// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, levels, widget contents, scene
// summaries, messages of the Configuration screen. Vocabulary of the Gladys
// interface (appareil / Gerät / dispositivo, scène / Szene / escena) and of
// the official ATMO index (Bon, Moyen, Dégradé, Mauvais, Très mauvais,
// Extrêmement mauvais; the European Air Quality Index wording elsewhere).
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: {
    en: 'Air quality {commune}',
    fr: 'Qualité de l’air {commune}',
    de: 'Luftqualität {commune}',
    es: 'Calidad del aire {commune}',
  },
  feature_index: {
    en: 'ATMO index today',
    fr: 'Indice ATMO aujourd’hui',
    de: 'ATMO-Index heute',
    es: 'Índice ATMO hoy',
  },
  feature_index_tomorrow: {
    en: 'ATMO index tomorrow',
    fr: 'Indice ATMO demain',
    de: 'ATMO-Index morgen',
    es: 'Índice ATMO mañana',
  },
  feature_quality: {
    en: 'Air quality today',
    fr: 'Qualité de l’air aujourd’hui',
    de: 'Luftqualität heute',
    es: 'Calidad del aire hoy',
  },
  feature_pollutant: {
    en: '{pollutant} sub-index today',
    fr: 'Sous-indice {pollutant} aujourd’hui',
    de: '{pollutant}-Teilindex heute',
    es: 'Subíndice {pollutant} hoy',
  },
  feature_episode: {
    en: 'Pollution episode today',
    fr: 'Épisode de pollution aujourd’hui',
    de: 'Schadstoffepisode heute',
    es: 'Episodio de contaminación hoy',
  },
  feature_episode_tomorrow: {
    en: 'Pollution episode tomorrow',
    fr: 'Épisode de pollution demain',
    de: 'Schadstoffepisode morgen',
    es: 'Episodio de contaminación mañana',
  },
  feature_pollen: {
    en: 'Pollen index today',
    fr: 'Indice pollens aujourd’hui',
    de: 'Pollenindex heute',
    es: 'Índice de polen hoy',
  },
  feature_pollen_tomorrow: {
    en: 'Pollen index tomorrow',
    fr: 'Indice pollens demain',
    de: 'Pollenindex morgen',
    es: 'Índice de polen mañana',
  },
  feature_pollen_taxa: {
    en: 'Main pollen today',
    fr: 'Pollen responsable aujourd’hui',
    de: 'Hauptpollen heute',
    es: 'Polen principal hoy',
  },
  feature_taxon: {
    en: '{taxon} pollen today',
    fr: 'Pollen {taxon} aujourd’hui',
    de: 'Pollen {taxon} heute',
    es: 'Polen {taxon} hoy',
  },

  // ATMO index levels (1 to 6, 0 unavailable, 7 or 8 a special event)
  atmo_0: { en: 'Unavailable', fr: 'Indisponible', de: 'Nicht verfügbar', es: 'No disponible' },
  atmo_1: { en: 'Good', fr: 'Bon', de: 'Gut', es: 'Buena' },
  atmo_2: { en: 'Fair', fr: 'Moyen', de: 'Mittelmäßig', es: 'Razonable' },
  atmo_3: { en: 'Moderate', fr: 'Dégradé', de: 'Mäßig', es: 'Moderada' },
  atmo_4: { en: 'Poor', fr: 'Mauvais', de: 'Schlecht', es: 'Mala' },
  atmo_5: { en: 'Very poor', fr: 'Très mauvais', de: 'Sehr schlecht', es: 'Muy mala' },
  atmo_6: {
    en: 'Extremely poor',
    fr: 'Extrêmement mauvais',
    de: 'Extrem schlecht',
    es: 'Extremadamente mala',
  },
  atmo_event: {
    en: 'Special event',
    fr: 'Événement',
    de: 'Sonderereignis',
    es: 'Evento especial',
  },

  // Pollen allergy risk levels (1 to 6)
  pollen_0: { en: 'Unavailable', fr: 'Indisponible', de: 'Nicht verfügbar', es: 'No disponible' },
  pollen_1: { en: 'Very low', fr: 'Très faible', de: 'Sehr gering', es: 'Muy bajo' },
  pollen_2: { en: 'Low', fr: 'Faible', de: 'Gering', es: 'Bajo' },
  pollen_3: { en: 'Moderate', fr: 'Modéré', de: 'Mäßig', es: 'Moderado' },
  pollen_4: { en: 'High', fr: 'Élevé', de: 'Hoch', es: 'Alto' },
  pollen_5: { en: 'Very high', fr: 'Très élevé', de: 'Sehr hoch', es: 'Muy alto' },
  pollen_6: {
    en: 'Extremely high',
    fr: 'Extrêmement élevé',
    de: 'Extrem hoch',
    es: 'Extremadamente alto',
  },
  // ≤ 16 characters, for the widget badges
  pollenShort_6: { en: 'Extreme', fr: 'Extrême', de: 'Extrem hoch', es: 'Extremo' },

  // Pollution episodes (prefectoral procedures)
  episode_0: { en: 'None', fr: 'Aucun', de: 'Keine', es: 'Ninguno' },
  episode_1: {
    en: 'Information and advice',
    fr: 'Information et recommandation',
    de: 'Information und Empfehlungen',
    es: 'Información y recomendaciones',
  },
  episode_2: {
    en: 'Alert on persistence',
    fr: 'Alerte sur persistance',
    de: 'Alarm wegen Andauern',
    es: 'Alerta por persistencia',
  },
  episode_3: { en: 'Alert', fr: 'Alerte', de: 'Alarm', es: 'Alerta' },
  episodeShort_1: { en: 'Information', fr: 'Information', de: 'Information', es: 'Información' },
  episodeShort_2: {
    en: 'Persistence alert',
    fr: 'Alerte persistance',
    de: 'Alarm (Andauern)',
    es: 'Alerta persistencia',
  },

  // pollutants
  pollutant_no2: { en: 'NO₂', fr: 'NO₂', de: 'NO₂', es: 'NO₂' },
  pollutant_o3: { en: 'O₃', fr: 'O₃', de: 'O₃', es: 'O₃' },
  pollutant_pm10: { en: 'PM10', fr: 'PM10', de: 'PM10', es: 'PM10' },
  pollutant_pm25: { en: 'PM2.5', fr: 'PM2,5', de: 'PM2,5', es: 'PM2,5' },
  pollutant_so2: { en: 'SO₂', fr: 'SO₂', de: 'SO₂', es: 'SO₂' },

  // pollen taxa
  taxon_ambr: { en: 'Ragweed', fr: 'Ambroisie', de: 'Ambrosia', es: 'Ambrosía' },
  taxon_arm: { en: 'Mugwort', fr: 'Armoise', de: 'Beifuß', es: 'Artemisa' },
  taxon_aul: { en: 'Alder', fr: 'Aulne', de: 'Erle', es: 'Aliso' },
  taxon_boul: { en: 'Birch', fr: 'Bouleau', de: 'Birke', es: 'Abedul' },
  taxon_gram: { en: 'Grasses', fr: 'Graminées', de: 'Gräser', es: 'Gramíneas' },
  taxon_oliv: { en: 'Olive', fr: 'Olivier', de: 'Olive', es: 'Olivo' },

  // days
  day_today: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  day_tomorrow: { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  dayLower_today: { en: 'today', fr: 'aujourd’hui', de: 'heute', es: 'hoy' },
  dayLower_tomorrow: { en: 'tomorrow', fr: 'demain', de: 'morgen', es: 'mañana' },
  unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  notPublished: {
    en: 'Not published yet',
    fr: 'Pas encore publié',
    de: 'Noch nicht veröffentlicht',
    es: 'Aún no publicado',
  },

  // summaries (scene variables and outputs)
  summaryIndex: {
    en: 'Air quality {day} in {commune}: {label} (ATMO {level}/6){pollutants}.',
    fr: 'Qualité de l’air {day} à {commune} : {label} (ATMO {level}/6){pollutants}.',
    de: 'Luftqualität {day} in {commune}: {label} (ATMO {level}/6){pollutants}.',
    es: 'Calidad del aire {day} en {commune}: {label} (ATMO {level}/6){pollutants}.',
  },
  summaryPollutants: {
    en: ', because of {list}',
    fr: ', à cause de : {list}',
    de: ', wegen {list}',
    es: ', por {list}',
  },
  summaryIndexUnknown: {
    en: 'Air quality {day} in {commune}: not published yet.',
    fr: 'Qualité de l’air {day} à {commune} : pas encore publiée.',
    de: 'Luftqualität {day} in {commune}: noch nicht veröffentlicht.',
    es: 'Calidad del aire {day} en {commune}: aún no publicada.',
  },
  summaryEpisode: {
    en: 'Pollution episode {day} in {department}: {label} ({pollutants}).',
    fr: 'Épisode de pollution {day} ({department}) : {label} ({pollutants}).',
    de: 'Schadstoffepisode {day} in {department}: {label} ({pollutants}).',
    es: 'Episodio de contaminación {day} en {department}: {label} ({pollutants}).',
  },
  summaryPollen: {
    en: 'Pollen {day} in {commune}: {label} ({level}/6){taxa}.',
    fr: 'Pollens {day} à {commune} : {label} ({level}/6){taxa}.',
    de: 'Pollen {day} in {commune}: {label} ({level}/6){taxa}.',
    es: 'Polen {day} en {commune}: {label} ({level}/6){taxa}.',
  },
  summaryTaxa: {
    en: ', mostly {list}',
    fr: ', surtout : {list}',
    de: ', vor allem {list}',
    es: ', sobre todo {list}',
  },

  // widgets
  widgetUpdated: { en: 'Updated', fr: 'Mise à jour', de: 'Aktualisiert', es: 'Actualizado' },
  widgetSource: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
  widgetEpisodeToday: {
    en: 'Episode today',
    fr: 'Épisode aujourd’hui',
    de: 'Episode heute',
    es: 'Episodio hoy',
  },
  widgetEpisodeTomorrow: {
    en: 'Episode tomorrow',
    fr: 'Épisode demain',
    de: 'Episode morgen',
    es: 'Episodio mañana',
  },
  widgetPollen: { en: 'Pollen', fr: 'Pollens', de: 'Pollen', es: 'Polen' },
  widgetMainPollen: {
    en: 'Main pollen',
    fr: 'Pollen responsable',
    de: 'Hauptpollen',
    es: 'Polen principal',
  },
  widgetPollenToday: {
    en: 'Pollen today',
    fr: 'Pollens aujourd’hui',
    de: 'Pollen heute',
    es: 'Polen hoy',
  },
  widgetPollenTomorrow: {
    en: 'Pollen tomorrow',
    fr: 'Pollens demain',
    de: 'Pollen morgen',
    es: 'Polen mañana',
  },
  widgetCardTitle: {
    en: '{day}: {label}',
    fr: '{day} : {label}',
    de: '{day}: {label}',
    es: '{day}: {label}',
  },
  widgetBadge: { en: 'ATMO {level}', fr: 'ATMO {level}', de: 'ATMO {level}', es: 'ATMO {level}' },
  widgetSubIndices: {
    en: 'Sub-indices: {list}.',
    fr: 'Sous-indices : {list}.',
    de: 'Teilindizes: {list}.',
    es: 'Subíndices: {list}.',
  },
  widgetEpisodeLine: {
    en: 'Pollution episode: {label}.',
    fr: 'Épisode de pollution : {label}.',
    de: 'Schadstoffepisode: {label}.',
    es: 'Episodio de contaminación: {label}.',
  },
  widgetPollenLine: {
    en: 'Pollen: {label}.',
    fr: 'Pollens : {label}.',
    de: 'Pollen: {label}.',
    es: 'Polen: {label}.',
  },
  widgetScale: {
    en: '1 good to 6 extremely poor',
    fr: '1 bon à 6 extrêmement mauvais',
    de: '1 gut bis 6 extrem schlecht',
    es: '1 buena a 6 extremadamente mala',
  },
  widgetNoPlace: {
    en: 'No commune is configured: add a house or a commune in the configuration of the integration.',
    fr: 'Aucune commune n’est configurée : ajoutez une maison ou une commune dans la configuration de l’intégration.',
    de: 'Keine Gemeinde konfiguriert: Fügen Sie in der Konfiguration der Integration ein Haus oder eine Gemeinde hinzu.',
    es: 'No hay ningún municipio configurado: añada una casa o un municipio en la configuración de la integración.',
  },
  widgetNotRead: {
    en: 'The data of Atmo France have not been read yet: see the status of the integration.',
    fr: 'Les données d’Atmo France n’ont pas encore été lues : voir l’état de l’intégration.',
    de: 'Die Daten von Atmo France wurden noch nicht gelesen: siehe Status der Integration.',
    es: 'Los datos de Atmo France aún no se han leído: vea el estado de la integración.',
  },
  widgetNoPollen: {
    en: 'Pollen is not read: turn on “Pollen” in the configuration of the integration.',
    fr: 'Les pollens ne sont pas lus : activez « Pollens » dans la configuration de l’intégration.',
    de: 'Pollen werden nicht gelesen: Aktivieren Sie „Pollen“ in der Konfiguration der Integration.',
    es: 'El polen no se lee: active «Polen» en la configuración de la integración.',
  },
  widgetNoPollenData: {
    en: 'Atmo France publishes no pollen data for this commune at the moment.',
    fr: 'Atmo France ne publie pas de données pollens pour cette commune en ce moment.',
    de: 'Atmo France veröffentlicht derzeit keine Pollendaten für diese Gemeinde.',
    es: 'Atmo France no publica datos de polen para este municipio por ahora.',
  },

  // connection status and configuration actions
  statusConnected: {
    en: 'Connected to Atmo Data: {places}. Next update around {next}.',
    fr: 'Connecté à Atmo Data : {places}. Prochaine mise à jour vers {next}.',
    de: 'Mit Atmo Data verbunden: {places}. Nächste Aktualisierung gegen {next}.',
    es: 'Conectado a Atmo Data: {places}. Próxima actualización hacia las {next}.',
  },
  noCredentials: {
    en: 'Enter the user name and the password of your Atmo Data account.',
    fr: 'Saisissez l’identifiant et le mot de passe de votre compte Atmo Data.',
    de: 'Geben Sie den Benutzernamen und das Passwort Ihres Atmo-Data-Kontos ein.',
    es: 'Introduzca el usuario y la contraseña de su cuenta de Atmo Data.',
  },
  noPlaces: {
    en: 'Choose a house of Gladys or type a commune in the configuration.',
    fr: 'Choisissez une maison de Gladys ou saisissez une commune dans la configuration.',
    de: 'Wählen Sie in der Konfiguration ein Haus von Gladys oder geben Sie eine Gemeinde ein.',
    es: 'Elija una casa de Gladys o escriba un municipio en la configuración.',
  },
  statusAuth: {
    en: 'Atmo Data refused the user name or the password. Check them, and that your account has been validated by Atmo France.',
    fr: 'Atmo Data a refusé l’identifiant ou le mot de passe. Vérifiez-les, et que votre compte a bien été validé par Atmo France.',
    de: 'Atmo Data hat Benutzernamen oder Passwort abgelehnt. Prüfen Sie beide und ob Ihr Konto von Atmo France freigeschaltet wurde.',
    es: 'Atmo Data rechazó el usuario o la contraseña. Compruébelos y que Atmo France haya validado su cuenta.',
  },
  statusRateLimited: {
    en: 'Atmo Data asks to wait before the next request (too many requests). New try in {minutes} min.',
    fr: 'Atmo Data demande d’attendre avant la prochaine requête (trop de requêtes). Nouvel essai dans {minutes} min.',
    de: 'Atmo Data bittet, vor der nächsten Anfrage zu warten (zu viele Anfragen). Neuer Versuch in {minutes} Min.',
    es: 'Atmo Data pide esperar antes de la próxima petición (demasiadas peticiones). Nuevo intento en {minutes} min.',
  },
  statusUnreachable: {
    en: 'Atmo Data cannot be reached ({detail}). New try in {minutes} min.',
    fr: 'Atmo Data est injoignable ({detail}). Nouvel essai dans {minutes} min.',
    de: 'Atmo Data ist nicht erreichbar ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'No se puede acceder a Atmo Data ({detail}). Nuevo intento en {minutes} min.',
  },
  statusPlace: {
    en: 'Commune not found for {place}: {detail}',
    fr: 'Commune introuvable pour {place} : {detail}',
    de: 'Gemeinde für {place} nicht gefunden: {detail}',
    es: 'Municipio no encontrado para {place}: {detail}',
  },
  placeHouse: {
    en: 'house “{name}”',
    fr: 'la maison « {name} »',
    de: 'Haus „{name}“',
    es: 'la casa «{name}»',
  },
  placeSlot: { en: 'place {slot}', fr: 'le lieu {slot}', de: 'Ort {slot}', es: 'el lugar {slot}' },
  placeNoLocation: {
    en: 'the house has no location in Gladys: set it in Settings > Houses, or type the commune.',
    fr: 'la maison n’a pas de position dans Gladys : renseignez-la dans Paramètres > Maisons, ou saisissez la commune.',
    de: 'Das Haus hat in Gladys keinen Standort: Legen Sie ihn unter Einstellungen > Häuser fest oder geben Sie die Gemeinde ein.',
    es: 'la casa no tiene ubicación en Gladys: indíquela en Ajustes > Casas o escriba el municipio.',
  },
  placeUnknownHouse: {
    en: 'this house no longer exists in Gladys.',
    fr: 'cette maison n’existe plus dans Gladys.',
    de: 'dieses Haus existiert in Gladys nicht mehr.',
    es: 'esta casa ya no existe en Gladys.',
  },
  placeNotFound: {
    en: '“{query}” matches no French commune.',
    fr: '« {query} » ne correspond à aucune commune française.',
    de: '„{query}“ entspricht keiner französischen Gemeinde.',
    es: '«{query}» no corresponde a ningún municipio francés.',
  },
  placeOutside: {
    en: 'the house is outside France: Atmo France covers only French communes.',
    fr: 'la maison est hors de France : Atmo France ne couvre que les communes françaises.',
    de: 'das Haus liegt außerhalb Frankreichs: Atmo France deckt nur französische Gemeinden ab.',
    es: 'la casa está fuera de Francia: Atmo France solo cubre municipios franceses.',
  },
  placeGeoError: {
    en: 'the commune service of the French government did not answer ({detail}).',
    fr: 'le service des communes de l’État n’a pas répondu ({detail}).',
    de: 'der Gemeindedienst des französischen Staates hat nicht geantwortet ({detail}).',
    es: 'el servicio de municipios del Estado francés no respondió ({detail}).',
  },
  refreshDone: {
    en: 'Data read for {places}. Today: {today}.',
    fr: 'Données lues pour {places}. Aujourd’hui : {today}.',
    de: 'Daten gelesen für {places}. Heute: {today}.',
    es: 'Datos leídos para {places}. Hoy: {today}.',
  },
  refreshTooSoon: {
    en: 'The data were read {minutes} min ago: Atmo France updates them once a day. Try again later.',
    fr: 'Les données ont été lues il y a {minutes} min : Atmo France les met à jour une fois par jour. Réessayez plus tard.',
    de: 'Die Daten wurden vor {minutes} Min. gelesen: Atmo France aktualisiert sie einmal am Tag. Später erneut versuchen.',
    es: 'Los datos se leyeron hace {minutes} min: Atmo France los actualiza una vez al día. Inténtelo más tarde.',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab of the integration ({count} line(s)). Copy the lines starting with “Atmo diagnostic” into your report: the user name and the password are left out.',
    fr: 'Diagnostic écrit dans l’onglet Journaux de l’intégration ({count} ligne(s)). Copiez les lignes commençant par « Atmo diagnostic » dans votre retour : l’identifiant et le mot de passe en sont retirés.',
    de: 'Diagnose in den Tab Protokolle der Integration geschrieben ({count} Zeile(n)). Kopieren Sie die Zeilen, die mit „Atmo diagnostic“ beginnen, in Ihre Meldung: Benutzername und Passwort sind entfernt.',
    es: 'Diagnóstico escrito en la pestaña Registros de la integración ({count} línea(s)). Copie las líneas que empiezan por «Atmo diagnostic» en su informe: el usuario y la contraseña se omiten.',
  },
  unknownAction: {
    en: 'Unknown action.',
    fr: 'Action inconnue.',
    de: 'Unbekannte Aktion.',
    es: 'Acción desconocida.',
  },
};

/**
 * @description Whether a value is one of the languages of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('deviceName', 'fr', { commune: 'Mâcon' }); // -> 'Qualité de l’air Mâcon'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object|Function} [values] - The substitutions, or `(language) => values`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description A list joined the way a language does ("NO₂ et O₃").
 * @param {string[]} items - The items.
 * @param {string} language - The language.
 * @returns {string} The list.
 */
function joinList(items, language) {
  return new Intl.ListFormat(isLanguage(language) ? language : 'en', {
    style: 'long',
    type: 'conjunction',
  }).format(items);
}

/**
 * @description Label of an ATMO index level.
 * @param {number|null} level - The level (1-6, 0, 7 or 8).
 * @param {string} language - The language.
 * @returns {string} The label, "Not published yet" when null.
 */
function atmoLabel(level, language) {
  if (level === null || level === undefined) {
    return t('notPublished', language);
  }
  return level >= 7 ? t('atmo_event', language) : t(`atmo_${level}`, language);
}

/**
 * @description Label of a pollen level.
 * @param {number|null} level - The level (1-6, 0).
 * @param {string} language - The language.
 * @returns {string} The label.
 */
function pollenLabel(level, language) {
  if (level === null || level === undefined) {
    return t('notPublished', language);
  }
  return t(`pollen_${Math.min(6, Math.max(0, level))}`, language);
}

/**
 * @description Label of a pollution episode level.
 * @param {number|null} level - 0 to 3.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
function episodeLabel(level, language) {
  return t(`episode_${level ?? 0}`, language);
}

/**
 * @description An instant written the short way of a language ("16/10 13:12").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortDateTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

/**
 * @description A time of day ("15:42").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

export {
  LANGUAGES,
  TEXTS,
  isLanguage,
  t,
  all,
  joinList,
  atmoLabel,
  pollenLabel,
  episodeLabel,
  shortDateTime,
  shortTime,
};
