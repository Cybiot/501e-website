-- Rôle Discord propre à chaque palier (bronze, argent, or) d'une médaille à paliers.
ALTER TABLE "Medal" ADD COLUMN "discordRoleBronzeId" TEXT,
ADD COLUMN "discordRoleSilverId" TEXT,
ADD COLUMN "discordRoleGoldId" TEXT;
