/**
 * (Ré)importe le référentiel de villes GeoNames (GEOCODER=db).
 *   dev  : npm run db:cities
 *   prod : docker compose exec api node dist/scripts/import-cities.js
 * Le premier import se fait aussi tout seul au démarrage de l'API si la table est vide.
 */
import { prisma } from '../db.js';
import { importCities } from '../geocoding/geonames.js';

try {
  await importCities();
} finally {
  await prisma.$disconnect();
}
