import 'dotenv/config';
import { loadEnv } from '../src/config/env.js';
import { connectMongo } from '../src/db/mongo.js';
import { runMigrations } from '../src/db/migrate.js';
import { recalculateRatingCounters } from '../src/services/rating-recalc.js';

/**
 * Repara los contadores `ratingCount`/`ratingSum` de los libros a partir de la
 * colección `ratings`. Idempotente. Uso: `npm run recalc-ratings`.
 */
const env = loadEnv();
const db = await connectMongo(env.MONGODB_URI, env.MONGODB_DB_NAME);

try {
  await runMigrations(db);
  const result = await recalculateRatingCounters(db);
  console.log(
    `Contadores recalculados: ${result.books} libros con valoraciones, ${result.ratings} valoraciones totales.`
  );
} finally {
  await db.close();
}
