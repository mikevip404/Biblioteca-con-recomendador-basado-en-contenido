/** Valores de valoración permitidos (entero 1–5). */
export type RatingValue = 1 | 2 | 3 | 4 | 5;

/** Valoración tal como viaja al cliente. */
export interface RatingDTO {
  id: string;
  value: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

/** Datos mínimos de un usuario en una valoración. */
export interface RatingUserDTO {
  id: string;
  name: string;
}

/** Valoración de un libro, con el nombre de quien la escribió. */
export interface RatingWithUserDTO extends RatingDTO {
  user: RatingUserDTO;
}

/** Datos básicos del libro en los listados "míos". */
export interface BookSummaryDTO {
  id: string;
  title: string;
  coverUrl?: string;
  averageRating: number;
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

/** Cuerpo de `PUT /books/:bookId/rating`. */
export interface RatingBodyRequest {
  value: RatingValue;
  comment?: string;
}