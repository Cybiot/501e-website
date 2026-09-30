# Spécifications — Site de la communauté RP « 501st PIR » (Squad 44) — version simplifiée

> **Version** : 2.1. **Langue du site** : français uniquement. **Lecteur** : une IA de génération de code (ou un développeur) chargée de produire un projet **simple, fonctionnel et facile à maintenir**.

## Sommaire

1. Cahier des charges fonctionnel
2. Architecture technique
3. Modèle de données
4. Spécifications API
5. Sécurité / RGPD
6. Plan de développement

## Règles de conduite pour l'IA

1. Lis tout le document avant de coder.
2. **Simplicité d'abord** : aucune **fonctionnalité** ni **service** hors de ce document. Les bibliothèques techniques indispensables à une fonctionnalité décrite (gestionnaire de sessions, clustering Leaflet, rendu Markdown, limiteur de débit…) sont autorisées : les lister dans le README. En cas de doute, l'option la plus simple.
3. **Discord est la source de vérité** pour les rôles : grade, responsabilités et attribution des rôles de médailles. La base ne garde qu'une **copie de lecture** (grade, responsabilités) recalculée à chaque synchro, et l'historique des attributions de médailles (motif, date, auteur), qui n'existe pas dans Discord.
4. Aucun identifiant Discord (serveur, rôle, salon) et aucune URL d'invitation en dur dans le code : tout passe par `.env` ou `config/discord-roles.json`.
5. **MUST** = obligatoire, **SHOULD** = recommandé, **MAY** = optionnel (à ne pas faire par défaut).

------

## 1. Cahier des charges fonctionnel

### 1.1 Contexte et objectif

Communauté francophone de jeu de rôle sur **Squad 44**, incarnant le 501st Parachute Infantry Regiment (101st Airborne, Seconde Guerre mondiale).

Le site est une **vitrine + un annuaire des membres**, avec un **espace membre léger** et quelques **outils admin**. Look moderne et sobre ; le thème militaire n'apparaît que par touches discrètes.

### 1.2 Périmètre par phase

| Phase | Contenu |
|---|---|
| **V1 (MVP)** | Vitrine, annuaire des membres, **carte du monde des membres**, connexion Discord, Mon profil, attribution de médailles + annonce Discord, pages légales |
| **V2** | Batailles (publiques + dossier confidentiel membres), suivi des formations |
| **V3 (si besoin)** | Images personnalisées avec modération, notifications admin |

> **Ne réaliser que la V1** tant que le commanditaire ne demande pas la suite, en gardant le code ouvert à l'ajout de modules.

### 1.3 Acteurs et droits

Trois niveaux : **Visiteur < Membre < Admin** (chaque niveau hérite du précédent).

| Fonctionnalité | Visiteur | Membre | Admin |
|---|:-:|:-:|:-:|
| Vitrine, annuaire, fiches membres | ✅ | ✅ | ✅ |
| Carte du monde des membres | | ✅ | ✅ |
| Mon profil | | ✅ | ✅ |
| Attribuer / retirer des médailles, annoncer | | | ✅ |

- Le statut est calculé depuis les **rôles Discord** de la personne sur le serveur. **Admin implique Membre** : une personne ayant un rôle admin est traitée comme membre même sans rôle membre (elle a donc une fiche `User`).
- Une personne connectée **sans rôle membre** est traitée comme un visiteur (bandeau « Rejoins-nous »).
- Un badge de statut (Visiteur / Membre / Admin) est visible dans le menu utilisateur.

### 1.4 Connexion

- Bouton « Se connecter avec Discord » ; aucune autre méthode (pas de mot de passe).
- **Première connexion d'un membre** : une modale de consentement (« J'accepte que mon profil soit affiché publiquement »), avec deux boutons *Accepter* / *Refuser*.
  - *Accepter* : `publicProfile = true`, `consentAt` renseigné.
  - *Refuser* : le membre **garde l'accès complet à l'espace membre**, `publicProfile = false`. Il peut l'activer plus tard dans Mon profil (ce qui enregistre alors le consentement).
  - Tant que la modale n'a pas été traitée, le profil reste masqué au public.
- **Personnes sans rôle membre** : elles sont traitées comme des visiteurs et **aucune donnée les concernant n'est enregistrée en base** (la session ne contient que l'identifiant Discord et le statut calculé).
- Déconnexion depuis le menu avatar.
- Erreurs claires : autorisation refusée, Discord indisponible.

### 1.5 Pages (V1)

```
/                    Accueil (hero, chiffres clés, membres à l'honneur, FAQ courte)
/communaute          Présentation, valeurs, règlement résumé, histoire du 501st
/membres             Annuaire
/membres/:id         Fiche membre
/carte               [Membre] Carte du monde des membres
/rejoindre           Étapes + bouton « Rejoindre la 501e »
/profil              [Membre] Mon profil
/admin/medailles     [Admin] Attribution + annonce
/mentions-legales, /confidentialite
```

Navigation : Accueil · La communauté · Membres · Rejoindre · [Se connecter] ; membre : + Carte · Mon profil ; admin : + Administration.

### 1.6 Fonctionnalités V1

**F1 — Vitrine.** Contenu éditorial en **Markdown dans le dépôt** (pas de CMS), avec des placeholders sans faits historiques inventés. Le bouton « Rejoindre la 501e » redirige vers l'URL configurée dans `DISCORD_INVITE_URL`. Si `DISCORD_APPLY_URL` (lien du salon « Postuler ») est renseignée, un second bouton « Postuler » y mène. `.env.example` ne contient que des **valeurs d'exemple** (`https://discord.gg/exemple`) ; le commanditaire renseigne les vraies dans son `.env`. Rien de réel dans le code ni dans le dépôt.
Le bloc « chiffres clés » de l'accueil n'affiche en V1 que **le nombre de membres** (calculé) et **l'année de création** (`COMMUNITY_FOUNDED_YEAR`) ; pas de compteur de batailles avant la V2. Les « membres à l'honneur » sont les 3 dernières personnes ayant reçu une médaille (profil public uniquement) ; le bloc est **masqué** s'il n'y en a aucune.

**F2 — Annuaire des membres.**

- Liste : cartes « plaque d'identité » (nom, grade, 2–3 médailles + N, responsabilités), recherche par nom, filtre par grade, pagination.
- Fiche : nom, grade, ancienneté, phrase personnalisée, médailles (nom, description, date, motif), responsabilités.
- Seuls les **membres** apparaissent. Un profil masqué disparaît de la liste **pour les visiteurs** et sa fiche leur renvoie **404** ; il reste visible des autres membres connectés.
- Le nom affiché est le **pseudo du serveur** (`nick`) s'il existe, sinon le nom global Discord, rafraîchi à chaque synchro.
- Le champ `:id` des URLs est l'**UUID interne** (jamais l'ID Discord).
- Aux membres connectés, l'annuaire inclut aussi les membres importés qui ne se sont pas encore connectés (voir §2.5), mais **seuls ceux ayant accepté le profil public apparaissent aux visiteurs**.

**F3 — Mon profil.**
- Consulter : identité Discord, grade, responsabilités, médailles, ancienneté.
- Modifier : **phrase personnalisée** (140 caractères max, compteur), **visibilité publique** (interrupteur) et **mes villes** (lien vers la carte).
- Droits RGPD : « Télécharger mes données » (JSON), « Supprimer mon compte » (avec confirmation).
- Grade, médailles, responsabilités : non modifiables (gérés via Discord).

**F3 bis — Carte du monde des membres (membres uniquement).**
- Carte interactive (Leaflet) avec un **marqueur par ville déclarée** (simple pin) et **regroupement (clustering)** quand ils se chevauchent.
- **Technique** : la carte est un composant **chargé uniquement dans le navigateur** (jamais exécuté lors du rendu serveur, sinon erreur « window is not defined »). Leaflet + plugin `leaflet.markercluster`. Fond de carte : tuiles **OpenStreetMap publiques**, URL et attribution paramétrables via `TILE_URL` / `TILE_ATTRIBUTION` pour pouvoir changer de fournisseur sans toucher au code.
- Clic sur un marqueur : mini-carte du membre (nom, grade, phrase, lien vers sa fiche) et ville.
- **Recherche** d'un membre (zoom automatique) et filtre par grade ; liste des membres par pays en complément (utile sur mobile).
- Panneau **« Mes villes »** : ajouter jusqu'à **2 villes** via un champ sans autocomplétion et supprimer à tout moment.
- Règles :
  - **2 villes maximum** par membre (message clair à la 3ᵉ), précision **ville uniquement**, jamais d'adresse ;
  - coordonnées **arrondies à 2 décimales** (~1 km) au stockage ;
  - **opt-in explicite**, séparé du consentement du profil : case dédiée avec explication, jamais cochée par défaut ;
  - visible **uniquement des membres connectés** (401/403 sinon) ;
  - suppression d'une ville immédiate et définitive ;
  - la ville saisie est résolue en coordonnées **par le back** via une instance **Photon auto-hébergée** (service Docker `photon`), jamais depuis le navigateur vers un tiers ; si plusieurs résultats, le membre choisit dans une courte liste ;
  - la carte est **indépendante du profil public** : un membre ayant consenti à la carte y figure même si son profil est masqué au public (la carte n'est visible que des membres, qui peuvent consulter toutes les fiches).

**F4 — Attribution de médailles (admin).**
1. Choisir un membre (recherche), une médaille du catalogue, saisir un motif (200 caractères max, obligatoire).
2. « Attribuer », dans cet **ordre** :
   1. le bot ajoute le rôle Discord (s'il échoue : rien n'est enregistré, toast d'erreur avec « Réessayer ») ;
   2. l'attribution est enregistrée en base ; si cette écriture échoue, le bot **retire le rôle** qu'il vient d'ajouter (sauf si le membre le possédait déjà) et l'erreur est journalisée ;
   3. un toast confirme.
3. Liste « À annoncer » (depuis la dernière annonce) avec possibilité de **retirer** une attribution. Le retrait marque `revokedAt` et **retire le rôle Discord seulement s'il ne reste aucune autre attribution active** de la même médaille pour ce membre.
4. « Lancer l'annonce Discord » : aperçu, puis **un seul embed groupé** (les attributions retirées avant l'annonce en sont **exclues**) avec mention `@membre`, posté dans `DISCORD_ANNOUNCE_CHANNEL_ID` (découpé en plusieurs messages si trop long). Les attributions ne sont marquées annoncées (`announcedAt`) **qu'une fois tous les messages postés** ; en cas d'échec partiel, rien n'est marqué et l'erreur est affichée. Un verrou empêche deux annonces simultanées. Bouton désactivé s'il n'y a rien à annoncer.
- Un membre peut recevoir **plusieurs fois** la même médaille (attributions distinctes, sans contrainte d'unicité `userId + medalId`). La protection contre le double-clic repose sur une clé d'idempotence envoyée par l'interface (voir §4.5).
- Catalogue de médailles défini dans `config/discord-roles.json` (section `medals`) ; pas d'écran de création en V1. Les images sont des **fichiers statiques du dépôt** dans `client/public/medals/` (SVG) ; le champ `image` est le nom du fichier. Le seed fournit des SVG simples générés. Les grades n'ont pas d'image en V1 (libellé et abréviation seulement).
- Le motif est **visible publiquement** sur la fiche du membre (si son profil est public) : l'écran d'attribution le rappelle à l'admin (« ce texte sera public »).

### 1.7 Design et ergonomie

- Palette « Saut de nuit » : fond bleu nuit `#070B1A`, surfaces `#0E1530` / `#172048`, accent d'action orange `#FF6B2C` (texte foncé), accent de repère cyan `#5CE1E6`, texte `#E8ECFF` / `#8E97BD`. Carte : tuiles OSM recolorées en bleu nuit.
- Titres *Unbounded*, corps *Space Grotesk*, labels *JetBrains Mono*, polices auto-hébergées.
- Mobile-first, contraste AA, navigation clavier, focus visible.
- Une animation d'apparition simple, `prefers-reduced-motion` respecté.
- Seule touche décorative marquée : la carte « plaque d'identité ». Pas de parallaxe ni de textures lourdes.
- Feedback : skeleton loaders, toasts, états vides, pages 404/500 sobres.

### 1.8 Critères d'acceptation V1

- Un visiteur ne reçoit jamais de donnée réservée (pas de simple masquage CSS).
- Un profil masqué n'apparaît ni en liste ni par URL directe (404) pour un visiteur.
- Un non-admin reçoit 403 sur toute route admin.
- Une attribution de médaille ajoute bien le rôle Discord et apparaît dans « À annoncer » ; après annonce, elle n'y figure plus.
- Les pages publiques sont lisibles sans JavaScript.
- Un visiteur ou un non-membre reçoit 401/403 sur l'API de la carte.
- Un membre ne peut pas enregistrer une 3ᵉ ville, ni publier une ville sans avoir donné son consentement carte.

### 1.9 Modules reportés (pour information, ne pas implémenter en V1)

- **V2 Batailles** : frise (nom, date, carte, résultat : victoire / défaite / nul / en cours / planifiée, avec icône en plus de la couleur), page publique, **dossier confidentiel** pour les membres (briefing, objectifs, débriefing). Admin : CRUD + statut + résultat. Pas de temps réel.
- **V2 Formations** : catalogue, statut par membre (non commencée / en cours / validée), validation par un admin. Ni sessions ni émargement au début.
- **V3 Images personnalisées** : upload ≤ 2 Mo (JPG/PNG/WebP), file de modération admin (approuver / rejeter avec motif).
- **V3 Notifications admin** : demande d'image, clic sur « Rejoindre » (anonyme).

------

## 2. Architecture technique

### 2.1 Stack

| Élément | Choix |
|---|---|
| Application | **Un seul dépôt, un seul processus serveur** Node.js + TypeScript : le back (Express) sert l'API `/api` et les pages Angular rendues côté serveur (`@angular/ssr`). Arborescence imposée : `server/` (API, bot, jobs), `client/` (Angular), `config/`, `prisma/`, `docs/`. Les routes `/api`, `/auth`, `/health` et `/rejoindre/go` sont enregistrées **avant** la route « attrape-tout » du rendu Angular |
| Versions | Dernières versions **LTS / stables** de Node.js, Angular, Prisma et discord.js au moment de la génération, **épinglées** dans `package.json` et listées dans le README |
| Front | Angular (rendu serveur pour les pages publiques ; `/carte`, `/profil` et `/admin` en rendu navigateur seul), CSS avec variables, pas de framework UI |
| Base de données | PostgreSQL (**sans PostGIS**) + Prisma (ORM, migrations) |
| Authentification | OAuth2 Discord (paramètre `state` vérifié), session par cookie `HttpOnly`, **stockée en base** (table `Session`) |
| Bot Discord | `discord.js`, **dans le même processus** que le back ; intention privilégiée « Server Members » activée |
| Carte | Leaflet + `leaflet.markercluster`, tuiles OpenStreetMap publiques (`TILE_URL` configurable) |
| Géocodage | **Photon auto-hébergé** (service Docker obligatoire), appelé uniquement par le back |
| Cache HTTP | Toute page ou réponse dont le contenu dépend de la session (`/membres`, `/api/members`, `/carte`, …) est envoyée avec `Cache-Control: private` et `Vary: Cookie` ; aucun cache partagé (CDN, cache de rendu) sur ces routes |
| Stockage fichiers | Volume local (prévu pour la V3) |
| Validation | Zod |
| Polices / icônes | Auto-hébergées (Lucide) |

### 2.2 Vue d'ensemble

```
Navigateur ──HTTPS──► App Node.js ──► PostgreSQL
                      │  ├─ API REST (/api)
                      │  ├─ Rendu serveur des pages
                      │  ├─ Job de synchro des rôles (toutes les 15 min)
                      │  └─ Bot discord.js ──► API Discord (rôles, embeds)
                      └─ Connexion OAuth2 ◄──► Discord
```

### 2.3 Déploiement

- `docker-compose.yml` avec **3 services** : `app`, `db` et `photon`, ce dernier avec un volume persistant `photon_data`.
- **Photon** : l'IA **n'invente aucun nom d'image** ; elle utilise l'image et la procédure de téléchargement de l'index décrites dans la documentation officielle du projet Photon, en épinglant la version. Le README détaille ce téléchargement **avant le premier lancement**, préfère un **extrait par pays** si le projet en propose (sinon l'index complet, plusieurs dizaines de Go : le préciser) et indique l'espace disque nécessaire. Si Photon est indisponible, l'application démarre quand même : `/api/geocode` répond **503** avec un message clair.
- En local, l'application est servie en HTTP sur `localhost` : le cookie `Secure` n'est activé qu'en production (`NODE_ENV=production`). En production, un reverse proxy TLS est supposé devant l'app (`TRUST_PROXY=1`).
- `.env.example` commenté avec toutes les variables :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `SESSION_SECRET` | Signature des sessions |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_REDIRECT_URI` | OAuth2 |
| `DISCORD_BOT_TOKEN` | Bot |
| `DISCORD_GUILD_ID` | Serveur de la communauté |
| `DISCORD_MEMBER_ROLE_IDS` / `DISCORD_ADMIN_ROLE_IDS` | Listes d'IDs de rôles (séparés par des virgules) |
| `DISCORD_ANNOUNCE_CHANNEL_ID` | Salon des annonces |
| `DISCORD_INVITE_URL` / `DISCORD_APPLY_URL` | Lien d'invitation et lien (optionnel) du salon « Postuler » |
| `COMMUNITY_FOUNDED_YEAR` | Année affichée dans les chiffres clés |
| `TILE_URL` / `TILE_ATTRIBUTION` | Tuiles de la carte (défaut : OpenStreetMap) |
| `PHOTON_URL` | Adresse du service Photon (défaut : `http://photon:2322`) |
| `DEPARTURE_RETENTION_DAYS` | Délai avant suppression des données d'un membre parti (défaut : 30) |
| `DISCORD_MOCK` | `true` : simule Discord (voir §2.8), interdit en production |
| `SEED_DEMO` | `true` : charge les données de démonstration, interdit en production |

- Sauvegarde quotidienne de la base (`pg_dump`), healthcheck `/health`.

### 2.4 Configuration des correspondances Discord

Fichier `config/discord-roles.json`, chargé au démarrage (modification = redémarrage, pas d'écran de paramètres en V1) :

```json
{
  "ranks": [{ "name": "Private", "abbr": "PVT", "roleId": "...", "order": 1 }],
  "responsibilities": [{ "name": "Instructeur", "roleId": "..." }],
  "medals": [{ "id": "bravoure-1", "name": "…", "description": "…", "image": "…", "roleId": "..." }]
}
```

### 2.5 Synchronisation des rôles

- **Import initial** : au démarrage (si la table `User` est vide et que `SEED_DEMO` n'est pas activé) et via la commande `npm run import:members`, le bot liste les membres du serveur ayant un rôle membre ou admin et crée leurs fiches (`discordId`, nom, grade, responsabilités, `joinedAt` = date d'arrivée sur le serveur Discord). Ces fiches ont `consentAt = null` donc `publicProfile = false` : elles sont visibles des membres, pas des visiteurs, tant que la personne n'a pas accepté à sa première connexion.
- **À chaque connexion** (**MUST**), puis **toutes les 15 min pour tous les membres connus**, via le **jeton du bot** (aucun jeton utilisateur n'est conservé). Le même job crée les fiches des nouveaux détenteurs du rôle membre, **sauf ceux figurant dans la table d'exclusion `DeletedAccount`** (voir ci-dessous).
- **Comptes supprimés** : à `DELETE /api/me`, on enregistre une empreinte salée de l'ID Discord dans `DeletedAccount`. L'import et la synchro **ne recréent jamais** une fiche pour ces personnes. Seule une **nouvelle connexion volontaire** de la personne la recrée (et retire l'empreinte).
- Calcul : statut (`member` / `admin` / `none`), grade (rôle de plus haut `order`), responsabilités, nom affiché (pseudo du serveur sinon nom global).
- **Source du statut** : les middlewares lisent **`User.status` en base** (aucun appel Discord par requête). Il est mis à jour à la connexion et par le job de 15 min.
- Membre qui perd son rôle ou quitte le serveur : `status = none`, `leftAt` renseigné, **profil masqué et accès révoqué au plus tard à la prochaine synchro (≤ 15 min)**. Ses données sont supprimées après `DEPARTURE_RETENTION_DAYS` jours par un job quotidien. Une personne qui reprend le rôle avant ce délai récupère sa fiche (`leftAt` remis à null).
- Les médailles ne sont pas relues depuis Discord : l'historique du site fait foi pour l'affichage. Le retrait manuel d'un rôle de médaille dans Discord n'est pas répercuté en V1 (limite connue, à documenter dans le README).
- Pas d'écoute d'événements Discord en V1.

### 2.6 Bot Discord

- Permissions minimales : `Manage Roles`, `Send Messages`, `Embed Links`. Son rôle doit être **au-dessus** des rôles gérés.
- Actions : lire les rôles d'un membre, ajouter/retirer un rôle, poster un embed.
- Échec (rate limit, indisponibilité) : retry avec backoff, message clair côté admin, entrée dans les logs.

### 2.7 Qualité

- TypeScript strict, ESLint + Prettier.
- Tests : contrôle d'accès (visiteur / membre / admin), profil masqué → 404, attribution + annonce (avec échec Discord simulé), quota de 2 villes, retrait d'une médaille en double.
- Seed : 15 membres fictifs (faux `discordId`), 6 médailles, grades et responsabilités d'exemple. **Chargé uniquement si `SEED_DEMO=true`**, refusé en production.

### 2.8 Mode simulation Discord (`DISCORD_MOCK=true`)

Pour développer et tester sans serveur Discord :

- Page de connexion factice `/auth/mock` proposant 3 profils : visiteur, membre, admin.
- Un faux client Discord en mémoire (rôles, ajout/retrait de rôle, embeds « postés » consultables dans les logs) remplace `discord.js`.
- Tous les tests automatisés utilisent ce mode ; aucun test n'appelle la vraie API Discord.
- Le démarrage échoue si `DISCORD_MOCK=true` avec `NODE_ENV=production`.

------

## 3. Modèle de données

Six tables en V1 (`User`, `MedalAward`, `MemberLocation`, `AuditLog`, `Session`, `DeletedAccount`). Grade et responsabilités sont **recalculés depuis Discord** (pas de table dédiée). Les personnes sans rôle membre n'ont **pas** de ligne `User`.

### User

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | clé primaire |
| `discordId` | string | **unique** |
| `displayName` | string | |
| `status` | enum `member` / `admin` / `none` | calculé ; **source de vérité des droits** ; `none` = ancien membre (avec `leftAt`), traité comme visiteur |
| `rankName` | string, nullable | calculé |
| `responsibilities` | string[] | calculé |
| `tagline` | string(140), nullable | |
| `publicProfile` | bool | défaut `false` ; passe à `true` uniquement quand le membre accepte |
| `consentAt` | datetime, nullable | consentement profil public (null = pas encore répondu, ou refus) |
| `leftAt` | datetime, nullable | date de départ détectée ; déclenche la suppression après `DEPARTURE_RETENTION_DAYS` |
| `mapConsentAt` | datetime, nullable | consentement carte, séparé et opt-in |
| `joinedAt` | datetime | date d'arrivée sur le serveur Discord (`joined_at`), sert à l'ancienneté |
| `lastLoginAt` | datetime, nullable | `null` pour un membre importé jamais connecté |

### MedalAward

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `userId` | → User | index |
| `medalId` | string | référence la section `medals` de `discord-roles.json` |
| `idempotencyKey` | string, unique | clé fournie par l'interface, évite le doublon sur double-clic |
| `reason` | string(200) | obligatoire |
| `awardedBy` | → User, **nullable** (`onDelete: SetNull`) | devient `null` si l'admin supprime son compte |
| `awardedAt` | datetime | |
| `announcedAt` | datetime, nullable | `null` = à annoncer |
| `revokedAt` | datetime, nullable | |

### MemberLocation

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `userId` | → User | index ; suppression en cascade |
| `cityLabel` | string | ex. « Lyon » |
| `country` | string | code ISO (ex. `FR`) |
| `slot` | int (1 ou 2) | emplacement de la ville ; unicité `(userId, slot)` |
| `lat` / `lng` | `Float` | **arrondis à 2 décimales côté serveur avant écriture** (Photon renvoie une précision bien supérieure), précision ville uniquement |
| `createdAt` | datetime | |

- **Maximum 2 lignes par `userId`** : vérifié dans l'application **et** en base par la contrainte `slot ∈ {1, 2}` + unicité `(userId, slot)`. À l'ajout, le serveur attribue le premier `slot` libre (aucun `slot` n'est envoyé par le client) ; s'il n'y en a pas, réponse **409**.
- Le consentement carte est stocké dans `User` (`mapConsentAt`, nullable) ; sans lui, aucune ville n'est exposée.

### AuditLog

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `actorId` | → User, nullable | anonymisé à la suppression du compte |
| `action` | string | `medal.award`, `medal.revoke`, `medal.announce`, `account.delete`, `location.add`, `location.delete` |
| `targetId` | string, nullable | |
| `createdAt` | datetime | index |

Conservation : 12 mois, puis purge par un job quotidien. Lecture seule.

### Session

| Champ | Type | Notes |
|---|---|---|
| `id` | string | identifiant aléatoire du cookie (haché en base) |
| `discordId` | string | |
| `userId` | → User, nullable | `null` pour un visiteur connecté sans rôle membre (il devient membre à sa prochaine connexion s'il obtient le rôle) |
| `expiresAt` | datetime | 7 jours glissants ; les sessions expirées sont purgées par le job quotidien |

Le statut n'est **pas** stocké dans la session : il est lu dans `User.status` (voir §2.5).

### DeletedAccount

| Champ | Type | Notes |
|---|---|---|
| `discordIdHash` | string, unique | empreinte **salée** de l'ID Discord (sel dans `SESSION_SECRET` ou variable dédiée) |
| `deletedAt` | datetime | |

Sert uniquement à empêcher la recréation automatique d'une fiche par l'import ou la synchro (base légale : respect du droit à l'effacement). Retirée si la personne se reconnecte volontairement.

### Extensions prévues (V2/V3)

`Battle`, `BattleConfidential`, `Training`, `TrainingEnrollment`, `CustomImage`, `Notification` : à concevoir plus tard, sans impact sur les tables V1.

------

## 4. Spécifications API

### 4.1 Conventions

- REST JSON sous `/api`. Session par cookie ; protection CSRF sur les méthodes non sûres.
- Entrées validées avec Zod. Pagination : `?page=1&limit=24` → `{ items, page, limit, total }`.
- Erreurs normalisées : `{ "error": { "code": "FORBIDDEN", "message": "…" } }`.
- Codes : 400 validation, 401 non connecté, 403 droits insuffisants, 404 introuvable (y compris profil masqué), 409 conflit, 429 trop de requêtes.

### 4.2 Authentification

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/auth/discord` | public | Génère un `state` aléatoire (stocké en cookie court) et redirige vers Discord OAuth2. Paramètre optionnel `?next=` : **chemin relatif interne uniquement**, sinon ignoré (pas de redirection ouverte) |
| GET | `/auth/discord/callback` | public | Vérifie le `state`, crée la session, synchronise les rôles. Membre : crée/met à jour la ligne `User`. Non-membre : session sans ligne `User` |
| POST | `/auth/logout` | connecté | Invalide la session |
| GET | `/api/session` | public | `{ status, user? }` pour l'interface |

### 4.3 Membres (public)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/members` | Liste filtrée. Query : `q`, `rank`, `page`, `limit`. Tri par défaut : grade décroissant puis nom. Visiteur : uniquement les membres à `publicProfile = true`. Membre/Admin : tous les membres. |
| GET | `/api/members/:id` | Fiche (`:id` = UUID). 404 si `publicProfile = false` et appelant non membre. |

Réponse d'une fiche : `id`, `displayName`, `rank`, `responsibilities[]`, `tagline`, `joinedAt`, `medals[{ id, name, description, image, awardedAt, reason }]`.

### 4.4 Mon compte (membre)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/me` | Profil complet de l'utilisateur connecté |
| PATCH | `/api/me` | Corps : `{ tagline?, publicProfile?, mapConsent? }`. Passer `publicProfile` à `true` enregistre `consentAt` ; à `false` le conserve mais masque le profil |
| POST | `/api/me/consent` | Réponse à la modale de première connexion : `{ publicProfile: boolean }` |
| GET | `/api/me/export` | Export JSON de toutes ses données |
| DELETE | `/api/me` | Suppression du compte (confirmation côté interface) |

### 4.4 bis Carte (membre)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/map/members` | Marqueurs des membres ayant donné leur consentement carte : `[{ userId, displayName, rank, tagline, city, country, lat, lng }]`. **Membre/Admin uniquement** (401/403 sinon). |
| GET | `/api/me/locations` | Mes villes (0 à 2) |
| POST | `/api/me/locations` | `{ cityLabel, country, lat, lng }` ; exige `mapConsentAt` ; **409** à la 3ᵉ ville |
| DELETE | `/api/me/locations/:id` | Suppression immédiate et définitive |
| GET | `/api/geocode?q=…` | Recherche d'une ville (5 résultats max : libellé, pays, lat, lng), proxy vers Photon (membre uniquement, rate-limité). Le navigateur n'appelle jamais de tiers. |

Passer `mapConsent` à `false` (via `PATCH /api/me`) **supprime** les villes du membre. La carte répond **401** à un visiteur non connecté et **403** à une personne connectée sans statut membre.

### 4.5 Administration (admin uniquement)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/medals` | Catalogue (section `medals` de `discord-roles.json`) |
| GET | `/api/admin/members?q=…` | Recherche de membres (nom) pour l'attribution |
| POST | `/api/admin/medals/award` | `{ userId, medalId, reason, idempotencyKey }` → ajoute le rôle Discord puis crée l'attribution (ordre et annulation : voir F4) |
| DELETE | `/api/admin/medals/awards/:id` | Marque `revokedAt` ; retire le rôle Discord seulement s'il ne reste aucune autre attribution active de cette médaille |
| GET | `/api/admin/medals/pending` | Attributions non annoncées |
| POST | `/api/admin/medals/announce` | Poste l'embed, marque les attributions annoncées. `?preview=true` renvoie l'aperçu sans poster |

Idempotence de `award` : l'interface génère un `idempotencyKey` (UUID) à l'ouverture du formulaire ; un second envoi avec la même clé renvoie l'attribution existante (200) sans rien recréer. Une nouvelle attribution volontaire de la même médaille utilise une nouvelle clé.

### 4.6 Divers

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | État de l'app et de la base |
| GET | `/rejoindre/go` | Redirection vers `DISCORD_INVITE_URL` |

------

## 5. Sécurité / RGPD

### 5.1 Sécurité

- **MUST** : contrôle d'accès **côté serveur** sur chaque route (middleware par niveau), jamais uniquement dans l'interface. Aucune donnée réservée dans une réponse à un visiteur.
- Cookies `HttpOnly`, `SameSite=Lax`, durée 7 jours glissants ; `Secure` activé dès que `NODE_ENV=production` (voir §2.3).
- CSRF : jeton double-submit (cookie `XSRF-TOKEN` lu par Angular et renvoyé dans l'en-tête `X-XSRF-TOKEN`) sur toutes les méthodes non sûres. Paramètre `state` vérifié sur le callback OAuth.
- En-têtes de sécurité (CSP stricte, HSTS, `X-Content-Type-Options`), échappement XSS. La CSP n'autorise, hors du site lui-même, que le domaine des tuiles de carte (`TILE_URL`).
- Requêtes via l'ORM (pas de SQL brut).
- Rate-limit global et plus strict sur `/auth` et `/api/admin`.
- Secrets uniquement en variables d'environnement ; dépendances à jour.
- Filtrage basique de la phrase personnalisée (longueur, caractères de contrôle, échappement à l'affichage).

### 5.2 RGPD

**Minimisation** : on stocke uniquement ID Discord, pseudo, rôles, phrase personnalisée, et, **uniquement si le membre le choisit**, jusqu'à 2 villes (coordonnées arrondies). Pas d'email, pas d'adresse ni de position précise, pas d'IP en clair.

| Traitement | Base légale | Conservation |
|---|---|---|
| Compte et profil (visible des membres seulement) | Intérêt légitime (fonctionnement de la communauté) | Tant que membre + `DEPARTURE_RETENTION_DAYS` (30) jours après départ |
| Profil public | **Consentement** (modale à la 1ʳᵉ connexion, refus possible sans perte d'accès) | Retrait possible à tout moment |
| Villes sur la carte | **Consentement explicite**, séparé, opt-in | Jusqu'au retrait du consentement ou à la suppression de la ville / du compte |
| Journal d'audit | Intérêt légitime (traçabilité admin) | 12 mois |
| Comptes supprimés (`DeletedAccount`) | Respect du droit à l'effacement | Empreinte salée conservée tant que la personne n'a pas volontairement rouvert un compte |

**Droits**

- Accès / portabilité : `GET /api/me/export`.
- Rectification : édition de la phrase.
- Effacement : `DELETE /api/me` supprime définitivement le profil, les villes et les attributions **reçues** ; les attributions **données** (si c'est un admin) gardent leur trace avec `awardedBy = null` ; `actorId` est anonymisé dans les logs ; une empreinte salée est ajoutée à `DeletedAccount`. Les rôles Discord relèvent de Discord et des admins.
- Opposition / limitation : interrupteur « profil public » ; retrait du consentement carte à tout moment (effet immédiat, villes supprimées).
- Les villes sont incluses dans l'export JSON et supprimées avec le compte.

**Autres points**

- Membre qui quitte le serveur : profil masqué à la synchro suivante (≤ 15 min), données supprimées après `DEPARTURE_RETENTION_DAYS` jours (30 par défaut). La suppression de compte (`DELETE /api/me`) est **définitive** (pas de suppression logique).
- **Tiers contactés par le navigateur** : uniquement le serveur de tuiles de la carte (OpenStreetMap par défaut), qui reçoit l'adresse IP du visiteur sur la page `/carte`. À mentionner dans la politique de confidentialité, avec une phrase d'information sur la page carte. Aucun autre tiers (pas d'avatars Discord, polices auto-hébergées).
- Aucun tracker ; seul cookie : la session (donc pas de bandeau cookies).
- Hébergement dans l'UE ; sous-traitants listés : hébergeur, Discord (rôles, annonces), OpenStreetMap (tuiles). Le géocodage (Photon) est auto-hébergé : aucune donnée envoyée à un tiers.
- Pages `mentions-legales` et `confidentialite` avec texte type à compléter.
- Fournir `docs/rgpd-registre.md` (finalités, données, durées, destinataires) et une procédure de violation de données dans le README.

------

## 6. Plan de développement

### 6.1 Étapes de la V1

| # | Étape | Contenu | Résultat vérifiable |
|---|---|---|---|
| 1 | **Socle** | Dépôt (`server/`, `client/`, `config/`, `prisma/`), TypeScript, Docker Compose (`app` + `db` + `photon`), Prisma, `.env.example`, lint/format, `/health` | `docker compose up` démarre app, base et Photon |
| 2 | **Auth Discord** | **Mode `DISCORD_MOCK`**, OAuth2 (state), sessions en base, calcul du statut, `config/discord-roles.json`, middleware de droits, import initial des membres, job de synchro | En mode simulation : visiteur, membre et admin se connectent avec les bons droits. Avec un vrai serveur Discord : idem |
| 3 | **Vitrine** | Layout, thème, pages Accueil / Communauté / Rejoindre / légales, contenu Markdown | Pages lisibles sans JavaScript, responsive |
| 4 | **Annuaire** | `/api/members`, liste + fiche, carte « plaque d'identité », recherche/filtre, profil masqué → 404 | Critères F2 validés |
| 5 | **Mon profil** | Modale de consentement (accepter / refuser), phrase, visibilité, export, suppression définitive de compte | Critères F3 et RGPD validés |
| 6 | **Carte** | `MemberLocation`, `/api/map/members`, `/api/me/locations`, `/api/geocode` (Photon), page `/carte` chargée côté navigateur seulement (Leaflet, clustering, recherche, panneau « Mes villes »), consentement carte | Critères carte validés (max 2 villes, 401/403 visiteur) |
| 7 | **Bot + médailles** | Client Discord, attribution/retrait, liste « À annoncer », aperçu et envoi de l'embed, journal d'audit | Rôle ajouté sur Discord, annonce postée |
| 8 | **Finitions** | Seed de démo (`SEED_DEMO`), tests, pages 404/500, accessibilité, jobs quotidiens (purge des logs, des sessions expirées et des membres partis depuis plus de `DEPARTURE_RETENTION_DAYS`), `docs/rgpd-registre.md`, README | Checklist de recette ci-dessous |

### 6.2 Recette V1

- [ ] Connexion / déconnexion Discord fonctionnelles
- [ ] Visiteur, membre et admin voient exactement ce que prévoit la matrice §1.3
- [ ] Profil masqué → 404 pour un visiteur
- [ ] Carte : réservée aux membres, 2 villes max, opt-in respecté, retrait du consentement supprime les villes
- [ ] Attribution, retrait et annonce de médaille de bout en bout (dont : échec Discord simulé, médaille en double, double-clic)
- [ ] Refus de la modale de consentement : accès membre conservé, profil masqué au public
- [ ] Un compte supprimé n'est pas recréé par la synchro ni par l'import
- [ ] Un membre qui perd son rôle est traité comme visiteur en ≤ 15 min
- [ ] Une page dépendant de la session n'est jamais servie depuis un cache partagé
- [ ] Tout fonctionne en `DISCORD_MOCK=true` sans compte Discord
- [ ] Export et suppression de compte fonctionnels
- [ ] Tests automatisés au vert
- [ ] Aucun secret ni identifiant Discord en dur
- [ ] README permet une installation depuis zéro

### 6.3 Livrables

1. Code source complet (un seul projet).
2. Schéma Prisma, migrations, seed.
3. `docker-compose.yml` et `.env.example`.
4. `README.md` : installation, création de l'application et du bot Discord, lancement, tests, déploiement, procédure en cas de violation de données.
5. `docs/rgpd-registre.md` et pages légales de base.

### 6.4 Après la V1

- **V2** : batailles, puis formations.
- **V3** : images personnalisées, notifications.

Chaque module reprend le même cycle : modèle de données → API → écrans → tests.

### 6.5 Décisions déjà prises

| Sujet | Décision |
|---|---|
| Grades | Liste US Army standard, modifiable dans `discord-roles.json` |
| Rôles membre / admin | Listes d'IDs dans `.env` |
| Médailles | Rôles Discord déjà existants, associés via `discord-roles.json` |
| Annonce | Un seul embed groupé avec mention `@membre` |
| Bouton « Rejoindre » | Simple lien d'invitation Discord (`DISCORD_INVITE_URL`) |
| Visibilité du profil | **Masqué par défaut** ; visible du public seulement après acceptation du consentement (refus = accès membre conservé) |
| Import des membres | Via le bot au démarrage, puis synchro toutes les 15 min |
| Carte et profil public | Indépendants : la carte reste visible des membres même si le profil est masqué |
| Tuiles / géocodage | OpenStreetMap public (`TILE_URL` configurable) / Photon auto-hébergé, obligatoire dans Docker |
| Statut des membres | Lu dans `User.status` (mis à jour à la connexion et toutes les 15 min), pas d'appel Discord par requête |
| Images des médailles | Fichiers SVG statiques dans `client/public/medals/` |
| Comptes inactifs | Pas de suppression pour inactivité : la conservation est liée à l'appartenance au serveur |
| Avatars | Non affichés (aucun chargement depuis Discord) |
| Ordre d'attribution | Discord d'abord, puis base ; annulation du rôle si la base échoue |
| Retrait d'une médaille en double | Le rôle Discord n'est retiré que s'il ne reste aucune attribution active |
| Multi-langue | Non (français uniquement) |
| Hébergement | Docker Compose sur un serveur UE au choix |

*À confirmer uniquement si un point bloque : grades exacts, IDs des rôles, textes éditoriaux.*
