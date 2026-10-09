import 'dotenv/config';
import { loadEnv } from '../src/config/env.js';
import { connectMongo } from '../src/db/mongo.js';
import { runMigrations } from '../src/db/migrate.js';
import { MongoUserRepository } from '../src/repositories/user.repository.js';
import { seedCatalog } from '../src/services/catalog-seeder.js';
import { Argon2PasswordService } from '../src/services/password.service.js';

/**
 * Semilla de catálogo (8+ géneros, 30 autores, 150 libros). Idempotente.
 * Uso: `npm run seed`.
 */
const env = loadEnv();
const db = await connectMongo(env.MONGODB_URI, env.MONGODB_DB_NAME);

try {
  await runMigrations(db);

  const users = new MongoUserRepository(db);
  const passwords = new Argon2PasswordService();

  // `createdBy` de los libros: un admin existente o uno de semilla.
  const adminDocs = await db.find('users', { role: 'admin' }, { limit: 1 });
  let createdById: string;
  const existingAdmin = adminDocs[0];
  if (existingAdmin !== undefined && existingAdmin['_id'] !== undefined) {
    createdById = String(existingAdmin['_id']);
  } else {
    const email = env.ADMIN_EMAIL ?? 'admin@biblioteca.local';
    const password = env.ADMIN_PASSWORD ?? 'Admin1234';
    const fullName = env.ADMIN_NAME ?? 'Administrador';
    const found = await users.findByEmail(email);
    const admin =
      found ??
      (await users.create({
        email,
        passwordHash: await passwords.hash(password),
        fullName,
        role: 'admin'
      }));
    createdById = admin.id;
    console.log(`Admin de semilla disponible: ${email}`);
  }

  const result = await seedCatalog(db, createdById);
  console.log(
    `Semilla completa: +${result.genresCreated} géneros, +${result.authorsCreated} autores, +${result.booksCreated} libros.`
  );
  console.log(
    `Totales en BD: ${result.totals.genres} géneros, ${result.totals.authors} autores, ${result.totals.books} libros.`
  );
} finally {
  await db.close();
}
