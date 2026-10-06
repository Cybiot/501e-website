# Registre des activités de traitement — Site 501st PIR

> Article 30 du RGPD. À compléter par le responsable de traitement (éléments entre crochets) et à tenir à jour à chaque évolution du site.

**Responsable de traitement** : [Nom de l'association ou du responsable], [adresse], [contact].
**Référent données personnelles** : [Nom], [contact].
**Date de création** : 2026-09-30. **Dernière mise à jour** : 2026-09-30.

## Sous-traitants et destinataires

| Destinataire | Rôle | Localisation | Garanties |
| --- | --- | --- | --- |
| [Hébergeur] | Hébergement du site, de la base et des images | Union européenne | [DPA / contrat] |
| Discord Inc. | Authentification OAuth2, lecture des rôles, annonces (médailles, promotions) | États-Unis | Clauses contractuelles types / Data Privacy Framework (à vérifier) |
| Fondation OpenStreetMap (ou fournisseur configuré) | Tuiles du fond de carte, chargées par le navigateur des membres sur la page Carte | Royaume-Uni / UE | Politique d'usage des tuiles |
| Référentiel de villes GeoNames (dans la base du site) | Géocodage des villes | Même serveur que le site | Aucun transfert : seul le fichier public GeoNames est téléchargé, aucune recherche n'est envoyée |

## Traitements

### T1 — Authentification et statut de membre

| Rubrique | Contenu |
| --- | --- |
| Finalité | Permettre la connexion via Discord et calculer le statut (visiteur, membre, admin) à partir des rôles |
| Base légale | Intérêt légitime (fonctionnement de la communauté) |
| Personnes | Utilisateurs se connectant avec Discord |
| Données | Identifiant Discord, pseudo, URL d'avatar, rôles sur le serveur, date d'arrivée sur le serveur, dates de connexion |
| Durée | Tant que la personne est membre ; 30 jours après la perte du rôle ; 30 jours d'inactivité pour un connecté jamais membre ; 24 mois d'inactivité |
| Sécurité | Sessions hachées, cookies HttpOnly/Secure/SameSite, révocation immédiate du jeton OAuth, contrôle d'accès serveur |

### T2 — Annuaire et fiches membres

| Rubrique | Contenu |
| --- | --- |
| Finalité | Présenter les membres (grade, médailles, responsabilités, phrase) |
| Base légale | Intérêt légitime pour l'affichage aux membres ; consentement pour la visibilité publique (retirable à tout moment) |
| Données | Pseudo, avatar ou image approuvée, grade et historique des promotions, responsabilités, médailles et motifs, phrase personnalisée, ancienneté |
| Destinataires | Public si le profil est public ; sinon membres connectés uniquement |
| Durée | Identique à T1 |

### T3 — Image personnalisée

| Rubrique | Contenu |
| --- | --- |
| Finalité | Personnaliser la carte membre, après modération |
| Base légale | Consentement |
| Données | Image réencodée sans métadonnées, statut de modération, motif de refus |
| Durée | Jusqu'au remplacement, au retrait du consentement ou à la suppression du compte ; images refusées supprimées sous 30 jours |

### T4 — Carte des membres

| Rubrique | Contenu |
| --- | --- |
| Finalité | Favoriser le lien social entre membres |
| Base légale | Consentement explicite et séparé (opt-in) |
| Données | 2 villes au maximum : libellé, pays, coordonnées arrondies à environ 1 km puis décalées de ±2 km |
| Destinataires | Membres connectés uniquement |
| Durée | Jusqu'à suppression par le membre, retrait du consentement (effet immédiat) ou suppression du compte |

### T5 — Décorations et annonces Discord

| Rubrique | Contenu |
| --- | --- |
| Finalité | Attribuer des médailles et les annoncer sur le serveur Discord |
| Base légale | Intérêt légitime |
| Données | Membre, médaille, motif (200 caractères maximum), auteur, dates ; mention Discord dans l'annonce |
| Durée | Identique au compte du membre |

### T6 — Journal d'audit et notifications administrateurs

| Rubrique | Contenu |
| --- | --- |
| Finalité | Sécurité, traçabilité des actions d'administration, suivi du recrutement |
| Base légale | Intérêt légitime |
| Données | Acteur, action, cible, détails, empreinte salée de l'IP (jamais l'IP en clair) ; notification « Rejoindre » anonyme, avec l'ID Discord seulement si la personne est connectée |
| Destinataires | Administrateurs |
| Durée | 12 mois ; anonymisation de l'acteur en cas de suppression de compte |

### T7 — Consentements

| Rubrique | Contenu |
| --- | --- |
| Finalité | Prouver le recueil et le retrait des consentements |
| Base légale | Obligation légale (art. 7.1 RGPD) |
| Données | Version du texte, choix (profil public, image, carte), date |
| Durée | Identique au compte |

## Droits des personnes

Accessibles depuis « Mon profil » : accès et portabilité (export JSON), rectification, effacement (suppression du compte), retrait des consentements, limitation (masquage du profil). Les autres demandes se font à [contact].

## Mesures de sécurité

HTTPS, en-têtes de sécurité et CSP, protection CSRF, limitation de débit, validation stricte des entrées, réencodage des images, pseudonymisation des IP, cloisonnement réseau (seul le front est exposé), sauvegardes quotidiennes chiffrées stockées dans l'UE, chiffrement du stockage au repos (disque chiffré de l'hébergeur), procédure de gestion des violations (README).
