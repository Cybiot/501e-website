import { execSync } from 'node:child_process';

/** Applique les migrations sur la base de test avant la suite. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://501e:change-me-db-password@localhost:5432/501e_test';
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
}
