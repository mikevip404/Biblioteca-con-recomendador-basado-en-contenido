import type { ApiRequestOptions, BookDTO, BookListQuery, BookPage } from '@/types';

import { http } from './http';

export interface CreateBookInput {
  title: string;
  description?: string;
  author: string;
  genres: string[];
  tags?: string[];
  publishedYear?: number;
  pages?: number;
  language?: string;
  isbn?: string;
  coverUrl?: string;
}

export type UpdateBookInput = Partial<CreateBookInput>;

export const booksApi = {
  async list(query: BookListQuery): Promise<BookPage> {
    const { data } = await http.get<BookPage>('/books', { params: query });
    return data;
  },

  async getById(id: string): Promise<BookDTO> {
    const { data } = await http.get<{ data: BookDTO }>(`/books/${id}`);
    return data.data;
  },

  async create(input: CreateBookInput): Promise<BookDTO> {
    const { data } = await http.post<{ data: BookDTO }>('/books', input);
    return data.data;
  },

  async update(id: string, input: UpdateBookInput): Promise<BookDTO> {
    const { data } = await http.patch<{ data: BookDTO }>(`/books/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/books/${id}`);
  }
};
