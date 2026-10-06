import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { ensureCities } from './geocoding/index.js';
import { startJobs } from './jobs/index.js';
import { logger } from './lib/logger.js';
import { refreshRankPrefixes } from './lib/rank-prefix.js';

const app = createApp();
const server = app.listen(config.API_PORT, () => {
  logger.info(
    { port: config.API_PORT, discord: config.DISCORD_MODE, geocoder: config.GEOCODER },
    `API 501e démarrée sur http://localhost:${config.API_PORT}`,
  );
});
void refreshRankPrefixes();
void ensureCities();
const stopJobs = startJobs();

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Arrêt en cours');
  stopJobs();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
