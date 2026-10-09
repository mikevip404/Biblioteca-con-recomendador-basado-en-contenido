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
        .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI debe ser una URL de MongoDB (mongodb:// o mongodb+srv://)'),
    MONGODB_DB_NAME: z
        .string()
        .min(1, 'MONGODB_DB_NAME es obligatorio')
        .default('biblioteca'),
    // Sin estos secretos la app no arranca (fail fast).
    JWT_SECRET: z
        .string()
        .min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    CORS_ORIGINS: z.preprocess((value) => {
        if (typeof value !== 'string')
            return value;
        return value
            .split(',')
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0);
    }, z.array(z.string().min(1)).default(['http://localhost:5173'])),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    AUTH_RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(15),
    MAX_SESSIONS_PER_USER: z.coerce.number().int().positive().default(5),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
    // Solo las usa el script db:seed-admin; la app arranca sin ellas.
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    ADMIN_NAME: z.string().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    // z.coerce.boolean() no sirve: Boolean("false") === true.
    // Se preprocesan explícitamente los strings "true"/"false".
    AUTO_MIGRATE: z.preprocess((value) => {
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        return value;
    }, z.boolean().default(true))
});
/** Parsea y valida un conjunto de variables. Lanza si algo es inválido. */
export function parseEnv(input) {
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
export function loadEnv() {
    return parseEnv(process.env);
}
