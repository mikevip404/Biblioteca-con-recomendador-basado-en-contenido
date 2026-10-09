import type { FavoriteDTO, Paginated } from '@/types';

import { http } from './http';

export const favoritesApi = {
  async add(bookId: string): Promise<FavoriteDTO> {
    const { data } = await http.put<{ data: FavoriteDTO }>(`/books/${bookId}/favorite`);
    return data.data;
  },

  async remove(bookId: string): Promise<void> {
    await http.delete(`/books/${bookId}/favorite`);
  },

  async listMine(page = 1, limit = 20): Promise<Paginated<FavoriteDTO>> {
    const { data } = await http.get<Paginated<FavoriteDTO>>('/me/favorites', {
      params: { page, limit }
    });
    return data;
  }
};