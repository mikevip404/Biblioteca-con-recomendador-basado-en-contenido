/** Usuarios. El hash será Argon2id en la Fase 2; el validador exige su presencia. */
const usersValidator = {
    $jsonSchema: {
        bsonType: 'object',
        required: ['email', 'passwordHash', 'fullName', 'role'],
        properties: {
            email: { bsonType: 'string', description: 'correo único del usuario' },
            passwordHash: { bsonType: 'string' },
            fullName: { bsonType: 'string' },
            role: { enum: ['admin', 'lector'] },
            isActive: { bsonType: 'bool' },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
        }
    }
};
export const migration001CreateUsers = {
    version: 1,
    name: '001_create_users',
    up: async (db) => {
        await db.ensureCollection('users', usersValidator);
        await db.ensureIndex('users', { email: 1 }, { unique: true, name: 'users_email_unique' });
    }
};
