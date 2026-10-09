/** Implementación concreta sobre MongoDB (comando `ping`). */
export class MongoHealthRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async checkDatabase() {
        const start = Date.now();
        await this.db.ping();
        return { ok: true, latencyMs: Date.now() - start };
    }
}
