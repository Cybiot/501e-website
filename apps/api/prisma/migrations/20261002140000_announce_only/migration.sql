-- Le bot ne fait plus que lire les membres/rôles et poster les annonces :
-- les médailles ne sont plus liées à un rôle Discord.
ALTER TABLE "Medal" DROP COLUMN "discordRoleId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastKnownRankId" TEXT;
UPDATE "User" SET "lastKnownRankId" = "rankId";

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "promotionsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RankPromotion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromRankId" TEXT,
    "toRankId" TEXT NOT NULL,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "announcedAt" TIMESTAMP(3),
    "announcementId" TEXT,

    CONSTRAINT "RankPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankPromotion_userId_idx" ON "RankPromotion"("userId");

-- CreateIndex
CREATE INDEX "RankPromotion_announcedAt_idx" ON "RankPromotion"("announcedAt");

-- AddForeignKey
ALTER TABLE "RankPromotion" ADD CONSTRAINT "RankPromotion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankPromotion" ADD CONSTRAINT "RankPromotion_fromRankId_fkey" FOREIGN KEY ("fromRankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankPromotion" ADD CONSTRAINT "RankPromotion_toRankId_fkey" FOREIGN KEY ("toRankId") REFERENCES "Rank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankPromotion" ADD CONSTRAINT "RankPromotion_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
