# Lancer le projet

Guide express. Pour les détails, voir le [README](README.md).

---

## Avant tout (une seule fois)

Installe :

- **Node.js** 22.22.3 ou plus récent (ou 24.15+)
- **npm 11** : `npm install -g npm@11`
- **Docker Desktop**, qui doit être démarré

Crée ton fichier de configuration à partir du modèle :

```powershell
Copy-Item .env.example .env
```

(Sous Git Bash, macOS ou Linux : `cp .env.example .env`)

---

## Mode développement

### 1. Installer et préparer la base (une seule fois)

```powershell
npm install          # installe les dépendances
npm run db:up        # démarre la base de données (Docker)
npm run db:migrate   # crée les tables
npm run db:seed      # ajoute des données de démo (faux membres, médailles…)
```

### 2. Lancer le site (à chaque fois)

Ouvre **deux terminaux** :

| Terminal | Commande | Ce que ça lance |
| --- | --- | --- |
| 1 | `npm run dev:api` | L'API, sur http://localhost:3000 |
| 2 | `npm run dev:web` | Le site, sur **http://localhost:4200** |

Ouvre **http://localhost:4200** dans ton navigateur.

Pour te connecter, choisis un compte fictif sur la page Connexion. Par exemple, **Capt. Winters** est admin.

> Si tu as éteint ton PC, relance d'abord `npm run db:up` pour redémarrer la base.

### Commandes utiles en dev

```powershell
npm run dev:bot    # lance le bot Discord (seulement si DISCORD_MODE=live dans .env)
npm run db:reset   # efface la base et la recrée de zéro
npm test           # lance les tests
npm run lint       # vérifie la qualité du code
```

---

## Mode production (Docker)

### 1. Configurer `.env`

Dans `.env`, change au minimum :

```ini
NODE_ENV=production
PUBLIC_URL=https://ton-domaine.fr        # ou http://localhost:4000 pour tester en local
POSTGRES_PASSWORD=un-vrai-mot-de-passe
SESSION_SECRET=...                       # 32 caractères aléatoires minimum
HASH_SALT=...                            # 32 caractères aléatoires minimum
INTERNAL_API_TOKEN=...                   # 32 caractères aléatoires minimum
DISCORD_MODE=live                        # + les identifiants DISCORD_* (voir README)
GEOCODER=db                              # villes importées dans la base au 1er démarrage
```

Pour générer un secret aléatoire : `openssl rand -hex 32`

### 2. Tout démarrer

```powershell
docker compose up -d --build
```

Le site est servi sur **http://localhost:4000**. Les tables de la base sont créées automatiquement au démarrage.

### 3. Services en plus (facultatifs)

```powershell
docker compose --profile discord up -d bot         # le bot Discord
docker compose exec api node dist/scripts/import-cities.js   # remettre à jour la liste des villes (rarement utile)
```

### Commandes utiles en production

```powershell
docker compose ps               # voir ce qui tourne
docker compose logs -f api      # suivre les logs de l'API (ou web, bot, db…)
docker compose down             # tout arrêter (les données sont conservées)
docker compose up -d --build    # mettre à jour après une modification du code
```

> En vraie production, place un reverse proxy HTTPS (Caddy, Traefik ou Nginx) devant le port 4000. Pense aussi aux sauvegardes : voir la section « Déploiement » du [README](README.md).
