-- Ville retirée de la carte par un admin : motif affiché au membre dans son profil.
ALTER TABLE "Profile" ADD COLUMN "locationRemovedCity" VARCHAR(200);
ALTER TABLE "Profile" ADD COLUMN "locationRemovalReason" VARCHAR(300);
ALTER TABLE "Profile" ADD COLUMN "locationRemovedAt" TIMESTAMP(3);
