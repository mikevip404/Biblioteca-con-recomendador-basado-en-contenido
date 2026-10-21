import type {
  Paginated,
  RatingBodyRequest,
  RatingWithBookDTO,
  RatingWithUserDTO
} from '@/types';

import { http } from './http';

export const ratingsApi = {
  /**
   * `PUT /books/:bookId/rating`: alta o actualizaciÃ³n idempotente. El backend
   * devuelve la valoraciÃ³n bÃ¡sica (sin `user` ni `book`).
   */
  async putMine(
    bookId: string,
    body: RatingBodyRequest,
    options: ApiRequestOptions = {}
  ): Promise<RatingDTO> {
    const { data } = await http.put<{ data: RatingDTO }>(
      `/books/${bookId}/rating`,
      body,
      options
    );
    return data.data;
  },


  /** `DELETE /books/:bookId/rating`: elimina MI valoraciÃ³n (204). */
  async deleteMine(bookId: string, options: ApiRequestOptions = {}): Promise<void> {
    await http.delete(`/books/${bookId}/rating`, options);
  },

  /** `GET /books/:bookId/ratings`: valoraciones pÃºblicas del libro (con autor). */
  async listByBook(
    bookId: string,
    page = 1,
    limit = 20,
    options: ApiRequestOptions = {}
  ): Promise<Paginated<RatingWithUserDTO>> {
    const { data } = await http.get<Paginated<RatingWithUserDTO>>(
      `/books/${bookId}/ratings`,
      { params: { page, limit }, ...options }
    );
    return data;
  },

  /** `GET /me/ratings`: mis valoraciones con datos bÃ¡sicos del libro. */
  async listMine(
    page = 1,
    limit = 20,
    options: ApiRequestOptions = {}
  ): Promise<Paginated<RatingWithBookDTO>> {
    const { data } = await http.get<Paginated<RatingWithBookDTO>>('/me/ratings', {
      params: { page, limit },
      ...options
    });
    return data;
  },

  /** `DELETE /ratings/:id`: borra una valoraciÃ³n propia (204). */
  async remove(id: string, options: ApiRequestOptions = {}): Promise<void> {
    await http.delete(`/ratings/${id}`, options);
  }
};
