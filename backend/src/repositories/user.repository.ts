import { ObjectId } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';
import { isUserRole, type UserRole } from '../types/auth.js';

/** Usuario de dominio. El hash nunca sale hacia los controladores. */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
}

export interface UpdateUserData {
  role?: UserRole;
  passwordHash?: string;
}

export interface LoginStateData {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Puerto del repositorio de usuarios. Trabaja con ids como string; la
 * conversión a ObjectId vive solo en la implementación Mongo.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  updateById(id: string, patch: UpdateUserData): Promise<void>;
  updateLoginState(id: string, state: LoginStateData): Promise<void>;
}

function toUser(doc: import('mongodb').Document): User | null {
  const role = doc['role'];
  if (!isUserRole(role)) return null;
  const id = doc['_id'];
  if (id === null || id === undefined) return null;
  return {
    id: String(id),
    email: doc['email'] as string,
    passwordHash: doc['passwordHash'] as string,
    fullName: doc['fullName'] as string,
    role,
    isActive: (doc['isActive'] as boolean | undefined) ?? true,
    failedLoginAttempts: (doc['failedLoginAttempts'] as number | undefined) ?? 0,
    lockedUntil: (doc['lockedUntil'] as Date | null | undefined) ?? null,
    createdAt: doc['createdAt'] as Date,
    updatedAt: doc['updatedAt'] as Date
  };
}

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export class MongoUserRepository implements UserRepository {
  constructor(private readonly db: MongoDatabase) {}

  async findByEmail(email: string): Promise<User | null> {
    const docs = await this.db.find('users', { email });
    const first = docs[0];
    if (first === undefined) return null;
    return toUser(first);
  }

  async findById(id: string): Promise<User | null> {
    const objectId = toObjectId(id);
    if (objectId === null) return null;
    const docs = await this.db.find('users', { _id: objectId });
    const first = docs[0];
    if (first === undefined) return null;
    return toUser(first);
  }

  async create(data: CreateUserData): Promise<User> {
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

  async updateById(id: string, patch: UpdateUserData): Promise<void> {
    const objectId = toObjectId(id);
    if (objectId === null) return;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.role !== undefined) set['role'] = patch.role;
    if (patch.passwordHash !== undefined) set['passwordHash'] = patch.passwordHash;
    await this.db.updateOne(
      'users',
      { _id: objectId },
      { $set: set }
    );
  }

  async updateLoginState(id: string, state: LoginStateData): Promise<void> {
    const objectId = toObjectId(id);
    if (objectId === null) return;
    await this.db.updateOne(
      'users',
      { _id: objectId },
      {
        $set: {
          failedLoginAttempts: state.failedLoginAttempts,
          lockedUntil: state.lockedUntil,
          updatedAt: new Date()
        }
      }
    );
  }
}
