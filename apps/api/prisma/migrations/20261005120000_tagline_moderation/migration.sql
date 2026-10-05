-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "pendingTagline" VARCHAR(140),
ADD COLUMN     "pendingTaglineAt" TIMESTAMP(3),
ADD COLUMN     "taglineRejectionReason" VARCHAR(300),
ADD COLUMN     "taglineReviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Profile_pendingTaglineAt_idx" ON "Profile"("pendingTaglineAt");
