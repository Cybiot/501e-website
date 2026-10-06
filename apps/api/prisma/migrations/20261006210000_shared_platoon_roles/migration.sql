-- Un rôle de platoon peut être partagé entre compagnies (« 1st Platoon »), pas au sein d'une compagnie.
DROP INDEX "Platoon_discordRoleId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Platoon_companyId_discordRoleId_key" ON "Platoon"("companyId", "discordRoleId");
