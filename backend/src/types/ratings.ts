/** Entidades y DTOs de valoraciones y favoritos (Fase 4). */

/** Valores de valoración permitidos (entero 1–5). */
export type RatingValue = 1 | 2 | 3 | 4 | 5;

export interface Rating {
  id: string;
  userId: string;
  bookId: string;
  value: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Favorite {
  id: string;
  userId: string;
  bookId: string;
  createdAt: Date;
}

/** Datos mínimos de un usuario en una valoración (nunca email ni hash). */
export interface RatingUserDTO {
  id: string;
  name: string;
}

/** Datos básicos del libro para los listados "míos". */
export interface BookSummaryDTO {
  id: string;
  title: string;
  coverUrl?: string;
  averageRating: number;
}

/** Valoración tal como viaja al cliente (sin el userId crudo). */
export interface RatingDTO {
  id: string;
  value: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

/** Valoración de un libro, con el nombre de quien la escribió. */
export interface RatingWithUserDTO extends RatingDTO {
  user: RatingUserDTO;
}

/** Mi valoración, con los datos básicos del libro. */
export interface RatingWithBookDTO extends RatingDTO {
  book: BookSummaryDTO;
}

/** Favorito, con los datos básicos del libro. */
export interface FavoriteDTO {
  id: string;
  createdAt: string;
  book: BookSummaryDTO;
}
