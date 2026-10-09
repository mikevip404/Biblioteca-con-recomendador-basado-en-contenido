import { ObjectId } from 'mongodb';
import { isUserRole } from '../types/auth.js';
function toUser(doc) {
    const role = doc['role'];
    if (!isUserRole(role))
        return null;
    const id = doc['_id'];
    if (id === null || id === undefined)
        return null;
    return {
        id: String(id),
        email: doc['email'],
        passwordHash: doc['passwordHash'],
        fullName: doc['fullName'],
        role,
        isActive: doc['isActive'] ?? true,
        failedLoginAttempts: doc['failedLoginAttempts'] ?? 0,
        lockedUntil: doc['lockedUntil'] ?? null,
        createdAt: doc['createdAt'],
        updatedAt: doc['updatedAt']
    };
}
function toObjectId(id) {
    if (!ObjectId.isValid(id))
        return null;
    try {
        return new ObjectId(id);
    }
    catch {
        return null;
    }
}
export class MongoUserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findByEmail(email) {
        const docs = await this.db.find('users', { email });
        const first = docs[0];
        if (first === undefined)
            return null;
        return toUser(first);
    }
    async findById(id) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return null;
        const docs = await this.db.find('users', { _id: objectId });
        const first = docs[0];
        if (first === undefined)
            return null;
        return toUser(first);
    }
    async create(data) {
        const now = new Date();
        const created = await this.db.find('users', { email: data.email });
        if (created.length > 0) {
            // Defensa en profundidad: el servicio ya verificó el duplicado, pero
            // la unicidad real la garantiza el índice único de la BD.
            throw new Error('El correo ya está registrado');
        }
        await this.db.insertOne('users', {
            email: data.email,
            passwordHash: data.passwordHash,
            fullName: data.fullName,
            role: data.role,
            isActive: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
            createdAt: now,
            updatedAt: now
        });
        const user = await this.findByEmail(data.email);
        if (user === null) {
            throw new Error('No se pudo leer el usuario recién creado');
        }
        return user;
    }
    async updateById(id, patch) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return;
        const set = { updatedAt: new Date() };
        if (patch.role !== undefined)
            set['role'] = patch.role;
        if (patch.passwordHash !== undefined)
            set['passwordHash'] = patch.passwordHash;
        await this.db.updateOne('users', { _id: objectId }, { $set: set });
    }
    async updateLoginState(id, state) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return;
        await this.db.updateOne('users', { _id: objectId }, {
            $set: {
                failedLoginAttempts: state.failedLoginAttempts,
                lockedUntil: state.lockedUntil,
                updatedAt: new Date()
            }
        });
    }
}
