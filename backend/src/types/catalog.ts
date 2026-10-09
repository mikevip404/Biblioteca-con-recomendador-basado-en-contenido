/** Entidades de dominio del catálogo (Fase 3). */

export interface Author {
  id: string;
  name: string;
  bio?: string;
  birthYear?: number;
  country?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Book {
  id: string;
  title: string;
  description?: string;
  authorId: string;
  genreIds: string[];
  tags: string[];
  publishedYear?: number;
  pages?: number;
  language?: string;
  isbn?: string;
  coverUrl?: string;
  createdBy: string;
  /** Se marca en `true` al cambiar género, tags, autor, año o páginas (Fase 5). */
  vectorStale: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** DTOs: lo único que sale hacia la API (nunca `vectorStale` ni datos internos). */
export interface AuthorDTO {
  id: string;
  name: string;
  bio?: string;
  birthYear?: number;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenreDTO {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookAuthorDTO {
  id: string;
  name: string;
}

export interface BookGenreDTO {
  id: string;
  name: string;
  slug: string;
}

export interface BookDTO {
  id: string;
  title: string;
  description?: string;
  author: BookAuthorDTO;
  genres: BookGenreDTO[];
  tags: string[];
  publishedYear?: number;
  pages?: number;
  language?: string;
  isbn?: string;
  coverUrl?: string;
  /** Solo el id del creador; nunca el usuario completo. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type BookSortField = 'title' | 'publishedYear' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

/** Filtros de listado de libros ya normalizados (ids como string). */
export interface BookFilter {
  q?: string;
  genreId?: string;
  authorId?: string;
  yearFrom?: number;
  yearTo?: number;
  language?: string;
}
