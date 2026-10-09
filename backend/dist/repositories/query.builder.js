import { ObjectId } from 'mongodb';
/** Tope duro de elementos por página (evita respuestas gigantes). */
export const MAX_PAGE_SIZE = 50;
function toObjectId(value) {
    if (!ObjectId.isValid(value))
        return null;
    try {
        return new ObjectId(value);
    }
    catch {
        return null;
    }
}
/** Normaliza página y límite (1..MAX_PAGE_SIZE) y calcula el `skip`. */
export function buildPagination(page, limit) {
    const safePage = Number.isFinite(page) ? Math.max(Math.trunc(page), 1) : 1;
    const safeLimit = Number.isFinite(limit)
        ? Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE)
        : MAX_PAGE_SIZE;
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}
/** Orden estable por el campo pedido y `_id` como desempate. */
export function buildSort(field, order) {
    return { [field]: order === 'asc' ? 1 : -1, _id: 1 };
}
/**
 * Traduce los filtros normalizados del listado a un filtro de Mongo.
 * Los ids inválidos se ignoran (Zod ya los validó en el borde HTTP).
 */
export function buildBookFilter(filter) {
    const query = {};
    if (filter.q !== undefined && filter.q !== '') {
        query['$text'] = { $search: filter.q };
    }
    if (filter.genreId !== undefined) {
        const genreId = toObjectId(filter.genreId);
        if (genreId !== null)
            query['genres'] = genreId;
    }
    if (filter.authorId !== undefined) {
        const authorId = toObjectId(filter.authorId);
        if (authorId !== null)
            query['author'] = authorId;
    }
    if (filter.yearFrom !== undefined || filter.yearTo !== undefined) {
        const range = {};
        if (filter.yearFrom !== undefined)
            range['$gte'] = filter.yearFrom;
        if (filter.yearTo !== undefined)
            range['$lte'] = filter.yearTo;
        query['publishedYear'] = range;
    }
    if (filter.language !== undefined && filter.language !== '') {
        query['language'] = filter.language;
    }
    return query;
}
/** Envuelve los resultados con los metadatos de paginación. */
export function paginate(data, total, pagination) {
    return {
        data,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / pagination.limit)
    };
}
