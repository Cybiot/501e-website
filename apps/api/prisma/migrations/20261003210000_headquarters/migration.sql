-- AlterTable
ALTER TABLE "Company" ADD COLUMN "headquarters" BOOLEAN NOT NULL DEFAULT false;

-- L'État-major, en tête des compagnies. Son rôle (chefs de pôle) se règle dans Admin > Paramètres.
INSERT INTO "Company" ("id", "slug", "name", "order", "headquarters") VALUES
  (gen_random_uuid()::text, 'etat-major', 'État-major', 0, true)
ON CONFLICT ("slug") DO NOTHING;
