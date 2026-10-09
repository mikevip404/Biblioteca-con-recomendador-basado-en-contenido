import { ObjectId } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';

/** Sesión de refresh token. `tokenHash` es SHA-256, nunca el token original. */
export interface RefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface CreateSessionData {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Puerto del repositorio de sesiones. Los ids viajan como string; la
 * conversión a ObjectId vive solo en la implementación Mongo.
 */
export interface RefreshTokenRepository {
  create(data: CreateSessionData): Promise<RefreshSession>;
  findByTokenHash(tokenHash: string): Promise<RefreshSession | null>;
  revokeById(id: string, revokedAt: Date): Promise<void>;
  revokeFamily(familyId: string, revokedAt: Date): Promise<void>;
  revokeAllByUser(userId: string, revokedAt: Date): Promise<void>;
  /** Sesiones vigentes (no revocadas ni expiradas), de más antigua a más nueva. */
  findActiveByUser(userId: string, now: Date): Promise<RefreshSession[]>;
}

function toSession(doc: import('mongodb').Document): RefreshSession | null {
  const id = doc['_id'];
  const userId = doc['userId'];
  if (id === null || id === undefined || userId === null || userId === undefined) {
    return null;
  }
  const session: RefreshSession = {
    id: String(id),
    userId: String(userId),
    tokenHash: doc['tokenHash'] as string,
    familyId: doc['familyId'] as string,
    expiresAt: doc['expiresAt'] as Date,
    revokedAt: (doc['revokedAt'] as Date | null | undefined) ?? null,
    createdAt: doc['createdAt'] as Date
  };
  const userAgent = doc['userAgent'] as string | undefined;
  const ipAddress = doc['ipAddress'] as string | undefined;
  if (userAgent !== undefined) session.userAgent = userAgent;
  if (ipAddress !== undefined) session.ipAddress = ipAddress;
  return session;
}

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export class MongoRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: MongoDatabase) {}

  async create(data: CreateSessionData): Promise<RefreshSession> {
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

  async findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    const docs = await this.db.find('refresh_tokens', { tokenHash });
    const first = docs[0];
    if (first === undefined) return null;
    return toSession(first);
  }

  async revokeById(id: string, revokedAt: Date): Promise<void> {
    const objectId = toObjectId(id);
    if (objectId === null) return;
    await this.db.updateOne(
      'refresh_tokens',
      { _id: objectId },
      { $set: { revokedAt } }
    );
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.db.updateMany(
      'refresh_tokens',
      { familyId },
      { $set: { revokedAt } }
    );
  }

  async revokeAllByUser(userId: string, revokedAt: Date): Promise<void> {
    const objectId = toObjectId(userId);
    if (objectId === null) return;
    await this.db.updateMany(
      'refresh_tokens',
      { userId: objectId },
      { $set: { revokedAt } }
    );
  }

  async findActiveByUser(userId: string, now: Date): Promise<RefreshSession[]> {
    const objectId = toObjectId(userId);
    if (objectId === null) return [];
    const docs = await this.db.find(
      'refresh_tokens',
      { userId: objectId, revokedAt: null, expiresAt: { $gt: now } },
      { sort: { createdAt: 1 } }
    );
    const sessions: RefreshSession[] = [];
    for (const doc of docs) {
      const session = toSession(doc);
      if (session !== null) sessions.push(session);
    }
    return sessions;
  }
}
