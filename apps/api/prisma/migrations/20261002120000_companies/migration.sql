-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "discordRoleId" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platoon" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "discordRoleId" TEXT,

    CONSTRAINT "Platoon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_discordRoleId_key" ON "Company"("discordRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "Platoon_discordRoleId_key" ON "Platoon"("discordRoleId");

-- CreateIndex
CREATE INDEX "Platoon_companyId_idx" ON "Platoon"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Platoon_companyId_name_key" ON "Platoon"("companyId", "name");

-- AddForeignKey
ALTER TABLE "Platoon" ADD CONSTRAINT "Platoon_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Compagnies (les textes et logos sont dans le contenu du site, par slug).
-- Rôles Discord des compagnies et des platoons à associer dans Admin > Paramètres > Compagnies.
INSERT INTO "Company" ("id", "slug", "name", "order") VALUES
  (gen_random_uuid()::text, 'steel-hawk', 'Steel Hawk', 10),
  (gen_random_uuid()::text, 'blood-wall', 'Blood Wall', 20),
  (gen_random_uuid()::text, 'sledge-hammer', 'Sledge Hammer', 30),
  (gen_random_uuid()::text, 'camp-toccoa', 'Camp Toccoa', 40)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Platoon" ("id", "companyId", "name", "order")
SELECT gen_random_uuid()::text, c."id", p."name", p."order"
FROM (VALUES
  ('steel-hawk', 'Platoon d''assaut', 10),
  ('steel-hawk', 'Platoon de soutien', 20),
  ('camp-toccoa', 'Instructeurs', 10),
  ('camp-toccoa', 'Recrues', 20)
) AS p("slug", "name", "order")
JOIN "Company" c ON c."slug" = p."slug"
ON CONFLICT ("companyId", "name") DO NOTHING;
