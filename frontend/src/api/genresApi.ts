import type { GenreDTO } from '@/types';

import { http } from './http';

export interface CreateGenreInput {
  name: string;
  description?: string;
}

export type UpdateGenreInput = Partial<CreateGenreInput>;

export const genresApi = {
  async list(): Promise<GenreDTO[]> {
    const { data } = await http.get<{ data: GenreDTO[] }>('/genres');
    return data.data;
  },

  async getById(id: string): Promise<GenreDTO> {
    const { data } = await http.get<{ data: GenreDTO }>(`/genres/${id}`);
    return data.data;
  },

  async create(input: CreateGenreInput): Promise<GenreDTO> {
    const { data } = await http.post<{ data: GenreDTO }>('/genres', input);
    return data.data;
  },

  async update(id: string, input: UpdateGenreInput): Promise<GenreDTO> {
    const { data } = await http.patch<{ data: GenreDTO }>(`/genres/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/genres/${id}`);
  }
};