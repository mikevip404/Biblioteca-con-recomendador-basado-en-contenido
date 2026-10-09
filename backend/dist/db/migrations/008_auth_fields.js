/**
 * Campos de autenticación (Fase 2).
 *
 * IMPORTANTE: no se editaron las migraciones 001/007 ya aplicadas, sino que
 * se añade una nueva: `ensureCollection` hace `collMod` sobre la colección
 * existente y actualiza su validador. Así la BD real (Atlas) y las nuevas
 * convergen al mismo esquema.
 */
const usersValidatorV2 = {
    $jsonSchema: {
        bsonType: 'object',
        required: ['email', 'passwordHash', 'fullName', 'role'],
        properties: {
            email: { bsonType: 'string' },
            passwordHash: { bsonType: 'string' },
            fullName: { bsonType: 'string' },
            role: { enum: ['admin', 'lector'] },
            isActive: { bsonType: 'bool' },
            failedLoginAttempts: { bsonType: 'number', minimum: 0 },
            lockedUntil: { bsonType: ['date', 'null'] },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
        }
    }
};
const refreshTokensValidatorV2 = {
    $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'tokenHash', 'familyId', 'expiresAt'],
        properties: {
            userId: { bsonType: 'objectId' },
            tokenHash: { bsonType: 'string' },
            // UUID generado en el servicio (no ObjectId): viaja como string.
            familyId: { bsonType: 'string' },
            expiresAt: { bsonType: 'date' },
            revokedAt: { bsonType: ['date', 'null'] },
            createdAt: { bsonType: 'date' },
            userAgent: { bsonType: 'string' },
            ipAddress: { bsonType: 'string' }
        }
    }
};
export const migration008AuthFields = {
    version: 8,
    name: '008_auth_fields',
    up: async (db) => {
        await db.ensureCollection('users', usersValidatorV2);
        await db.ensureCollection('refresh_tokens', refreshTokensValidatorV2);
        // Limpieza automática: Mongo borra las sesiones al expirar.
        await db.ensureIndex('refresh_tokens', { expiresAt: 1 }, { name: 'refresh_tokens_expires_ttl', expireAfterSeconds: 0 });
    }
};
