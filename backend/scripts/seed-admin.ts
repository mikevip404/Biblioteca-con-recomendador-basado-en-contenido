import 'dotenv/config';
import { z } from 'zod';
import { loadEnv } from '../src/config/env.js';
import { connectMongo } from '../src/db/mongo.js';
import { runMigrations } from '../src/db/migrate.js';
import { MongoUserRepository } from '../src/repositories/user.repository.js';
import { Argon2PasswordService } from '../src/services/password.service.js';
import { passwordSchema } from '../src/schemas/auth.schemas.js';

/**
 * Siembra (o promueve) el usuario administrador.
 * Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run db:seed-admin
 */
const adminEnvSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  ADMIN_PASSWORD: passwordSchema,
  ADMIN_NAME: z.string().trim().min(1).max(255)
});

const env = loadEnv();
const parsed = adminEnvSchema.safeParse({
  ADMIN_EMAIL: env.ADMIN_EMAIL,
  ADMIN_PASSWORD: env.ADMIN_PASSWORD,
  ADMIN_NAME: env.ADMIN_NAME
});
if (!parsed.success) {
  const detalles = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Faltan variables para el admin:\n${detalles}`);
  process.exit(1);
}
const admin = parsed.data;

const db = await connectMongo(env.MONGODB_URI, env.MONGODB_DB_NAME);
try {
  await runMigrations(db);
  const users = new MongoUserRepository(db);
  const passwords = new Argon2PasswordService();

  const existing = await users.findByEmail(admin.ADMIN_EMAIL);
  if (existing === null) {
    const created = await users.create({
      email: admin.ADMIN_EMAIL,
      passwordHash: await passwords.hash(admin.ADMIN_PASSWORD),
      fullName: admin.ADMIN_NAME,
      role: 'admin'
    });
    console.log(`Admin creado: ${created.email}`);
  } else {
    await users.updateById(existing.id, {
      role: 'admin',
      passwordHash: await passwords.hash(admin.ADMIN_PASSWORD)
    });
    console.log(`Admin actualizado: ${existing.email}`);
  }
} finally {
  await db.close();
}
