import { ObjectId } from 'mongodb';
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
export class MongoBookRelationsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async deleteForBook(bookId) {
        const objectId = toObjectId(bookId);
        if (objectId === null)
            return;
        // Sin transacción (no hay replica set garantizado) se borran primero las
        // relaciones y luego el libro; el servicio maneja cualquier fallo.
        await this.db.deleteMany('ratings', { bookId: objectId });
        await this.db.deleteMany('favorites', { bookId: objectId });
    }
}
