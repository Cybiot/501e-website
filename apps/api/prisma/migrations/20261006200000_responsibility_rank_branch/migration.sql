-- Responsabilité attribuée d'office par la branche du grade : le rôle Discord « Platoon Leader »
-- n'existe pas, le PL est donné aux Sgt, S/Sgt et Sfc (branche platoon_leader).
ALTER TABLE "Responsibility" ADD COLUMN "rankBranch" "RankBranch";

UPDATE "Responsibility" SET "rankBranch" = 'platoon_leader', "discordRoleId" = NULL
WHERE "name" ILIKE '%platoon leader%';

-- Membres actuels : sans attendre la prochaine synchronisation des rôles.
INSERT INTO "UserResponsibility" ("userId", "responsibilityId")
SELECT u."id", r."id"
FROM "User" u
JOIN "Rank" k ON k."id" = u."rankId"
JOIN "Responsibility" r ON r."rankBranch" = k."branch"
ON CONFLICT DO NOTHING;
