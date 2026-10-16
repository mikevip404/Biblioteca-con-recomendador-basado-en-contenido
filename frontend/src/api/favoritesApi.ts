import type { ApiRequestOptions, FavoriteDTO, FavoriteToggleDTO, Paginated } from '@/types';

import { http } from './http';

export const favoritesApi = {
  /** `PUT /books/:bookId/favorite`: marca favorito (idempotente). */
  async add(bookId: string, options: ApiRequestOptions = {}): Promise<FavoriteToggleDTO> {
    const { data } = await http.put<{ data: FavoriteToggleDTO }>(
      `/books/${bookId}/favorite`,
      undefined,
      options
    );
    return data.data;
  },

  /** `DELETE /books/:bookId/favorite`: quita de favoritos (idempotente). */
  async remove(bookId: string, options: ApiRequestOptions = {}): Promise<FavoriteToggleDTO> {
    const { data } = await http.delete<{ data: FavoriteToggleDTO }>(
      `/books/${bookId}/favorite`,
      options
    );
    return data.data;
  },

  /** `GET /me/favorites`: mis favoritos con datos bÃ¡sicos del libro. */
  async listMine(
    page = 1,
    limit = 20,
    options: ApiRequestOptions = {}
  ): Promise<Paginated<FavoriteDTO>> {
    const { data } = await http.get<Paginated<FavoriteDTO>>('/me/favorites', {
      params: { page, limit },
      ...options
    });
    return data;
  }
};
