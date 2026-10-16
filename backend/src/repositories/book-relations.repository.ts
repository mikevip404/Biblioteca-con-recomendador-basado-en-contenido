import { ObjectId } from 'mongodb';
import type { MongoDatabase } from '../db/mongo.js';

/**
 * Puerto para las relaciones de un libro (valoraciones y favoritos).
 * Encapsula el borrado en cascada de datos dependientes.
 */
export interface BookRelationsRepository {
  deleteForBook(bookId: string): Promise<void>;
}

function toObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export class MongoBookRelationsRepository implements BookRelationsRepository {
  constructor(private readonly db: MongoDatabase) {}

  async deleteForBook(bookId: string): Promise<void> {
    const objectId = toObjectId(bookId);
    if (objectId === null) return;
    // Sin transacción (no hay replica set garantizado) se borran primero las
    // relaciones y luego el libro; el servicio maneja cualquier fallo.
    await this.db.deleteMany('ratings', { bookId: objectId });
    await this.db.deleteMany('favorites', { bookId: objectId });
  }
}
