# TODO production : base vierge + Discord réel

Objectif : repartir d'une base de production **vide de toute donnée de démo**, avec la connexion Discord (OAuth2) et le bot réellement actifs, sans aucune donnée de mock.

> ⚠️ Les étapes 3 et 4 **effacent définitivement** la base et les images envoyées. Faire la sauvegarde de l'étape 1 avant.

---

## Ce qu'il faut savoir avant de commencer

- **Les données de démo viennent uniquement du seed** (`npm run db:seed` / `apps/api/prisma/seed.ts`) : 23 faux comptes `demo-*`, rôles Discord fictifs (`mock-*`), médailles attribuées, villes, promotions en attente… **Ne jamais lancer le seed en production.**
- **Attention : `npm run db:reset` relance le seed automatiquement** (`prisma migrate reset` exécute le seed par défaut). En production, utiliser les commandes ci-dessous, jamais `db:reset`.
- **Les migrations suffisent à créer les données de référence** (sans aucun identifiant Discord) :
  - 17 grades (Private → Colonel) ;
  - 9 responsabilités (EM, CO, XO, PL, Staff Toccoa, Recruteur…) ;
  - le catalogue des médailles et leurs images ;
  - les compagnies (État-major, Steel Hawk, Blood Wall, Sledge Hammer, Camp Toccoa) et leurs platoons.
  
  Il faudra ensuite les **associer aux vrais rôles Discord** (étape 7).
- Le conteneur `api` applique les migrations tout seul au démarrage (`prisma migrate deploy` dans `apps/api/Dockerfile`).
- En mode `live`, le code n'utilise plus aucune valeur de mock : connexion démo désactivée (`/api/auth/demo/*` renvoie 404), rôles fictifs et salon `mock-channel-annonces` ignorés.

---

## 1. Sauvegarder l'existant (par sécurité)

```bash
docker compose exec -T db pg_dump -U 501e 501e | gzip > backup-avant-reset-$(date +%F).sql.gz
docker run --rm -v 501e_storage:/data -v "$PWD":/backup alpine tar czf /backup/storage-avant-reset-$(date +%F).tgz -C /data .
```

(Adapter `-U 501e 501e` si `POSTGRES_USER` / `POSTGRES_DB` ont été changés. Le préfixe des volumes, `501e_`, vient de `name: 501e` dans `docker-compose.yml`.)

## 2. Préparer Discord (Developer Portal + serveur)

Sur https://discord.com/developers/applications :

- [ ] Créer (ou réutiliser) l'application.
- [ ] **OAuth2 > Redirects** : ajouter exactement `https://<domaine>/api/auth/discord/callback` (doit correspondre à `PUBLIC_URL` + `/api/auth/discord/callback`, sinon la connexion échoue).
- [ ] Copier le **Client ID** et le **Client Secret**.
- [ ] **Bot** : créer le bot, copier son **jeton**, activer l'intent privilégié **Server Members Intent** (indispensable : sans lui, ni le bot ni la synchronisation des membres ne fonctionnent).
- [ ] Inviter le bot sur le serveur avec la seule permission « Gérer les rôles » :
  `https://discord.com/oauth2/authorize?client_id=<CLIENT_ID>&scope=bot&permissions=268435456`

Sur le serveur Discord :

- [ ] *Paramètres du serveur > Rôles* : placer le rôle du bot **au-dessus de tous les rôles de grade** (sinon les promotions depuis l'admin échouent).
- [ ] Ne donner au rôle du bot **aucune autre permission** (ni Administrateur, ni gestion des membres, messages, salons, pseudos…). Le test d'intégration le signale sinon.
- [ ] Dans le **salon d'annonce uniquement** : autoriser le rôle du bot à *Voir le salon*, *Envoyer des messages*, *Intégrer des liens*.
- [ ] Activer le mode développeur (*Paramètres utilisateur > Avancés*) puis copier par clic droit > « Copier l'identifiant » :
  - l'ID du **serveur** ;
  - l'ID du rôle **« 501e »** (donne le statut Membre) ;
  - l'ID du rôle **« État-major »** (donne le statut Admin) ;
  - l'ID du **salon d'annonce**.
- [ ] Vérifier que **toi-même** tu as les rôles « 501e » et « État-major » : c'est ce qui te rendra admin du site (il n'existe pas d'autre moyen de devenir admin).

## 3. Configurer `.env` sur le serveur de production

```ini
NODE_ENV=production
PUBLIC_URL=https://<domaine>              # HTTPS obligatoire (cookies Secure, CSP, OAuth)

POSTGRES_USER=501e
POSTGRES_PASSWORD=<nouveau-mot-de-passe-fort>
POSTGRES_DB=501e

SESSION_SECRET=<openssl rand -hex 32>
HASH_SALT=<openssl rand -hex 32>
INTERNAL_API_TOKEN=<openssl rand -hex 32>

DISCORD_MODE=live
DISCORD_CLIENT_ID=<client id>
DISCORD_CLIENT_SECRET=<client secret>
DISCORD_BOT_TOKEN=<jeton du bot>
DISCORD_GUILD_ID=<id du serveur>
DISCORD_MEMBER_ROLE_ID=<id du rôle 501e>
DISCORD_ADMIN_ROLE_ID=<id du rôle État-major>
DISCORD_ANNOUNCE_CHANNEL_ID=<id du salon d'annonce>
DISCORD_INVITE_URL=https://discord.gg/<invitation>
ROLE_SYNC_INTERVAL_MINUTES=15

GEOCODER=db                               # villes GeoNames dans la base (~55 Mo), pas la liste de démo
```

- [ ] `DISCORD_MODE=live` : l'API refuse de démarrer s'il manque `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` ou `DISCORD_GUILD_ID`.
- [ ] **Regénérer** `SESSION_SECRET`, `HASH_SALT` et `INTERNAL_API_TOKEN` (ne pas réutiliser les valeurs de dev / `.env.example`).
- [ ] Si `POSTGRES_PASSWORD` change, ce n'est pris en compte qu'à la création d'un volume neuf (cas de l'option A ci-dessous).

## 4. Remettre la base à zéro

### Option A (recommandée) : supprimer les volumes

Repart d'une base et d'un stockage d'images totalement vides.

```bash
docker compose --profile discord down
docker volume rm 501e_db-data 501e_storage
```

Les tables et les données de référence seront recréées par les migrations au démarrage de l'étape 5.

### Option B : vider la base en gardant le volume Postgres

```bash
docker compose up -d db api
docker compose exec api npx prisma migrate reset --force --skip-seed
```

- `--skip-seed` est **obligatoire**, sinon les données de démo sont réinjectées.
- Cette option ne vide pas les images : supprimer aussi le volume `501e_storage` (`docker compose stop api && docker volume rm 501e_storage`) ou vider `/data/storage` dans le conteneur `api`.

## 5. Démarrer toute la pile, bot compris

```bash
docker compose --profile discord up -d --build
docker compose ps
docker compose logs -f api bot
```

À vérifier dans les logs :

- [ ] `api` : migrations appliquées, **aucun** message `ATTENTION : DISCORD_MODE=mock en production`.
- [ ] `bot` : `Bot connecté en tant que <nom>#…` (et non `DISCORD_MODE=mock : le bot ne se connecte pas`).
- [ ] Le bot apparaît **en ligne** sur le serveur Discord.

Rappel : un reverse proxy HTTPS (Caddy, Traefik, Nginx) doit pointer vers `web:4000` ; c'est le seul port exposé.

## 6. Première connexion (devenir admin)

- [ ] Ouvrir `https://<domaine>`, cliquer sur « Connexion » : tu dois être redirigé vers **discord.com** (et non vers la liste des comptes fictifs).
- [ ] Autoriser l'application, accepter le consentement RGPD.
- [ ] Vérifier que le menu **Admin** est présent (statut calculé à partir du rôle « État-major »).

## 7. Relier le site aux rôles Discord (Admin > Paramètres)

- [ ] **« Vérifier l'intégration »** : toutes les lignes doivent être vertes (jeton, accès au serveur, lecture des rôles, salon d'annonce, gestion des rôles de grade, aucune permission superflue, rôles 501e / État-major, lien d'invitation).
- [ ] **Grades** : associer chacun des 17 grades à son rôle Discord. Faire ensuite revérifier l'intégration (la position du rôle du bot par rapport aux grades n'est contrôlée que pour les grades associés).
- [ ] **Responsabilités** : associer EM, CO, XO, Staff Toccoa, Recruteur, Organisateur Event, Komité des médailles, Police militaire. PL n'a pas de rôle Discord : il est donné d'office aux grades de la branche « Platoon Leader » (Sgt, S/Sgt, Sfc).
- [ ] **Compagnies et platoons** : associer le rôle de chaque compagnie et de chaque platoon (État-major = rôle des chefs de pôle).
- [ ] Contrôler le salon d'annonce, le lien d'invitation, l'option de mention des récipiendaires et le texte de consentement.
- [ ] Médailles : le catalogue existe déjà (sans rôle Discord). Une médaille **créée** depuis l'admin crée automatiquement un rôle Discord sans permission.
- [ ] Cliquer sur **« Resynchroniser les rôles »** pour recalculer ton grade et tes responsabilités.

## 8. Vérifications fonctionnelles

- [ ] Un vrai membre (rôle « 501e ») se connecte : il apparaît dans l'annuaire avec son grade et ses responsabilités.
- [ ] Changer un rôle de grade sur Discord : le bot relaie le changement en quelques secondes et la promotion arrive dans **Admin > À annoncer**.
- [ ] Promouvoir un membre depuis l'admin : son rôle de grade change sur Discord.
- [ ] Publier une annonce test : le message arrive dans le salon d'annonce.
- [ ] Retirer le rôle « 501e » à un compte test : son profil est masqué immédiatement.
- [ ] Logs de l'API au premier démarrage : « Référentiel de villes importé » (~240 000 villes, moins d'une minute).
- [ ] Recherche de ville dans « Mon profil » : un petit village (ex. « Saint-Martin ») est trouvé, avec son département (pas la liste de démo).
- [ ] `docker compose exec db psql -U 501e -d 501e -c "SELECT count(*) FROM \"User\" WHERE \"discordId\" LIKE 'demo-%';"` renvoie `0`.

## 9. Après la mise en route

- [ ] Mettre en place les sauvegardes quotidiennes chiffrées de la base **et** du volume `storage` (voir README, section « Déploiement »).
- [ ] Prévenir la communauté : **chaque membre doit se connecter une fois** au site pour y apparaître. Le site ne crée un compte qu'à la première connexion ; la synchronisation périodique et le bot ne mettent à jour que les comptes déjà connus.
- [ ] Ne plus jamais lancer `npm run db:seed` ni `npm run db:reset` contre la base de production (la base écoute sur `127.0.0.1:5432` de l'hôte : un `.env` local mal pointé suffirait).

## 10. À chaque mise à jour du code

Une migration Prisma non appliquée fait planter l'API en **erreur 500** : le client Prisma réclame une colonne qui n'existe pas encore en base. C'est arrivé en dev avec `20261006120000_medal_discord_role` (`Medal.discordRoleId`), qui cassait la liste des membres.

- [ ] Faire une sauvegarde de la base (commande de l'étape 1) si la mise à jour contient une nouvelle migration (`apps/api/prisma/migrations/`).
- [ ] **Reconstruire** l'image, pas seulement redémarrer : les migrations sont copiées dans l'image, et `prisma migrate deploy` ne s'exécute qu'au démarrage du conteneur `api`.

  ```bash
  git pull
  docker compose --profile discord up -d --build
  ```

- [ ] Dans `docker compose logs api`, vérifier que la ligne `All migrations have been successfully applied.` apparaît (ou `No pending migrations to apply.`) et que l'API démarre sans erreur.
- [ ] Contrôler l'état des migrations : `docker compose exec api npx prisma migrate status` doit indiquer `Database schema is up to date!`.
- [ ] Ouvrir l'annuaire des membres (`/api/members` doit répondre 200).

En dev, faire de même après chaque `git pull` ou chaque modification de `schema.prisma` : `npm run db:migrate` (et jamais `db:reset` si l'on veut garder ses données).
