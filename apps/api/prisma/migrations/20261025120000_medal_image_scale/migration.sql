-- Échelle d'affichage de l'image d'une médaille (en %), réglée par l'admin.
ALTER TABLE "Medal" ADD COLUMN "imageScale" INTEGER NOT NULL DEFAULT 100;
