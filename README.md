# Site de la communauté 501e (Squad 44)

Site officiel de la communauté RP francophone « 501st Parachute Infantry Regiment » : vitrine publique, annuaire des membres, espace membre (profil, carte), outils d'administration synchronisés avec Discord.

Cette première version couvre le **périmètre V1** des spécifications (`specifications-techniques.md`). Les batailles et les formations (V2) ne sont pas encore livrées ; l'architecture est prête à les accueillir.

## Sommaire

1. [Fonctionnalités livrées](#fonctionnalités-livrées)
2. [Architecture](#architecture)
3. [Démarrage rapide (mode démo)](#démarrage-rapide-mode-démo)
4. [Variables d'environnement](#variables-denvironnement)
5. [Créer l'application et le bot Discord](#créer-lapplication-et-le-bot-discord)
6. [Géocodage Photon auto-hébergé](#géocodage-photon-auto-hébergé)
7. [Tests et qualité](#tests-et-qualité)
8. [Déploiement](#déploiement)
9. [Sécurité et RGPD](#sécurité-et-rgpd)
10. [Modifier le contenu](#modifier-le-contenu)
11. [Hypothèses retenues et limites connues](#hypothèses-retenues-et-limites-connues)

## Fonctionnalités livrées

| Espace | Fonctionnalités |
| --- | --- |
| **Public** | Accueil (hero, chiffres clés animés, membres à l'honneur, « Comment ça marche », valeurs, FAQ) · La communauté · Le 501st PIR (frise interactive) · Rejoindre · Liste des membres filtrable (cartes « dog tag ») · Fiche membre · Pages légales · Sitemap, robots.txt, Open Graph |
| **Membre** | Connexion Discord · Consentement RGPD granulaire et versionné · Mon profil (phrase, image recadrée 3:4 soumise à validation, visibilité, consentements, export JSON, suppression du compte) · Carte des membres (clustering, recherche, filtres, liste par pays, 2 villes max) |
| **Admin** | Tableau de bord · Attribution de médailles (idempotence, confirmation des doublons) · Promotion ou rétrogradation d'un membre (sauts de grade possibles, rôle de grade changé sur Discord) · Liste « À annoncer » (médailles et promotions détectées sur Discord) et annonce Discord avec aperçu et découpage automatique · Catalogue des médailles · Modération des images (raccourcis clavier) · Notifications et journal d'audit (filtres, export CSV) · Paramètres (rôles, salon, invitation, grades, responsabilités, texte de consentement, test de l'intégration) |
| **Bot** | Trois usages seulement : **lire** les membres et leurs rôles (événements `guildMemberUpdate`, `guildMemberAdd`, `guildMemberRemove` relayés à l'API, plus resynchronisation périodique), **changer le rôle de grade** d'un membre promu ou rétrogradé depuis l'admin, et **poster** les annonces de médailles et de promotions dans le salon d'annonce configuré. Il ne touche à aucun autre rôle et n'écrit nulle part ailleurs |

## Architecture

```
apps/
  api/   API REST Node.js (Express 5, Prisma 6, PostgreSQL + PostGIS, Zod)
  web/   Front Angular 22 avec rendu serveur (SSR) — le serveur SSR sert aussi de proxy /api
  bot/   Bot Discord (discord.js 14), processus séparé
docs/    Registre des traitements RGPD
```

- **Discord est la source de vérité des rôles.** Le statut (Visiteur / Membre / Admin), le grade et les responsabilités sont recalculés à chaque connexion, par le bot en temps réel, et par une resynchronisation périodique (15 min par défaut).
- **Les permissions sont vérifiées côté serveur** sur chaque route. Le statut est relu en base à chaque requête et revérifié auprès de Discord si la copie locale a plus de 5 minutes.
- **Le bot est en lecture seule, sauf pour les grades et les annonces.** Les lectures (membres, rôles), le changement de rôle de grade et l'envoi des annonces passent par l'API REST Discord avec le jeton du bot : retry avec backoff exponentiel, respect des limites de débit, journalisation et notification admin en cas d'échec. Un garde-fou (`apps/api/src/discord/http.ts`) refuse toute autre écriture avec le jeton du bot : l'ajout ou le retrait de rôle n'est accepté que pour un rôle associé à un grade, et l'envoi vise uniquement le salon d'annonce configuré.
- **Les médailles vivent sur le site** : elles ne correspondent à aucun rôle Discord. **Les promotions** sont détectées par la synchronisation (nouveau rôle de grade plus élevé) et rejoignent la liste « À annoncer », d'où un admin publie l'annonce groupée ou écarte une promotion. Un admin peut aussi promouvoir ou rétrograder un membre depuis **Admin > Promotions et grades**, en sautant des grades (Pfc → Sgt, Lt.Col → Sgt) : le bot remplace le rôle de grade sur Discord, puis la promotion suit le même circuit (une rétrogradation n'est pas annoncée).
- **Mode démo** (`DISCORD_MODE=mock`) : connexion simulée par choix d'un compte fictif, rôles et annonces simulés en base. Permet d'utiliser tout le site sans application Discord.

Bibliothèques principales : `express`, `helmet`, `express-rate-limit`, `zod`, `@prisma/client`, `multer`, `sharp` (réencodage des images), `pino` (logs JSON), `discord.js`, `@angular/ssr`, `leaflet` et `leaflet.markercluster` (carte), `marked` (pages légales), `@fontsource/*` (polices auto-hébergées), `http-proxy-middleware`.

## Démarrage rapide (mode démo)

Prérequis : Node.js 22.22.3+ (ou 24.15+), npm 11, Docker Desktop (ou un PostgreSQL 15+ local).

> npm 10.9 (fourni avec certaines versions de Node 22) plante sur la résolution des workspaces (`Cannot read properties of null (reading 'edgesOut')`). Utilise npm 11 : `npm install -g npm@11`, ou `npx npm@11 install`.

```bash
cp .env.example .env          # valeurs de démo prêtes à l'emploi
npm install
npm run db:up                 # PostgreSQL + PostGIS dans Docker
npm run db:migrate            # crée le schéma
npm run db:seed               # 23 comptes fictifs, 20 médailles, 17 grades…
npm run dev:api               # API sur http://localhost:3000
npm run dev:web               # site sur http://localhost:4200
```

Sur la page **Connexion**, choisis un compte fictif :

| Compte | Statut |
| --- | --- |
| Capt. Winters (démo admin) | Admin |
| Pvt. Blithe (démo membre) | Membre sans consentement (affiche la modale RGPD) |
| Curieux (démo non-membre) | Connecté sans rôle membre, traité comme un visiteur |

### Tout lancer avec Docker Compose

```bash
cp .env.example .env    # puis PUBLIC_URL=http://localhost:4000 et des secrets réels
docker compose up -d --build
npm install && npm run db:seed                # données de démo (facultatif, depuis l'hôte : la base écoute sur 127.0.0.1:5432)
```

Le site est servi sur http://localhost:4000. Les migrations sont appliquées au démarrage du conteneur `api`.

Services optionnels : `docker compose --profile discord up -d bot` (bot Discord, mode `live`) et `docker compose --profile geocoding up -d photon` (géocodeur).

## Variables d'environnement

Toutes les variables sont documentées dans [.env.example](.env.example). Les plus importantes :

| Variable | Rôle |
| --- | --- |
| `PUBLIC_URL` | URL publique du site (OAuth, cookies `Secure`, sitemap, Open Graph) |
| `DATABASE_URL` | Connexion PostgreSQL |
| `SESSION_SECRET`, `HASH_SALT`, `INTERNAL_API_TOKEN` | Secrets (32 caractères aléatoires minimum : `openssl rand -hex 32`) |
| `DISCORD_MODE` | `mock` (démo) ou `live` |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Application et bot Discord |
| `DISCORD_MEMBER_ROLE_ID`, `DISCORD_ADMIN_ROLE_ID` | ID des rôles « 501e » (statut Membre) et « État-major » (statut Admin). Non modifiables depuis l'admin |
| `DISCORD_ANNOUNCE_CHANNEL_ID`, `DISCORD_INVITE_URL` | Valeurs par défaut, modifiables ensuite dans Admin > Paramètres |
| `GEOCODER`, `PHOTON_URL` | Recherche de villes : `demo` (liste intégrée) ou `photon` |
| `MAP_TILE_URL`, `MAP_TILE_ATTRIBUTION`, `MAP_TILE_FILTER` | Fond de carte |
| `NG_ALLOWED_HOSTS` | Hôtes supplémentaires autorisés pour le rendu serveur (l'hôte de `PUBLIC_URL` l'est déjà) |

Aucun identifiant Discord n'est codé en dur : tout passe par l'environnement ou la table `Setting`.

## Créer l'application et le bot Discord

1. Sur https://discord.com/developers/applications, crée une application.
2. **OAuth2** : ajoute la redirection `https://<ton-domaine>/api/auth/discord/callback` (en local : `http://localhost:4200/api/auth/discord/callback`). Copie le *Client ID* et le *Client Secret*.
3. **Bot** : crée le bot, copie son jeton, et active l'intent privilégié **Server Members Intent**.
4. Invite le bot sur le serveur avec la seule permission **Gérer les rôles** :
   `https://discord.com/oauth2/authorize?client_id=<CLIENT_ID>&scope=bot&permissions=268435456`
   La lecture des membres et des rôles ne demande que l'intent ci-dessus. « Gérer les rôles » sert aux promotions : dans *Paramètres du serveur > Rôles*, place le rôle du bot **au-dessus de tous les rôles de grade** (Discord interdit à un bot de gérer un rôle placé au-dessus du sien).
5. Dans les paramètres du **salon d'annonce uniquement**, ajoute le rôle du bot avec *Voir le salon*, *Envoyer des messages* et *Intégrer des liens*. Ne lui donne aucune autre permission de gestion (membres, pseudos, messages, salons) : « Vérifier l'intégration » signale toute permission superflue et vérifie la position du rôle du bot.
6. Active le mode développeur de Discord pour copier les identifiants du serveur, des rôles et du salon d'annonce.
7. Renseigne `.env` avec `DISCORD_MODE=live`, puis lance l'API, le front et le bot (`npm run dev:bot`).
8. Dans **Admin > Paramètres**, clique sur « Vérifier l'intégration » et associe grades et responsabilités à leurs rôles.

Scopes OAuth demandés : `identify` et `guilds.members.read`. Aucun e-mail n'est collecté, et le jeton utilisateur est révoqué juste après la connexion.

## Géocodage Photon auto-hébergé

En production, la recherche de villes utilise [Photon](https://github.com/komoot/photon) auto-hébergé (données OpenStreetMap), appelé uniquement par l'API :

```bash
docker compose --profile geocoding up -d photon   # PHOTON_REGION=europe par défaut
# puis dans .env : GEOCODER=photon
```

Le premier démarrage télécharge l'index de la région choisie, soit plusieurs Go pour l'Europe. L'image `rtuszik/photon-docker` est une image communautaire : vérifie ses variables (`REGION`, `UPDATE_STRATEGY`) dans sa documentation avant la mise en production. En développement, `GEOCODER=demo` utilise une liste intégrée d'environ 70 villes francophones.

## Tests et qualité

```bash
npm test          # tests de l'API (Vitest + Supertest, base PostgreSQL « 501e_test »)
npm run lint      # ESLint sur tout le dépôt
npm run build     # compilation API, bot et front
```

Les tests couvrent :
- l'authentification et les permissions, y compris le connecté non-membre, la révocation à la perte du rôle et le CSRF ;
- le quota de 2 villes, y compris en ajouts simultanés et via le trigger en base ;
- l'attribution de médaille, l'idempotence, la confirmation des doublons, l'échec Discord, l'annonce et son découpage ;
- le workflow de modération, avec la suppression des métadonnées EXIF ;
- l'export et la suppression RGPD, et le bouton « Rejoindre ».

La base de test se crée avec `CREATE DATABASE "501e_test";`, ou via `TEST_DATABASE_URL`. Le pipeline CI est dans `.github/workflows/ci.yml`.

## Déploiement

1. Hébergement dans l'UE (VPS avec Docker recommandé).
2. Reverse proxy HTTPS (Caddy, Traefik ou Nginx) vers le conteneur `web:4000`. Seul ce conteneur est exposé.
3. `PUBLIC_URL=https://<domaine>` : active les cookies `Secure`, HSTS et la CSP stricte.
4. Secrets forts, `DISCORD_MODE=live`, `GEOCODER=photon`.
5. Sauvegardes quotidiennes chiffrées de la base et du volume `storage`, stockées dans l'UE. Exemple :

```bash
docker compose exec -T db pg_dump -U 501e 501e | gzip | gpg --symmetric --cipher-algo AES256 > backup-$(date +%F).sql.gz.gpg
```

6. Le chiffrement au repos est assuré par le disque chiffré de l'hébergeur (LUKS ou volume chiffré).
7. **Fond de carte** : les tuiles OpenStreetMap publiques conviennent à un usage modéré ([politique d'usage](https://operations.osmfoundation.org/policies/tiles/)). Pour davantage de trafic, utilise un fournisseur européen avec clé (MapTiler, Stadia…) ou un serveur de tuiles auto-hébergé, via `MAP_TILE_URL`.

## Sécurité et RGPD

- Sessions en base avec jeton haché, cookie `HttpOnly`, `SameSite=Lax` et `Secure` en HTTPS, durée glissante de 7 jours.
- Protection CSRF par double cookie, compatible Angular.
- En-têtes de sécurité (Helmet), CSP stricte en production.
- Limitation de débit globale et par route sensible : connexion, envoi d'image, géocodage, bouton Rejoindre.
- Entrées validées par Zod. Accès à la base uniquement via Prisma.
- Images vérifiées sur leur type réel, réencodées (WebP pour les portraits, PNG pour les médailles, SVG rastérisé), sans métadonnées EXIF, avec un nom aléatoire.
- IP jamais stockées en clair : empreinte HMAC salée dans le journal.
- Aucune donnée confidentielle servie aux non-membres. La carte et le profil ne sont jamais rendus côté serveur.
- Purges automatiques : journal au-delà de 12 mois, images refusées au-delà de 30 jours, anciens membres au-delà de 30 jours, comptes inactifs au-delà de 24 mois avec avertissement admin un mois avant.
- Registre des traitements : [docs/rgpd-registre.md](docs/rgpd-registre.md).

### Procédure en cas de violation de données

1. **Contenir** : révoquer les secrets compromis (`SESSION_SECRET`, jetons Discord), ce qui invalide toutes les sessions.
2. **Évaluer** : consulter le journal d'audit et les logs pour identifier les données et personnes concernées.
3. **Notifier la CNIL sous 72 h** si la violation présente un risque pour les personnes (https://notifications.cnil.fr).
4. **Informer les membres concernés** via Discord si le risque est élevé.
5. **Documenter** l'incident (date, nature, mesures prises) dans un registre des violations, même sans notification.

## Modifier le contenu

- Textes des pages publiques : `apps/web/src/content/*.json`.
- Pages légales : `apps/web/src/content/legal/*.md`. Complète les éléments entre crochets avant la mise en ligne.
- Textes d'interface : `apps/web/src/app/core/i18n/fr.ts`, architecture prête pour l'ajout de l'anglais.
- Couleurs et typographies : `apps/web/src/styles/tokens.css`.
- Visuels (rubans, insignes, fonds, déclinaisons du logo) : `node apps/web/scripts/generate-assets.mjs`, sortie dans `apps/web/public/`. Attention, le script réécrit aussi `visuels/hero-parachutes.svg`, retouché à la main depuis.
- Logo officiel : source dans `assets/logo/501e.png`. Le script en tire les variantes détourées (`public/logo/`), `favicon.ico`, les icônes du manifeste, `apple-touch-icon.png` et `og-image.png`. Affichage dans le site via `apps/web/src/app/shared/insignia.component.ts`.

## Hypothèses retenues et limites connues

- **Profil public visible par défaut**, avec la case pré-cochée dans la modale de consentement (hypothèse §15.14). Les consentements image et carte sont en opt-in.
- **Médailles cumulables par défaut**, paramétrables par médaille. Une nouvelle attribution d'une médaille déjà détenue demande une confirmation.
- **Annonce Discord** : un récapitulatif groupé (promotions, puis médailles regroupées par médaille), avec mention des membres, découpé automatiquement selon les limites de Discord.
- **Promotions** : seule une montée vers un grade plus élevé est annoncée. Plusieurs montées avant l'annonce n'en font qu'une (« Private → Corporal ») ; un retour au grade précédent l'annule. Le premier grade connu d'un membre (première connexion) n'est pas une promotion.
- **Instance unique de l'API** : le verrou anti double-clic et le verrou d'annonce sont en mémoire. Pour plusieurs instances, il faudrait les passer en verrous PostgreSQL.
- Les **textes d'interface** partagés sont externalisés dans `fr.ts`. Une partie des libellés des écrans d'administration et du profil reste dans les templates.
- **PostGIS** est installé mais pas encore exploité en V1 : les coordonnées sont stockées en latitude et longitude arrondies.
- **Bouton « Rejoindre »** : simple lien d'invitation Discord, sans formulaire de candidature (hypothèse §15.9).
- Les **Dockerfiles** et le `docker-compose.yml` n'ont pas encore été exécutés : Docker Desktop ne démarrait pas sur le poste de développement.
