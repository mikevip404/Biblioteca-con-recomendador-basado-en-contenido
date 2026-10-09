/**
 * Convierte un texto en un slug URL-safe: sin acentos, minúsculas y
 * separado por guiones. Ej: "Ciencia ficción" → "ciencia-ficcion".
 */
export function slugify(input) {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
