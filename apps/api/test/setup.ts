// Variables d'environnement de test : définies avant tout import de l'application.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://501e:change-me-db-password@localhost:5432/501e_test';
process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
process.env.HASH_SALT = 'test-hash-salt-0123456789abcdef';
process.env.INTERNAL_API_TOKEN = 'test-internal-token-0123456789abcdef';
process.env.DISCORD_MODE = 'mock';
process.env.DISCORD_MEMBER_ROLE_IDS = 'role-member';
process.env.DISCORD_ADMIN_ROLE_IDS = 'role-admin';
process.env.DISCORD_ANNOUNCE_CHANNEL_ID = 'chan-annonces';
process.env.DISCORD_INVITE_URL = 'https://discord.gg/test';
process.env.STORAGE_DIR = './storage-test';
process.env.GEOCODER = 'demo';
process.env.ROLE_SYNC_INTERVAL_MINUTES = '0';
