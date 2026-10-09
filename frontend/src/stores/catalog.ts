import { ref } from 'vue';
import { defineStore } from 'pinia';

import { authorsApi } from '@/api/authorsApi';
import { genresApi } from '@/api/genresApi';
import type { AuthorDTO, CatalogLoadStatus, GenreDTO } from '@/types';

const NOT_LOADED_YET = {
  genres: 'idle' as const,
  authors: 'idle' as const
};

/**
 * Opciones del catálogo (géneros y autores) usadas por los filtros de la
 * vista BooksView y por BookDetailView. Se cargan una sola vez y quedan en
 * memoria durante la sesión.
 */
export const useCatalogStore = defineStore('catalog', () => {
  const genres = ref<GenreDTO[]>([]);
  const authors = ref<AuthorDTO[]>([]);
  const genresStatus = ref<CatalogLoadStatus>(NOT_LOADED_YET.genres);
  const authorsStatus = ref<CatalogLoadStatus>(NOT_LOADED_YET.authors);

  async function fetchGenres(force = false): Promise<void> {
    if (!force && genresStatus.value === 'success') return;
    genresStatus.value = 'loading';
    try {
      genres.value = await genresApi.list();
      genresStatus.value = 'success';
    } catch {
      genresStatus.value = 'error';
    }
  }

  async function fetchAuthors(force = false): Promise<void> {
    if (!force && authorsStatus.value === 'success') return;
    authorsStatus.value = 'loading';
    try {
      authors.value = await authorsApi.list();
      authorsStatus.value = 'success';
    } catch {
      authorsStatus.value = 'error';
    }
  }

  async function fetchAll(force = false): Promise<void> {
    await Promise.all([fetchGenres(force), fetchAuthors(force)]);
  }

  return {
    genres,
    authors,
    genresStatus,
    authorsStatus,
    fetchGenres,
    fetchAuthors,
    fetchAll
  };
});