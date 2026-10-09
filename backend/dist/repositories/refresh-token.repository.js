import { ObjectId } from 'mongodb';
function toSession(doc) {
    const id = doc['_id'];
    const userId = doc['userId'];
    if (id === null || id === undefined || userId === null || userId === undefined) {
        return null;
    }
    const session = {
        id: String(id),
        userId: String(userId),
        tokenHash: doc['tokenHash'],
        familyId: doc['familyId'],
        expiresAt: doc['expiresAt'],
        revokedAt: doc['revokedAt'] ?? null,
        createdAt: doc['createdAt']
    };
    const userAgent = doc['userAgent'];
    const ipAddress = doc['ipAddress'];
    if (userAgent !== undefined)
        session.userAgent = userAgent;
    if (ipAddress !== undefined)
        session.ipAddress = ipAddress;
    return session;
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
export class MongoRefreshTokenRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(data) {
        const userId = toObjectId(data.userId);
        if (userId === null) {
            throw new Error('userId inválido para crear la sesión');
        }
        const now = new Date();
        await this.db.insertOne('refresh_tokens', {
            userId,
            tokenHash: data.tokenHash,
            familyId: data.familyId,
            expiresAt: data.expiresAt,
            revokedAt: null,
            createdAt: now,
            ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
            ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress } : {})
        });
        const session = await this.findByTokenHash(data.tokenHash);
        if (session === null) {
            throw new Error('No se pudo leer la sesión recién creada');
        }
        return session;
    }
    async findByTokenHash(tokenHash) {
        const docs = await this.db.find('refresh_tokens', { tokenHash });
        const first = docs[0];
        if (first === undefined)
            return null;
        return toSession(first);
    }
    async revokeById(id, revokedAt) {
        const objectId = toObjectId(id);
        if (objectId === null)
            return;
        await this.db.updateOne('refresh_tokens', { _id: objectId }, { $set: { revokedAt } });
    }
    async revokeFamily(familyId, revokedAt) {
        await this.db.updateMany('refresh_tokens', { familyId }, { $set: { revokedAt } });
    }
    async revokeAllByUser(userId, revokedAt) {
        const objectId = toObjectId(userId);
        if (objectId === null)
            return;
        await this.db.updateMany('refresh_tokens', { userId: objectId }, { $set: { revokedAt } });
    }
    async findActiveByUser(userId, now) {
        const objectId = toObjectId(userId);
        if (objectId === null)
            return [];
        const docs = await this.db.find('refresh_tokens', { userId: objectId, revokedAt: null, expiresAt: { $gt: now } }, { sort: { createdAt: 1 } });
        const sessions = [];
        for (const doc of docs) {
            const session = toSession(doc);
            if (session !== null)
                sessions.push(session);
        }
        return sessions;
    }
}
