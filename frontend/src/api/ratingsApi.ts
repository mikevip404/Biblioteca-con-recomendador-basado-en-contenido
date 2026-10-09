import type {
  Paginated,
  RatingBodyRequest,
  RatingWithBookDTO,
  RatingWithUserDTO
} from '@/types';

import { http } from './http';

export const ratingsApi = {
  async putMine(bookId: string, body: RatingBodyRequest): Promise<RatingWithUserDTO> {
    const { data } = await http.put<{ data: RatingWithUserDTO }>(
      `/books/${bookId}/rating`,
      body
    );
    return data.data;
  },

  async deleteMine(bookId: string): Promise<void> {
    await http.delete(`/books/${bookId}/rating`);
  },

  async listByBook(bookId: string, page = 1, limit = 20): Promise<Paginated<RatingWithUserDTO>> {
    const { data } = await http.get<Paginated<RatingWithUserDTO>>(`/books/${bookId}/ratings`, {
      params: { page, limit }
    });
    return data;
  },

  async listMine(page = 1, limit = 20): Promise<Paginated<RatingWithBookDTO>> {
    const { data } = await http.get<Paginated<RatingWithBookDTO>>('/me/ratings', {
      params: { page, limit }
    });
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/ratings/${id}`);
  }
};