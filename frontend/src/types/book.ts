import type { Paginated } from './api';

/** Autor embebido en un `BookDTO`. */
export interface BookAuthorDTO {
  id: string;
  name: string;
}

/** Género embebido en un `BookDTO`. */
export interface BookGenreDTO {
  id: string;
  name: string;
  slug: string;
}

/** Libro tal como lo devuelve la API (DTO del catálogo). */
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
  createdBy: string;
  averageRating: number;
  ratingCount: number;
  myRating?: number | null;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Género (DTOS de `GET /genres`). */
export interface GenreDTO {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** Autor (DTO de `GET /authors`). */
export interface AuthorDTO {
  id: string;
  name: string;
  bio?: string;
  birthYear?: number;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

/** Campos de ordenación admitidos por `GET /books`. */
export type BookSortField = 'title' | 'publishedYear' | 'createdAt' | 'averageRating';

export type SortOrder = 'asc' | 'desc';

/** Parámetros de listado de libros (query params de `GET /books`). */
export interface BookListQuery {
  page?: number;
  limit?: number;
  sort?: BookSortField;
  order?: SortOrder;
  q?: string;
  genre?: string;
  author?: string;
  yearFrom?: number;
  yearTo?: number;
  language?: string;
  minRating?: number;
}

/** Respuesta paginada de `GET /books`. */
export type BookPage = Paginated<BookDTO>;

/** Estados de carga del catálogo. */
export type CatalogLoadStatus = 'idle' | 'loading' | 'success' | 'error';