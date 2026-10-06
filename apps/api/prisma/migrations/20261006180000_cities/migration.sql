-- Recherche de villes auto-hébergée (GEOCODER=db) : référentiel GeoNames + index trigrammes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "City" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT,
    "region" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,
    "search" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "City_search_idx" ON "City" USING GIN ("search" gin_trgm_ops);
