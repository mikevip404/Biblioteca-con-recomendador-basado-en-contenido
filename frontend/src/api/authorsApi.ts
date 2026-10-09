import type { AuthorDTO } from '@/types';

import { http } from './http';

export interface CreateAuthorInput {
  name: string;
  bio?: string;
  birthYear?: number;
  country?: string;
}

export type UpdateAuthorInput = Partial<CreateAuthorInput>;

export const authorsApi = {
  async list(): Promise<AuthorDTO[]> {
    const { data } = await http.get<{ data: AuthorDTO[] }>('/authors');
    return data.data;
  },

  async getById(id: string): Promise<AuthorDTO> {
    const { data } = await http.get<{ data: AuthorDTO }>(`/authors/${id}`);
    return data.data;
  },

  async create(input: CreateAuthorInput): Promise<AuthorDTO> {
    const { data } = await http.post<{ data: AuthorDTO }>('/authors', input);
    return data.data;
  },

  async update(id: string, input: UpdateAuthorInput): Promise<AuthorDTO> {
    const { data } = await http.patch<{ data: AuthorDTO }>(`/authors/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/authors/${id}`);
  }
};