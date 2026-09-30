# Spécifications fonctionnelles — Site officiel de la communauté RP « 501st PIR » (Squad 44)

> **Version** : 1.0 (brouillon pour génération initiale par IA) **Langue du site** : Français (architecture prête pour l'i18n : EN à terme) **Public cible du document** : une IA de génération de code chargée de produire une **première version fonctionnelle** (MVP complet) du site.

------

## 0. Instructions à destination de l'IA génératrice

1. Lis l'intégralité du document avant de générer du code.
2. Génère un projet **complet, exécutable et documenté** : front, back, schéma de base de données, migrations, seed de données de démonstration, bot Discord, `README.md` (installation, variables d'environnement, lancement local via Docker Compose).
3. Quand une information manque, applique l'**hypothèse par défaut** indiquée dans ce document (marquée `[HYPOTHÈSE]`) et centralise le paramétrage dans des variables d'environnement ou une table `settings`.
4. Toute règle marquée **MUST** est obligatoire. **SHOULD** est recommandée. **MAY** est optionnelle.
5. Privilégie la lisibilité, le typage strict et des composants réutilisables. Ne code en dur aucun identifiant Discord (rôles, salons, serveur).
6. Les textes d'interface sont en français, externalisés dans des fichiers de traduction.
7. Le contenu éditorial (histoire du 501st, etc.) est fourni en **placeholders réalistes** modifiables via un fichier de contenu ou l'admin.

------

## 1. Contexte et objectifs

### 1.1 Contexte

Communauté francophone de jeu de rôle (RP) sur le jeu **Squad 44**, incarnant le **501st Parachute Infantry Regiment (501st PIR)** de la **101st Airborne Division** pendant la Seconde Guerre mondiale.

### 1.2 Objectifs du site

- Présenter la communauté et attirer de nouveaux joueurs (**vitrine**).
- Valoriser les membres (grades, médailles, responsabilités) et l'historique des batailles.
- Offrir aux membres un espace privé : profil, carte des membres, batailles détaillées, suivi des formations.
- Donner aux administrateurs des outils de gestion (médailles, batailles, formations, modération, logs) synchronisés avec **Discord**, qui reste la source de vérité pour les rôles.

### 1.3 Principe directeur UX/UI

Le thème est historique, mais **l'expérience doit être résolument moderne** : interface épurée, fluide, rapide, accessible. L'ambiance militaire est évoquée par des touches subtiles (palette, typographie, textures légères, iconographie), **jamais au détriment de l'ergonomie**. Pas de « site vintage » : pas de faux papier déchiré envahissant, pas de police illisible pour le corps de texte.

------

## 2. Stack technique recommandée `[HYPOTHÈSE]`

| Couche                    | Choix par défaut                                             |
| ------------------------- | ------------------------------------------------------------ |
| Back Stack                | Node js                                                      |
| Framework Front           | Angular                                                      |
| UI                        | CSS personnalisé                                             |
| Base de données           | **PostgreSQL** (hébergement en local) + PostGIS              |
| Authentification          | côté back avec provider Discord (OAuth2)                     |
| Carte                     | fond de carte sobre, sans dépendance à Google                |
| Géocodage des villes      | Service respectueux du RGPD (ex. Photon/Nominatim auto-hébergé ou API UE) via le back uniquement |
| Bot / intégration Discord | **discord.js** (processus séparé ou route serveur)           |
| Stockage d'images         | Volume local avec accès sécurisé                             |
| Conteneurisation          | Docker + Docker Compose (app, db, bot)                       |

------

## 3. Design, UX et UI

### 3.1 Direction artistique

- Palette

   (tokens CSS, modifiable) :

  - Fond : gris-noir chaud (`#0E100D`), surfaces `#161A14` / `#1F241C`
  - Accent principal : **vert olive / vert « OD »** (`#6B7F3A`), accent secondaire : **or terni** (`#C9A24B`) pour médailles et éléments d'honneur
  - Texte : `#ECEFE6` (principal), `#A3AA96` (secondaire)
  - États : succès, alerte, erreur cohérents et contrastés

- **Typographies** : titres avec une police à caractère (ex. *Oswald*, *Barlow Condensed* ou une slab sobre), corps en sans-serif lisible (ex. *Inter*). Une police « machine à écrire » (*Special Elite*/*IBM Plex Mono*) MAY être utilisée pour de petits éléments décoratifs (étiquettes, tampons « CONFIDENTIEL »).

- **Iconographie** : icônes linéaires modernes (Lucide). Insigne du 501st (« Screaming Eagles » / insigne régimentaire) en placeholder SVG.

- **Effets** : micro-animations douces (apparition au scroll, hover sur cartes, transitions de page), effet parallaxe léger sur le hero, **respect de `prefers-reduced-motion`**.

- **Éléments signature** : cartes membres façon « plaque d'identité / dog tag », tampons « CONFIDENTIEL » sur le contenu réservé, timeline verticale pour les batailles, rubans de médailles.

### 3.2 Principes d'ergonomie

- **Mobile-first**, responsive de 360 px à 4K.
- Navigation claire : barre de navigation sticky, menu burger sur mobile, fil d'Ariane sur les pages profondes.
- Feedback systématique : skeleton loaders, toasts, états vides illustrés, messages d'erreur explicites.
- Performance : LCP < 2,5 s, images optimisées (WebP/AVIF, lazy-loading), pagination ou scroll infini.
- **Accessibilité WCAG 2.1 AA** : contrastes, navigation clavier, focus visible, labels ARIA, texte alternatif.
- **SEO** (pages publiques) : SSR/SSG, balises meta, Open Graph (aperçu Discord agréable), sitemap, `robots.txt`.

### 3.3 Navigation par mode

- **Déconnecté** : Accueil · La communauté · Membres · Batailles · Rejoindre · [Se connecter avec Discord]
- **Connecté (membre)** : idem + Carte · Formations · Mon profil (menu avatar)
- **Admin** : idem + entrée « Administration » (sous-navigation dédiée dans un layout de type dashboard)
- Un **badge de statut** discret (Visiteur / Membre / Admin) est visible dans le menu utilisateur.

------

## 4. Rôles, statuts et permissions

### 4.1 Hiérarchie

`Déconnecté < Connecté (Membre) < Admin` — chaque niveau **hérite** des droits du précédent.

### 4.2 Détermination du statut (via Discord)

- **MUST** : le statut est calculé à partir des **rôles Discord** de l'utilisateur sur le serveur de la communauté.

- Configuration par variables d'environnement / table 

  ```
  settings
  ```

   :

  - `DISCORD_GUILD_ID`
  - `DISCORD_MEMBER_ROLE_IDS` (liste : un ou plusieurs rôles donnant le statut Membre)
  - `DISCORD_ADMIN_ROLE_IDS` (liste : rôles donnant le statut Admin)
  - Table de correspondance **grades** ↔ IDs de rôles Discord (voir §7)

- **Cas « connecté non-membre »** : un utilisateur authentifié via Discord mais **sans rôle membre** (ou absent du serveur) est traité **exactement comme un visiteur** (aucune fonctionnalité membre). Un bandeau discret peut lui indiquer : « Tu n'es pas encore membre de la 501e — rejoins-nous ! » avec un lien vers la page Rejoindre.

- Synchronisation des rôles

   :

  - À chaque connexion (**MUST**).
  - Rafraîchissement périodique (job, ex. toutes les 15 min) **et** via événements du bot (`guildMemberUpdate`) (**SHOULD**).
  - Si un membre perd son rôle, son accès est révoqué à sa prochaine requête (vérification côté serveur, pas seulement dans le JWT/session ; durée de cache courte).

### 4.3 Matrice de permissions

| Fonctionnalité                                     | Déconnecté / non-membre | Membre | Admin |
| -------------------------------------------------- | ----------------------- | ------ | ----- |
| Site vitrine                                       | ✅                       | ✅      | ✅     |
| Liste et fiches membres (infos publiques)          | ✅                       | ✅      | ✅     |
| Batailles — vue publique                           | ✅                       | ✅      | ✅     |
| Batailles — informations confidentielles           | ❌                       | ✅      | ✅     |
| Carte des membres                                  | ❌                       | ✅      | ✅     |
| Mon profil (voir + éditer champs autorisés)        | ❌                       | ✅      | ✅     |
| Suivi de mes formations / inscription aux sessions | ❌                       | ✅      | ✅     |
| Attribution de médailles                           | ❌                       | ❌      | ✅     |
| Création de médailles                              | ❌                       | ❌      | ✅     |
| Gestion des batailles                              | ❌                       | ❌      | ✅     |
| Modération des images personnalisées               | ❌                       | ❌      | ✅     |
| Logs et notifications                              | ❌                       | ❌      | ✅     |
| Gestion des formations                             | ❌                       | ❌      | ✅     |
| Paramètres / correspondances de rôles              | ❌                       | ❌      | ✅     |

- **MUST** : les permissions sont appliquées **côté serveur** (middleware + vérification dans chaque route/action), jamais uniquement côté UI.
- Les données confidentielles ne doivent **jamais** être présentes dans le HTML/JSON servi à un visiteur (pas de simple masquage CSS).

------

## 5. Authentification Discord

### 5.1 Parcours

1. Bouton « Se connecter avec Discord » (header + pages concernées).
2. Redirection OAuth2 Discord, scopes minimaux : `identify` et `guilds.members.read` (**principe de minimisation** : pas d'`email` sauf nécessité avérée `[HYPOTHÈSE : pas d'email collecté]`).
3. Au retour : création/mise à jour de l'utilisateur (ID Discord, pseudo/nom d'affichage, avatar), récupération des rôles via l'API Discord (jeton utilisateur ou bot), calcul du statut.
4. Redirection vers la page d'origine ou vers « Mon profil » lors de la première connexion.
5. Déconnexion : bouton dans le menu avatar, invalidation de session.

### 5.2 Règles

- Sessions sécurisées (cookies `HttpOnly`, `Secure`, `SameSite=Lax`), durée configurable (par défaut 7 jours glissants).
- **Première connexion d'un membre** : affichage d'une **modale de consentement RGPD** (voir §12) à valider pour utiliser l'espace membre.
- Gestion des erreurs : refus d'autorisation Discord, serveur Discord indisponible, utilisateur banni → messages clairs.
- Aucune autre méthode de connexion (pas de mot de passe local).

------

## 6. Architecture de l'information (plan du site)

```
/                          Accueil (vitrine)
/communaute                Présentation : histoire, valeurs, fonctionnement, règlement
/communaute/regiment       Le 501st PIR : contexte historique
/membres                   Liste des membres (public)
/membres/[id]              Fiche membre (public)
/batailles                 Liste des batailles (public / enrichie si membre)
/batailles/[slug]          Détail d'une bataille
/rejoindre                 Comment rejoindre + bouton « Rejoindre la 501e »
/carte                     [Membre] Carte des membres
/formations                [Membre] Suivi de mes formations et catalogue
/profil                    [Membre] Mon profil
/admin                     [Admin] Tableau de bord
/admin/medailles           [Admin] Attribution des médailles + annonce
/admin/medailles/catalogue [Admin] Création / gestion des médailles
/admin/batailles           [Admin] Gestion des batailles
/admin/formations          [Admin] Gestion des formations
/admin/moderation          [Admin] Validation des images personnalisées
/admin/logs                [Admin] Logs et notifications
/admin/parametres          [Admin] Paramètres (rôles Discord, salons, etc.)
/mentions-legales, /confidentialite, /cookies
```

------

## 7. Modèle de données (conceptuel)

> L'IA doit en dériver un schéma Prisma complet avec relations, index et contraintes.

- **User** : `id`, `discordId` (unique), `displayName`, `discordAvatarUrl`, `status` (calculé : member/admin/none), `rankId`, `joinedAt`, `lastLoginAt`, `consentAcceptedAt`, `consentVersion`, `publicProfileEnabled` (bool, défaut true), `deletedAt`.
- **Rank (Grade)** : `id`, `name`, `abbreviation`, `order`, `discordRoleId`, `iconUrl`. `[HYPOTHÈSE]` Seed : Private, Private First Class, Corporal, Sergeant, Staff Sergeant, Second Lieutenant, First Lieutenant, Captain, Major (personnalisable).
- **Responsibility** : `id`, `name`, `description`, `discordRoleId` (optionnel). Liaison N–N avec User (ex. Chef de section, Instructeur, Recruteur, Modérateur…).
- **Profile** : `userId`, `tagline` (max 140 car.), `customImageId` (image approuvée en cours), `pendingImageId`.
- **CustomImage** : `id`, `userId`, `storageKey`, `status` (`pending` / `approved` / `rejected`), `rejectionReason`, `submittedAt`, `reviewedAt`, `reviewedBy`.
- **Medal** : `id`, `name`, `description`, `imageUrl`, `category`, `discordRoleId`, `order`, `isActive`.
- **MedalAward** : `id`, `userId`, `medalId`, `reason` (max 200 car.), `awardedBy`, `awardedAt`, `announcedAt` (nullable), `announcementId` (nullable), `revokedAt` (nullable).
- **Announcement** : `id`, `createdBy`, `createdAt`, `discordMessageId`, `channelId`, `awardsCount`.
- **Battle** : `id`, `slug`, `name`, `historicalDate`, `historicalContext`, `mapName` (carte Squad 44), `eventDate` (date de la session RP), `status` (`planned` / `ongoing` / `finished`), `result` (`victory` / `defeat` / `draw` / `null`), `publicSummary`, `coverImageUrl`.
- **BattleConfidential** : `battleId`, `briefing`, `objectives`, `debrief`, `casualties`/`participantsCount`, `notes`, `attachments`.
- **BattleUpdate** (suivi en cours) : `id`, `battleId`, `content`, `createdBy`, `createdAt`, `visibility` (`public` / `members`).
- **Training (Formation)** : `id`, `name`, `description`, `prerequisites` (N–N vers Training), `instructorId`, `durationEstimate`, `discordRoleId` (optionnel, attribué à la validation), `isActive`.
- **TrainingSession** : `id`, `trainingId`, `startsAt`, `location` (ex. salon vocal), `capacity`, `instructorId`.
- **TrainingEnrollment** : `id`, `userId`, `trainingId`, `sessionId` (nullable), `status` (`registered` / `in_progress` / `validated` / `failed` / `cancelled`), `validatedAt`, `validatedBy`, `comment`.
- **MemberLocation** : `id`, `userId`, `cityLabel`, `country`, `lat`, `lng` (**précision ville uniquement**), `createdAt`. Max **2** par utilisateur. Contrainte applicative + BDD.
- **Notification** : `id`, `type`, `payload` (JSON), `createdAt`, `readAt`, `readBy`.
- **AuditLog** : `id`, `actorId` (nullable), `action`, `targetType`, `targetId`, `metadata` (JSON), `createdAt`, `ipHash` (voir RGPD).
- **Setting** : `key`, `value` (JSON) — rôles Discord admin/membre, salon des annonces, etc.

------

## 8. Fonctionnalités détaillées

### 8.1 (Déconnecté - V1) Site vitrine

**Objectif** : présenter la communauté et donner envie de la rejoindre.

**Pages et sections**

- **Accueil** : hero plein écran (visuel sombre, titre fort, sous-titre, CTA « Rejoindre la 501e » + « Découvrir la communauté »), chiffres clés animés (nombre de membres, batailles menées, années d'existence), aperçu des dernières batailles, aperçu de membres à l'honneur, section « Comment ça marche », section FAQ, footer complet.
- **La communauté** : présentation, valeurs (sérieux, camaraderie, fair-play), déroulement d'une session type, organisation (sections, hiérarchie), règlement résumé.
- **Le 501st PIR** : contexte historique (Normandie, Market Garden, Bastogne…) sous forme de **timeline interactive**, avec sources/crédits.
- **Rejoindre** : étapes (prérequis, installation Squad 44, entrée sur Discord, entretien, formation initiale), FAQ, bouton **« Rejoindre la 501e »**.

**Règles de gestion**

- Contenu **statique** éditable via fichiers de contenu (Markdown/JSON) dans le dépôt. `[HYPOTHÈSE]` : pas de CMS en v1.
- Le bouton **« Rejoindre la 501e »** redirige vers l'invitation Discord configurée (`DISCORD_INVITE_URL`) **et** génère une **notification admin** « Quelqu'un a cliqué sur Rejoindre la 501e » (événement **anonyme** : aucune IP ni identifiant stocké ; si l'utilisateur est connecté, son ID Discord peut être associé).
- Anti-spam : limite de fréquence sur l'événement (rate-limit) pour éviter le flood de notifications.

**Critères d'acceptation**

- Le site vitrine est entièrement lisible sans JavaScript côté contenu (SSR/SSG).
- Score Lighthouse ≥ 90 (Performance, Accessibilité, SEO) sur l'accueil.

------

### 8.2 (Déconnecté - V1) Membres

**Liste `/membres`**

- Grille de **cartes stylisées « dog tag »** : avatar/image personnalisée approuvée (sinon avatar Discord ou visuel par défaut), nom, **grade** (insigne + libellé), 2–3 **médailles** en miniature (+N), responsabilités (badges).
- Filtres : par grade, par responsabilité, par médaille ; recherche par nom ; tri (grade, ancienneté, alphabétique).
- Groupement possible par section/grade avec en-têtes.
- Pagination ou scroll infini.

**Fiche `/membres/[id]`**

- Image personnalisée en grand (ou avatar), nom, grade, ancienneté dans la communauté.
- **Phrase personnalisée** (citation).
- **Rubans/médailles** avec au survol/clic : nom, description de la médaille, date d'obtention et **motif court**.
- **Responsabilités** avec description.
- Partage : lien direct + Open Graph.

**Règles de gestion**

- Seules les **informations publiques** listées ci-dessus sont exposées aux non-connectés (aucune ville, aucune formation, aucun log).
- Seuls les **membres** (statut Membre/Admin) apparaissent.
- **Respect RGPD** : un membre peut **masquer son profil au public** (option `publicProfileEnabled = false` dans Mon profil) ; il reste visible des autres membres connectés.
- Image personnalisée affichée **uniquement si `approved`** ; sinon fallback avatar Discord.
- Données grade/responsabilités issues des **rôles Discord** synchronisés.

**Critères d'acceptation**

- Un membre ayant masqué son profil n'apparaît ni dans la liste ni via URL directe pour un visiteur (404).
- L'affichage reste fluide avec 300 membres.

------

### 8.3 (Déconnecté - V2) Batailles

**Liste `/batailles`**

- Présentation en **timeline verticale** ou grille de cartes, triées par date de session.
- Chaque carte : nom, date historique, carte Squad 44, **badge résultat** (Victoire / Défaite / Match nul / En cours / Planifiée) avec code couleur + icône (ne pas se reposer uniquement sur la couleur).
- Filtres : résultat, période historique, carte.

**Détail `/batailles/[slug]`**

- Bandeau visuel, contexte historique, résumé public, résultat, éléments de chronologie publics (BattleUpdate `public`).
- **Pour un visiteur** : un encart verrouillé stylisé (tampon « CONFIDENTIEL ») indique qu'il existe des informations réservées aux membres, avec CTA connexion/rejoindre.

**Règles de gestion**

- Les batailles `planned` MAY être affichées avec date et teaser seulement.
- Aucune donnée confidentielle dans la réponse serveur pour un visiteur.

------

### 8.4 (Connecté - V2) Batailles — vue membre

- Tout ce qui est visible en public **plus** : briefing, objectifs, débriefing, effectifs/pertes, notes, pièces jointes éventuelles, timeline complète (`members`).
- Pour une bataille **en cours** : suivi des mises à jour en quasi temps réel (rafraîchissement automatique ou SSE), indication « En cours » animée.
- Mise en avant des informations confidentielles par un traitement visuel distinctif (encart « dossier confidentiel »).

------

### 8.5 (Connecté - V1) Carte du monde des membres

**Objectif** : visualiser où vivent les membres pour favoriser le lien social.

**Fonctionnement**

- Carte interactive plein écran avec **marqueurs** (avatar rond ou pin stylisé) et **clustering** plusieurs.
- Clic/tap sur un marqueur : mini-carte membre (nom, grade, phrase, lien vers fiche) et ville.
- **Recherche** d'un membre (zoom automatique) et filtres (grade, responsabilité).
- **Panneau latéral « Mes villes »** : ajouter jusqu'à **2 villes** via un champ avec **autocomplétion** ; modifier/supprimer à tout moment.
- Liste des membres par pays/région en complément (utile mobile).

**Règles de gestion**

- **Maximum 2 villes par membre**, précision **ville uniquement** (jamais d'adresse) ; en stockage, coordonnées arrondies (~ 2 décimales) et/ou léger décalage aléatoire déterministe pour éviter tout risque de localisation fine.
- **Consentement explicite et séparé** avant de publier sa position (case dédiée + explication) ; **opt-in**, jamais par défaut.
- Visible **uniquement par les membres connectés** (statut Membre/Admin).
- Suppression immédiate et définitive d'une ville à la demande du membre.
- Le géocodage passe par le back (pas d'appel direct du navigateur vers un tiers avec des données personnelles).

**Critères d'acceptation**

- Un visiteur ou un non-membre reçoit 401/403 sur l'API de la carte.
- Un membre ne peut pas enregistrer une 3ᵉ ville (message clair).

------

### 8.6 (Connecté - V1) Onglet « Profil »

**Consulter ses informations**

- Identité Discord (nom, avatar), grade, responsabilités, médailles (avec motifs), ancienneté, formations validées (résumé), villes déclarées, statut de son image personnalisée.

**Modifier**

- **Phrase personnalisée** : texte court (max 140 caractères), compteur, filtrage basique des contenus interdits, aperçu en direct de la carte « dog tag ».

- Image personnalisée

   :

  - Upload (JPG/PNG/WebP, ≤ 2 Mo, ratio recommandé portrait 3:4, recadrage intégré côté client).
  - Après envoi : statut **« En attente de validation »** ; l'image actuelle approuvée reste affichée tant que la nouvelle n'est pas validée.
  - Si **rejetée** : notification/affichage du motif et possibilité de renvoyer.
  - Génère une **notification admin** « Demande d'image personnalisée ».

- **Visibilité** : toggle « Afficher mon profil sur le site public » ; gestion de ses villes (lien vers la carte).

- **Non modifiable** par le membre : grade, médailles, responsabilités (gérés via Discord/admin).

**Espace RGPD (dans Profil)**

- Bouton **« Télécharger mes données »** (export JSON).
- Bouton **« Supprimer mon compte et mes données »** (avec confirmation), voir §12.
- Historique de consentement.

------

### 8.7 (Connecté - V2) Suivi des formations 

**Vue membre `/formations`**

- **Mon parcours** : liste des formations avec statut (Non commencée / Inscrit / En cours / Validée / Échouée), barre de progression globale, date de validation.
- **Catalogue** : toutes les formations actives avec description.

**Règles de gestion**

- La validation est faite **uniquement par un admin** (ou instructeur `[HYPOTHÈSE]` : uniquement admin en v2).
- À validation, si la formation est liée à un rôle Discord, le bot attribue ce rôle `[HYPOTHÈSE]` (option activable par formation).
- Notification interne (et MAY par message privé Discord) lors du changement de statut.

------

### 8.8 (Admin - V1) Attribution des médailles

**Contexte** : les médailles sont identiques sur le site et sur Discord ; côté Discord, elles sont représentées par des **rôles prédéfinis**.

**Écran `/admin/medailles`**

1. **Sélection du membre** (recherche par nom, autocomplétion).

2. **Sélection de la médaille** dans le **catalogue existant** (aperçu image + description).

3. **Texte court** (max 200 caractères) décrivant les circonstances d'obtention (obligatoire).

4. Bouton 

   « Attribuer »

    :

   - Ajoute le **rôle Discord** correspondant via le bot,
   - Enregistre un `MedalAward` avec `announcedAt = null`,
   - Écrit dans les **logs**,
   - Affiche un toast de confirmation (ou d'erreur avec possibilité de réessayer si l'appel Discord échoue).

5. **Liste « À annoncer »** : toutes les attributions **enregistrées depuis la dernière annonce** (membre, médaille, motif, date), avec possibilité de **retirer** une attribution (retrait du rôle Discord + log).

6. Bouton 

   « Lancer l'annonce Discord »

    :

   - Ouvre un **aperçu** de l'embed Discord,
   - À la confirmation, le bot poste dans le salon configuré (`DISCORD_ANNOUNCE_CHANNEL_ID`) un **message/embed récapitulatif** de toutes les médailles non encore annoncées (regroupées par médaille ou par membre, avec mention `@membre`, nom de la médaille, motif),
   - Les attributions sont marquées comme annoncées (`announcedAt`, `announcementId`),
   - Une entrée d'historique est ajoutée (**historique des annonces** consultable).
   - Gestion des limites de taille de Discord (découpage automatique en plusieurs messages/embeds si nécessaire).
   - Si aucune attribution en attente : bouton désactivé.

**Règles de gestion**

- Un membre peut recevoir plusieurs fois une même médaille ? **oui** par défaut (un membre peut avoir plusieurs fois une médaille donnée), paramétrable par médaille (`repeatable`).
- Idempotence : un double-clic ne doit pas créer deux attributions. Une validation doit être nécessaire pour pouvoir attribuer à nouveau une médaille. 

------

### 8.9 (Admin) Création de médailles

**Écran `/admin/medailles/catalogue`**

- Liste/grille des médailles existantes (modifier, désactiver ; suppression uniquement si jamais attribuée).

- Formulaire de création : nom, description (conditions d'obtention générales), 

  image/ruban

   (upload, SVG/PNG), catégorie (ex. Bravoure, Service, Formation, Événement, Ancienneté), ordre d'affichage, 

  ```
  repeatable
  ```

  , et 

  lien avec le rôle Discord

   :

  - Option A : **associer un rôle Discord existant** (liste déroulante via le bot),
  - Option B : **créer automatiquement le rôle** via le bot (nom + couleur).

- Aperçu de la médaille comme elle apparaîtra sur les cartes membres.

- Toute création/modification est journalisée.

------

### 8.10 (Admin) Gestion des batailles

**Écran `/admin/batailles`**

- **Liste** avec filtres (statut, résultat) et actions rapides.
- **Création/édition** : nom, slug auto, dates, carte Squad 44, contexte historique, résumé public, image de couverture, statut, résultat ; onglet **Confidentiel** (briefing, objectifs, débriefing, effectifs/pertes, notes, pièces jointes) ; éditeur riche (Markdown avec prévisualisation).
- **Suivi des batailles en cours** : tableau de bord d'une bataille `ongoing` avec **fil de mises à jour** (ajout rapide d'une entrée, choix de la visibilité `public`/`members`), changement de statut (Planifiée → En cours → Terminée), saisie du **résultat** à la clôture.
- MAY : publication automatique d'un message Discord à la création/clôture d'une bataille (option `[HYPOTHÈSE]` désactivée par défaut).
- Toutes les actions sont journalisées ; une suppression est une **suppression logique** (corbeille) avec confirmation.

------

### 8.11 (Admin) Logs et notifications

**Écran `/admin/logs`** avec deux onglets :

**Notifications** (actionnables)

- Types : « Quelqu'un a cliqué sur *Rejoindre la 501e* », « Demande d'image personnalisée » (lien direct vers la modération), nouvelle connexion d'un nouveau membre, échec d'une action Discord, inscription à une formation, etc.
- États lu/non lu, marquer tout comme lu, filtres par type, **badge de compteur** dans la navigation admin, mise à jour en quasi temps réel.

**Logs (journal d'audit)**

- Tableau paginé : date, acteur, action, cible, détails (JSON dépliable).
- Filtres : période, acteur, type d'action ; recherche ; **export CSV**.
- Événements journalisés : connexions/déconnexions, attributions/retraits de médailles, annonces, créations/modifs de batailles, formations, validations/rejets d'images, modifications de paramètres, erreurs d'intégration Discord, demandes RGPD (export/suppression).
- Les logs sont **en lecture seule** (immuables depuis l'UI).
- **Rétention** : 12 mois puis purge automatique (voir §12).

**Modération des images (`/admin/moderation`)**

- File d'attente des images `pending` : aperçu large, membre concerné, boutons **Approuver / Rejeter** (motif obligatoire au rejet, avec motifs prédéfinis), navigation clavier rapide.
- L'approbation remplace l'ancienne image ; le rejet notifie le membre.

------

### 8.12 (Admin) Gestion des formations

**Écran `/admin/formations`**

- **Catalogue** : CRUD des formations (nom, description, prérequis, instructeur, rôle Discord lié optionnel, activation).
- **Sessions** : planification (date/heure, lieu/vocal, capacité, instructeur), liste des inscrits, émargement.
- **Validation** : tableau des inscrits par formation avec actions **Valider / Échec / Remettre en cours**, commentaire.
- **Vue par membre** : recherche d'un membre et visualisation/modification de son parcours.
- Vue synthèse : nombre de membres formés par formation, sessions à venir.

------

### 8.13 (Admin) Paramètres

- Correspondances **rôles Discord** ↔ statuts (Membre, Admin), grades, responsabilités.
- Salon d'annonces, lien d'invitation Discord.
- Test de connexion au bot/Discord (bouton « Vérifier l'intégration »).
- Gestion des versions du texte de consentement.

------

## 9. Intégration Discord (bot)

- Le bot (permissions minimales : `Manage Roles`, `Send Messages`, `Embed Links`, `View Channels`, lecture des membres) doit avoir un **rôle placé au-dessus** des rôles qu'il gère.
- Capacités : lecture des rôles d'un membre, ajout/retrait de rôle, création de rôle (option), liste des rôles, envoi d'embeds, MAY DM.
- **Gestion d'erreurs** : limites de débit (rate limits), file d'attente et **retry avec backoff**, journalisation des échecs, message clair côté admin.
- Événements écoutés : `guildMemberUpdate`, `guildMemberRemove` (mise à jour du statut/masquage).
- Aucune donnée personnelle n'est envoyée sur Discord au-delà du strict nécessaire (mention et informations de l'annonce).

------

## 10. API et routes (guide)

> L'IA choisit le style (Route Handlers / Server Actions / tRPC) mais doit respecter les mêmes contrôles d'accès.

- `GET /api/members` (public, filtré) · `GET /api/members/:id`
- `GET /api/battles` · `GET /api/battles/:slug` (contenu selon statut)
- `GET|POST|DELETE /api/me/locations` (membre) · `GET /api/map/members` (membre)
- `GET|PATCH /api/me/profile` · `POST /api/me/image` · `GET /api/me/export` · `DELETE /api/me`
- `GET /api/trainings` · `POST /api/trainings/:id/enroll` · `DELETE /api/trainings/:id/enroll`
- `POST /api/join-click` (public, rate-limité)
- `/api/admin/**` : médailles (award, revoke, catalog, announce), batailles, formations, modération, notifications, logs, settings — **toutes protégées Admin**.
- Validation des entrées avec **Zod**, réponses d'erreur normalisées, pagination cohérente.

------

## 11. Exigences non fonctionnelles

- **Sécurité** : protection CSRF, XSS (échappement + CSP stricte), SQL injection (ORM), en-têtes de sécurité (HSTS, X-Content-Type-Options, etc.), **rate-limiting** global et par route sensible, validation stricte des uploads (type MIME réel, taille, réencodage, **suppression des métadonnées EXIF**, noms de fichiers aléatoires), secrets uniquement en variables d'environnement, dépendances à jour.
- **Performance** : mise en cache (ISR/CDN) des pages publiques, requêtes optimisées (index), images responsives.
- **Fiabilité** : sauvegardes quotidiennes de la BDD (chiffrées, hébergement UE), healthcheck, gestion des erreurs avec pages 404/500 stylisées.
- **Observabilité** : logs applicatifs structurés (sans données personnelles inutiles).
- **Qualité** : ESLint/Prettier, CI (lint + tests + build), seed de données de démonstration (≥ 20 membres fictifs, 5 batailles, 8 médailles, 6 formations).
- **Compatibilité** : dernières versions de Chrome, Firefox, Safari, Edge ; iOS/Android.

------

## 12. Conformité RGPD (obligatoire — front, back, BDD)

### 12.1 Principes

- **Licéité et transparence** : base légale documentée par traitement (consentement pour profil public/image/localisation ; exécution du service / intérêt légitime pour le fonctionnement de la communauté).

- **Minimisation** : collecte limitée à `discordId`, pseudo, avatar, rôles ; **pas d'email**, pas de localisation précise.

- Limitation de la conservation

   :

  - Compte inactif > 24 mois : notification puis anonymisation/suppression `[HYPOTHÈSE]`.
  - Logs d'audit : 12 mois.
  - Images rejetées : suppression sous 30 jours.
  - Départ d'un membre (perte du rôle) : profil masqué immédiatement ; données supprimées/anonymisées après un délai configurable (30 jours par défaut).

- **Hébergement dans l'UE** ; sous-traitants listés (hébergeur, Discord, service de cartographie/géocodage) avec DPA le cas échéant.

### 12.2 Fonctionnalités à implémenter

- **Bandeau/gestion des cookies** : seuls des cookies **strictement nécessaires** (session) par défaut ; toute mesure d'audience éventuelle doit être **sans consentement requis** (ex. solution auto-hébergée respectueuse de la vie privée) ou soumise à opt-in. **Aucun tracker tiers** (pas de Google Analytics, pas de polices/CDN chargés depuis des serveurs tiers non maîtrisés : **auto-héberger les polices**).

- **Modale de consentement** à la première connexion, versionnée et horodatée ; consentements **granulaires** : (1) profil public, (2) image personnalisée, (3) localisation sur la carte.

- Droits des personnes

   (accessibles depuis Mon profil) :

  - **Accès / portabilité** : export JSON de toutes les données du membre.
  - **Rectification** : édition des champs modifiables.
  - **Effacement** : suppression de compte → suppression des données, des images, des villes ; anonymisation des logs (`actorId` remplacé, hachage) ; retrait des médailles côté site (les rôles Discord relèvent de Discord/admin).
  - **Opposition / retrait du consentement** : à tout moment, effet immédiat.
  - **Limitation** : masquage du profil.

- **Pages légales** : mentions légales, politique de confidentialité (finalités, bases légales, durées, destinataires, droits, contact DPO/référent), politique cookies.

- **Registre des traitements** : fichier `docs/rgpd-registre.md` généré avec le projet.

- **Sécurité des données** : chiffrement en transit (HTTPS/TLS) et au repos (BDD/stockage), accès BDD restreints, pseudonymisation des IP dans les logs (**hash salé** ou troncature, jamais d'IP en clair), gestion des violations de données (procédure documentée dans le README).

- **Privacy by design** : profil masquable, localisation opt-in, valeurs par défaut protectrices, aucune donnée confidentielle exposée aux non-membres.

------

## 13. Contenu et données de démonstration

- Textes placeholders en français, cohérents avec le thème (ne pas inventer de faits historiques précis non vérifiés ; rester général et signaler « à compléter »).
- Visuels : illustrations/photos libres de droits ou dégradés/motifs générés ; **aucun visuel protégé par copyright** ; insigne en SVG simple.
- Seed : grades, responsabilités, 8 médailles, 6 formations (ex. Formation initiale, Radio, Médecin, Sniper, Chef d'escouade, Commandement), 5 batailles (dont une en cours), ≥ 20 membres fictifs avec villes variées.

------

## 14. Livrables attendus de l'IA

1. Code source complet du projet (front, back, bot).
2. Schéma BDD + migrations + seed.
3. `docker-compose.yml` et `.env.example` documenté (toutes les variables : Discord OAuth, bot, guilde, rôles, salons, BDD, stockage, secrets).
4. `README.md` : installation, création de l'application Discord et du bot, lancement, tests, déploiement.
5. `docs/rgpd-registre.md` et pages légales de base.
6. Quelques tests (auth/permissions, quota 2 villes, workflow d'attribution + annonce, workflow de modération).

------

## 15. Hypothèses prises et questions ouvertes

> À valider par le commanditaire ; l'IA applique les hypothèses par défaut en attendant.

1. **Grades et responsabilités** : liste exacte et correspondance avec les rôles Discord ? *(Hyp. : liste standard US Army, modifiable.)*
2. **Rôles Discord** : un seul rôle « Membre » ou plusieurs ? Quels rôles pour Admin ? Existe-t-il un rôle « Recrue » à traiter comme membre ou non ?
3. **Médailles** : les rôles existent-ils déjà (association) ou faut-il que le site les crée ? Une médaille peut-elle être attribuée plusieurs fois au même membre ?
4. **Annonce Discord** : quel format souhaité (un embed unique groupé, un message par médaille) ? Quel salon ? Mention des membres ?
5. **Formations** : les instructeurs (non-admin) doivent-ils pouvoir valider ? La validation doit-elle donner un rôle Discord ? Y a-t-il des examens/notes ?
6. **Batailles** : quelles informations exactement sont « confidentielles » ? Faut-il gérer les effectifs/pertes par membre ? Des pièces jointes (cartes, PDF de briefing) ?
7. **Image personnalisée** : dimensions/format imposés ? Contenus interdits à lister ? Plusieurs modérateurs ou un seul ?
8. **Carte** : fond de carte préféré (sobre sombre, style « carte d'état-major » ?) ? Le membre peut-il masquer sa position aux autres membres tout en la gardant enregistrée ?
9. **Bouton « Rejoindre la 501e »** : simple lien d'invitation Discord, ou formulaire de candidature stocké sur le site ?
10. **Identité visuelle** : logo/charte existants ? Couleurs, polices, visuels imposés ?
11. **Hébergement et nom de domaine** : contraintes (VPS, Vercel, hébergeur UE) ? Responsable de traitement/DPO à mentionner dans les mentions légales ?
12. **Contenu éditorial** : qui fournit les textes (histoire, règlement, FAQ) ?
13. **Volume attendu** : nombre de membres (dizaines / centaines) et trafic visiteur.
14. **Visibilité par défaut** du profil public : opt-in ou opt-out ? *(Hyp. : visible par défaut avec information claire et possibilité de masquer ; à confirmer au regard de la base légale retenue.)*

------

*Fin du document.*