-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('none', 'member', 'admin');

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "discordAvatarUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'none',
    "discordRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rankId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "rolesSyncedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "inactivityNotifiedAt" TIMESTAMP(3),
    "consentAcceptedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT true,
    "consentCustomImage" BOOLEAN NOT NULL DEFAULT false,
    "consentLocation" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "discordRoleId" TEXT,
    "iconUrl" TEXT,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Responsibility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discordRoleId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserResponsibility" (
    "userId" TEXT NOT NULL,
    "responsibilityId" TEXT NOT NULL,

    CONSTRAINT "UserResponsibility_pkey" PRIMARY KEY ("userId","responsibilityId")
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "tagline" VARCHAR(140),
    "customImageId" TEXT,
    "pendingImageId" TEXT,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CustomImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "ImageStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "CustomImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "discordRoleId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "repeatable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedalAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medalId" TEXT NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "awardedById" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "announcedAt" TIMESTAMP(3),
    "announcementId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "MedalAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discordMessageIds" TEXT[],
    "channelId" TEXT NOT NULL,
    "awardsCount" INTEGER NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cityLabel" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "readById" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorHash" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publicProfile" BOOLEAN NOT NULL,
    "customImage" BOOLEAN NOT NULL,
    "location" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_rankId_idx" ON "User"("rankId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_name_key" ON "Rank"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_order_key" ON "Rank"("order");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_discordRoleId_key" ON "Rank"("discordRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "Responsibility_name_key" ON "Responsibility"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Responsibility_discordRoleId_key" ON "Responsibility"("discordRoleId");

-- CreateIndex
CREATE INDEX "UserResponsibility_responsibilityId_idx" ON "UserResponsibility"("responsibilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_customImageId_key" ON "Profile"("customImageId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_pendingImageId_key" ON "Profile"("pendingImageId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomImage_storageKey_key" ON "CustomImage"("storageKey");

-- CreateIndex
CREATE INDEX "CustomImage_status_submittedAt_idx" ON "CustomImage"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "CustomImage_userId_idx" ON "CustomImage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Medal_name_key" ON "Medal"("name");

-- CreateIndex
CREATE INDEX "Medal_isActive_order_idx" ON "Medal"("isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MedalAward_idempotencyKey_key" ON "MedalAward"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MedalAward_userId_idx" ON "MedalAward"("userId");

-- CreateIndex
CREATE INDEX "MedalAward_medalId_idx" ON "MedalAward"("medalId");

-- CreateIndex
CREATE INDEX "MedalAward_announcedAt_revokedAt_idx" ON "MedalAward"("announcedAt", "revokedAt");

-- CreateIndex
CREATE INDEX "MemberLocation_userId_idx" ON "MemberLocation"("userId");

-- CreateIndex
CREATE INDEX "Notification_readAt_createdAt_idx" ON "Notification"("readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_createdAt_idx" ON "ConsentRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResponsibility" ADD CONSTRAINT "UserResponsibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResponsibility" ADD CONSTRAINT "UserResponsibility_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_customImageId_fkey" FOREIGN KEY ("customImageId") REFERENCES "CustomImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_pendingImageId_fkey" FOREIGN KEY ("pendingImageId") REFERENCES "CustomImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomImage" ADD CONSTRAINT "CustomImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomImage" ADD CONSTRAINT "CustomImage_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedalAward" ADD CONSTRAINT "MedalAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedalAward" ADD CONSTRAINT "MedalAward_medalId_fkey" FOREIGN KEY ("medalId") REFERENCES "Medal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedalAward" ADD CONSTRAINT "MedalAward_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedalAward" ADD CONSTRAINT "MedalAward_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedalAward" ADD CONSTRAINT "MedalAward_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLocation" ADD CONSTRAINT "MemberLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_readById_fkey" FOREIGN KEY ("readById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garde-fou en base : 2 villes maximum par membre (en plus du contrôle applicatif).
CREATE OR REPLACE FUNCTION member_location_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM "MemberLocation" WHERE "userId" = NEW."userId") >= 2 THEN
    RAISE EXCEPTION 'LOCATION_LIMIT: 2 villes maximum par membre' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER member_location_limit_trg
  BEFORE INSERT ON "MemberLocation"
  FOR EACH ROW EXECUTE FUNCTION member_location_limit();
