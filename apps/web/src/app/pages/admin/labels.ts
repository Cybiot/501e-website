/** Libellés lisibles des actions du journal et des types de notifications. */
export const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Connexion',
  'auth.logout': 'Déconnexion',
  'auth.login_failed': 'Échec de connexion',
  'user.status_changed': 'Changement de statut',
  'profile.updated': 'Profil modifié',
  'profile.visibility_changed': 'Visibilité du profil',
  'consent.accepted': 'Consentement',
  'image.submitted': 'Image envoyée',
  'image.approved': 'Image approuvée',
  'image.rejected': 'Image refusée',
  'location.added': 'Ville ajoutée',
  'location.deleted': 'Ville supprimée',
  'medal.created': 'Médaille créée',
  'medal.updated': 'Médaille modifiée',
  'medal.deleted': 'Médaille supprimée',
  'medal.awarded': 'Médaille attribuée',
  'medal.revoked': 'Médaille retirée',
  'promotion.dismissed': 'Promotion non annoncée',
  'announcement.published': 'Annonce publiée',
  'settings.updated': 'Paramètres modifiés',
  'discord.error': 'Erreur Discord',
  'gdpr.export': 'Export RGPD',
  'gdpr.delete': 'Suppression de compte',
  'retention.purge': 'Purge automatique',
};

export const NOTIFICATION_LABELS: Record<string, { label: string; icon: string }> = {
  join_click: { label: 'Clic sur « Rejoindre la 501e »', icon: 'message' },
  image_submitted: { label: 'Demande d’image personnalisée', icon: 'image' },
  new_member: { label: 'Nouveau membre connecté', icon: 'user' },
  discord_error: { label: 'Échec d’une action Discord', icon: 'alert-triangle' },
  inactive_account: { label: 'Compte bientôt inactif', icon: 'clock' },
};

export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
