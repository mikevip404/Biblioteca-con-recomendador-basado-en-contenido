import 'dotenv/config';
import { loadEnv } from '../src/config/env.js';
import { connectMongo } from '../src/db/mongo.js';
import { runMigrations } from '../src/db/migrate.js';

const env = loadEnv();
const db = await connectMongo(env.MONGODB_URI, env.MONGODB_DB_NAME);

try {
  const applied = await runMigrations(db);
  console.log(`Migraciones aplicadas: ${applied}`);
} finally {
  await db.close();
}
