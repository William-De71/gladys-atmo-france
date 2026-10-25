# Atmo France

## Présentation

Cette intégration apporte dans Gladys l’**indice officiel de qualité de l’air ATMO**, pour une à trois communes : l’indice d’aujourd’hui et de demain, les sous-indices des cinq polluants (NO₂, O₃, PM10, PM2,5, SO₂), les **épisodes de pollution** annoncés pour le département et, si vous le souhaitez, le **risque d’allergie aux pollens**. Chaque commune devient un appareil à afficher sur un tableau de bord et à utiliser dans les scènes.

Les données viennent d’**Atmo Data**, le service de données ouvertes de la Fédération Atmo France et des associations régionales de surveillance de la qualité de l’air (AASQA). Elles sont publiées une fois par jour, en début d’après-midi. L’intégration les lit deux fois par jour (vers 7 h 30 et 15 h 30, heure de Paris) et les garde, si bien qu’un redémarrage ne coûte aucune requête.

C’est une intégration **cloud** : elle contacte `admindata.atmo-france.org` avec votre compte, et `geo.api.gouv.fr` (le service ouvert des communes de l’État) pour trouver la commune de votre maison.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un compte Atmo Data gratuit. Demandez-le sur <https://admindata.atmo-france.org/inscription-api> : Atmo France valide la demande par e-mail, en général sous quelques jours, puis vous choisissez votre mot de passe.
- La position de votre maison dans Gladys (Paramètres > Maisons), ou le nom de la commune à suivre. Les communes de métropole, de Corse et d’outre-mer sont couvertes.

## Configuration

| Champ                     | Que saisir                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Identifiant, Mot de passe | Le compte Atmo Data.                                                                                         |
| Maison                    | Une maison de Gladys : sa position donne la commune.                                                         |
| Ou une commune            | « Mâcon », « 71000 », « Saint-Denis 93200 » ou le code INSEE. Renseignée, elle prime sur la maison.          |
| Lieu 2, Lieu 3            | D’autres communes (résidence secondaire, travail, école). Facultatif.                                        |
| Pollens                   | Lire aussi le risque pollens. Le changer ajoute ou retire des fonctionnalités : mettez à jour les appareils. |
| Langue des textes         | Noms des appareils, qualité de l’air en texte et résumés des scènes.                                         |

Enregistrez : l’état en haut de la page affiche les communes trouvées, la qualité de l’air du jour et l’heure de la prochaine lecture. **Lire maintenant** relit tout de suite (au plus toutes les 10 minutes).

## Utilisation

### Appareils

Dans l’onglet **Découverte**, créez l’appareil « Qualité de l’air … » de chaque commune. Il contient :

- l’indice ATMO d’aujourd’hui et de demain, de 1 (bon) à 6 (extrêmement mauvais), et la qualité de l’air en texte ;
- le sous-indice de chaque polluant aujourd’hui, de 1 à 6 : un niveau, pas une concentration en µg/m³ ;
- l’épisode de pollution du département aujourd’hui et demain : 0 aucun, 1 information et recommandation, 2 alerte sur persistance, 3 alerte (affiché par Gladys comme risque nul, faible, moyen ou élevé) ;
- avec les pollens : l’indice pollens d’aujourd’hui et de demain, le pollen responsable, et le niveau de l’ambroisie, de l’armoise, de l’aulne, du bouleau, des graminées et de l’olivier aujourd’hui.

Quand Atmo France n’a pas de valeur pour un jour, ou annonce un événement (un incendie), rien n’est publié. Le badge de l’indice reste vert dans Gladys quelle que soit sa valeur (Gladys le colore sur l’échelle américaine, de 0 à 500) : utilisez les widgets pour voir les bonnes couleurs. Les fonctionnalités « demain » gardent la prévision précédente entre minuit et la lecture de l’après-midi.

### Widgets du tableau de bord

![Le widget Qualité de l’air pour Bordeaux (sous-indices, aujourd’hui et demain, épisodes, pollens) et le widget Pollens (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-atmo-france/main/docs/assets/widgets.fr.png)

- **Qualité de l’air** : les sous-indices du jour, une carte pour aujourd’hui et une pour demain (touchez-la pour le détail), les épisodes, les pollens, la source et l’heure de mise à jour.
- **Pollens** : le risque aujourd’hui et demain et le niveau de chaque taxon.

Choisissez la commune dans les réglages du widget (vide : la première).

### Scènes

Déclencheurs, une fois par changement et jamais deux fois pour le même jour :

- **Atmo : qualité de l’air dégradée** : l’indice d’aujourd’hui ou de demain passe à « Dégradé » ou pire, ou s’aggrave encore.
- **Atmo : épisode de pollution** : une procédure d’information ou d’alerte est annoncée, ou passe à un niveau supérieur.
- **Atmo : risque pollens** : le risque pollens atteint « Modéré » ou plus, ou augmente.
- **Atmo : prévision de demain** : publiée une fois par jour, l’après-midi.

Chacun fournit une phrase toute prête, `{{triggerEvent.data.summary}}`, et ses valeurs (niveau, polluants, pollens…). L’action **Atmo : lire la qualité de l’air** renvoie les mêmes valeurs pour aujourd’hui ou demain, à mettre dans un message ou à tester dans une condition.

Exemples :

- Quand un épisode d’alerte est annoncé pour demain → envoyer le résumé à la famille.
- Quand la prévision de demain est publiée → l’envoyer chaque après-midi.
- Quand les graminées sont élevées → fermer les volets de la chambre.

### Transport

Cloud uniquement : les données viennent d’Internet (Atmo Data et geo.api.gouv.fr). Seuls votre compte, les coordonnées de la maison choisie et les communes sortent de votre réseau.

## Dépannage

- **« a refusé l’identifiant ou le mot de passe »** : vérifiez-les, et qu’Atmo France a bien validé votre compte (e-mail de validation). Un mot de passe refusé n’est pas réessayé avant la lecture suivante.
- **« Commune introuvable »** : la maison n’a pas de position, ou le nom est ambigu : saisissez « nom code postal », ou le code INSEE.
- **Pas de valeur pour une commune** : certaines régions ne publient que par intercommunalité, que l’intégration lit alors à la place ; une valeur peut manquer quelques heures autour de la mise à jour quotidienne.
- **« trop de requêtes »** : Atmo Data a demandé d’attendre ; l’intégration attend le temps demandé.
- **Pour signaler un problème** : appuyez sur **Diagnostic**, puis copiez les lignes commençant par « Atmo diagnostic » de l’onglet Journaux dans une issue GitHub ou une réponse sur le forum, avec les versions de Gladys et de l’intégration. Elles ne contiennent ni votre identifiant ni votre mot de passe.
