import { migration001CreateUsers } from './001_create_users.js';
import { migration002CreateGenres } from './002_create_genres.js';
import { migration003CreateBooks } from './003_create_books.js';
import { migration004CreateBookGenres } from './004_create_book_genres.js';
import { migration005CreateRatings } from './005_create_ratings.js';
import { migration006CreateFavorites } from './006_create_favorites.js';
import { migration007CreateRefreshTokens } from './007_create_refresh_tokens.js';
import { migration008AuthFields } from './008_auth_fields.js';
import { migration009CatalogSchema } from './009_catalog_schema.js';
import { migration010CatalogIndexes } from './010_catalog_indexes.js';
/**
 * Registro de migraciones en orden de versión.
 * Al agregar una migración nueva, impórtala y añádela al final del arreglo.
 */
export const migrations = [
    migration001CreateUsers,
    migration002CreateGenres,
    migration003CreateBooks,
    migration004CreateBookGenres,
    migration005CreateRatings,
    migration006CreateFavorites,
    migration007CreateRefreshTokens,
    migration008AuthFields,
    migration009CatalogSchema,
    migration010CatalogIndexes
];
