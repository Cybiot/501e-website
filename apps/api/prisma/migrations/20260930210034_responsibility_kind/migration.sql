-- CreateEnum
CREATE TYPE "ResponsibilityKind" AS ENUM ('hierarchy', 'pole');

-- AlterTable
ALTER TABLE "Responsibility" ADD COLUMN     "kind" "ResponsibilityKind" NOT NULL DEFAULT 'pole';

-- Responsabilités officielles de la communauté (rôle Discord à associer dans Admin > Paramètres).
INSERT INTO "Responsibility" ("id", "name", "description", "kind", "order") VALUES
  (gen_random_uuid()::text, 'EM - État-major', 'Direction de la communauté : décisions, organisation générale et arbitrages.', 'hierarchy', 0),
  (gen_random_uuid()::text, 'CO - Commanding Officer', 'Commande le régiment et fixe les orientations en opération.', 'hierarchy', 1),
  (gen_random_uuid()::text, 'XO - Executive Officer', 'Seconde le CO et le remplace en son absence.', 'hierarchy', 2),
  (gen_random_uuid()::text, 'PL - Platoon Leader', 'Commande un peloton lors des opérations.', 'hierarchy', 3),
  (gen_random_uuid()::text, 'Staff Toccoa', 'Encadre la formation des recrues au camp Toccoa.', 'pole', 10),
  (gen_random_uuid()::text, 'Recruteur', 'Accueille les candidats, mène les entretiens et les accompagne jusqu’à la formation initiale.', 'pole', 11),
  (gen_random_uuid()::text, 'Organisateur Event', 'Prépare et anime les événements et opérations spéciales.', 'pole', 12),
  (gen_random_uuid()::text, 'Komité des médailles', 'Étudie les propositions de décorations et prépare les attributions.', 'pole', 13),
  (gen_random_uuid()::text, 'Police militaire', 'Veille au respect du règlement sur le Discord et en jeu.', 'pole', 14)
ON CONFLICT ("name") DO NOTHING;
