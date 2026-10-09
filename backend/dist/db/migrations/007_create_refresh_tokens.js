/**
 * Sesiones de refresh token (Fase 2).
 * `tokenHash`: nunca se guarda el token en claro. `familyId` identifica la
 * familia de rotación para detectar reuso de un token ya rotado.
 */
const refreshTokensValidator = {
    $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'tokenHash', 'familyId', 'expiresAt'],
        properties: {
            userId: { bsonType: 'objectId' },
            tokenHash: { bsonType: 'string' },
            familyId: { bsonType: 'objectId' },
            expiresAt: { bsonType: 'date' },
            revokedAt: { bsonType: 'date' },
            createdAt: { bsonType: 'date' },
            userAgent: { bsonType: 'string' },
            ipAddress: { bsonType: 'string' }
        }
    }
};
export const migration007CreateRefreshTokens = {
    version: 7,
    name: '007_create_refresh_tokens',
    up: async (db) => {
        await db.ensureCollection('refresh_tokens', refreshTokensValidator);
        await db.ensureIndex('refresh_tokens', { tokenHash: 1 }, { unique: true, name: 'refresh_tokens_hash_unique' });
        await db.ensureIndex('refresh_tokens', { userId: 1 }, { name: 'refresh_tokens_user' });
        await db.ensureIndex('refresh_tokens', { familyId: 1 }, { name: 'refresh_tokens_family' });
    }
};
