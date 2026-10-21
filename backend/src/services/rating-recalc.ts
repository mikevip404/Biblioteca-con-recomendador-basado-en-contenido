import type { MongoDatabase } from '../db/mongo.js';

export interface RecalcResult {
  /** Libros con valoraciones (contadores re-escritos). */
  books: number;
  /** Total de valoraciones leídas. */
  ratings: number;
}

/**
 * Recalcula `ratingCount`/`ratingSum` de todos los libros a partir de la
 * colección `ratings`. Herramienta de reparación (`npm run recalc-ratings`):
 * idempotente y no toca las valoraciones.
 */
export async function recalculateRatingCounters(
  db: MongoDatabase
): Promise<RecalcResult> {
  const groups = await db.aggregate('ratings', [
    {
      $group: {
        _id: '$bookId',
        count: { $sum: 1 },
        sum: { $sum: '$value' }
      }
    }
  ]);

  // Poner a cero todos los libros y volcar los agregados por libro.
  await db.updateMany('books', {}, { $set: { ratingCount: 0, ratingSum: 0 } });

  let books = 0;
  for (const group of groups) {
    const id = group['_id'];
    if (id === null || id === undefined) continue;
    const count = Number(group['count'] ?? 0);
    const sum = Number(group['sum'] ?? 0);
    await db.updateOne(
      'books',
      { _id: id },
      { $set: { ratingCount: count, ratingSum: sum } }
    );
    books++;
  }

  const ratings = await db.countDocuments('ratings');
  return { books, ratings };
}
