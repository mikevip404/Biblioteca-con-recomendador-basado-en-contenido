import { z } from 'zod';

/**
 * Validación de variables de entorno con Zod.
 * Centralizada aquí para fallar rápido al arrancar, antes de tocar la BD.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3000),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI es obligatoria')
    .regex(
      /^mongodb(\+srv)?:\/\//,
      'MONGODB_URI debe ser una URL de MongoDB (mongodb:// o mongodb+srv://)'
    ),
  MONGODB_DB_NAME: z
    .string()
    .min(1, 'MONGODB_DB_NAME es obligatorio')
    .default('biblioteca'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // z.coerce.boolean() no sirve: Boolean("false") === true.
  // Se preprocesan explícitamente los strings "true"/"false".
  AUTO_MIGRATE: z.preprocess(
    (value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    },
    z.boolean().default(true)
  )
});

export type Env = z.infer<typeof envSchema>;

/** Parsea y valida un conjunto de variables. Lanza si algo es inválido. */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const detalles = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${detalles}`);
  }
  return result.data;
}

/** Carga las variables del proceso (dotenv se importa en el punto de entrada). */
export function loadEnv(): Env {
  return parseEnv(process.env);
}
