<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LocationQuery } from 'vue-router';

import BookCard from '@/components/BookCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import SkeletonCard from '@/components/SkeletonCard.vue';
import { useBooksStore } from '@/stores/books';
import { useCatalogStore } from '@/stores/catalog';
import { useUiStore } from '@/stores/ui';
import type { BookListQuery, BookSortField, SortOrder } from '@/types';
import { debounce } from '@/utils/debounce';
import { bookQueryToQuery, queryToBookQuery } from '@/utils/url';

const route = useRoute();
const router = useRouter();
const books = useBooksStore();
const catalog = useCatalogStore();
const ui = useUiStore();

const searchTerm = ref('');
const genreId = ref('');
const authorId = ref('');
const yearFrom = ref('');
const yearTo = ref('');
const language = ref('');
const minRating = ref('');
const sort = ref<BookSortField>('createdAt');
const order = ref<SortOrder>('desc');
const loadedFirstPage = ref(false);

/** Filtros actuales de los inputs del formulario (fuente de los filtros). */
function draftFilters(): BookListQuery {
  const draft: BookListQuery = {};
  const term = searchTerm.value.trim();
  if (term !== '') draft.q = term;
  if (genreId.value !== '') draft.genre = genreId.value;
  if (authorId.value !== '') draft.author = authorId.value;
  const from = Number.parseInt(yearFrom.value, 10);
  if (Number.isInteger(from) && from >= 0 && from <= 2100) draft.yearFrom = from;
  const to = Number.parseInt(yearTo.value, 10);
  if (Number.isInteger(to) && to >= 0 && to <= 2100) draft.yearTo = to;
  const lang = language.value.trim();
  if (lang !== '') draft.language = lang;
  const min = Number.parseInt(minRating.value, 10);
  if (Number.isInteger(min) && min >= 1 && min <= 5) draft.minRating = min;
  return draft;
}

/** Aplica los filtros escribiéndolos en la URL (única fuente de verdad). */
function apply(patch: Record<string, string | number | undefined> = {}): void {
  const current = queryToBookQuery(route.query);
  const next: Record<string, string | number | undefined> = {
    ...draftFilters(),
    sort: sort.value,
    order: order.value,
    page: current.page,
    limit: ui.pageSize,
    ...patch
  };
  void router.replace({ path: '/books', query: bookQueryToQuery(next) });
}

const debouncedSearch = debounce(() => {
  apply({ page: undefined });
}, 300);

const ratingOptions = [5, 4, 3, 2, 1] as const;

function onFilterChange(): void {
  apply({ page: undefined });
}

function onSortChange(): void {
  apply({ page: undefined });
}

function onPageChange(page: number): void {
  apply({ page: page > 1 ? page : undefined });
}

function clearFilters(): void {
  searchTerm.value = '';
  genreId.value = '';
  authorId.value = '';
  yearFrom.value = '';
  yearTo.value = '';
  language.value = '';
  minRating.value = '';
  sort.value = 'createdAt';
  order.value = 'desc';
  apply({ page: undefined });
}

function syncFromQuery(query: LocationQuery): void {
  const parsed = queryToBookQuery(query);
  searchTerm.value = parsed.q ?? '';
  genreId.value = parsed.genre ?? '';
  authorId.value = parsed.author ?? '';
  yearFrom.value = parsed.yearFrom !== undefined ? String(parsed.yearFrom) : '';
  yearTo.value = parsed.yearTo !== undefined ? String(parsed.yearTo) : '';
  language.value = parsed.language ?? '';
  minRating.value = parsed.minRating !== undefined ? String(parsed.minRating) : '';
  sort.value = parsed.sort ?? 'createdAt';
  order.value = parsed.order ?? 'desc';
}

const currentQuery = computed<BookListQuery>(() => {
  const parsed = queryToBookQuery(route.query);
  return parsed.limit === undefined ? { ...parsed, limit: ui.pageSize } : parsed;
});

const cacheKey = computed(() => books.queryKey(currentQuery.value));

const loading = computed(() => books.isLoading(cacheKey.value));
const errorMessage = computed(() => books.errorFor(cacheKey.value) ?? null);
const pageBooks = computed(() => books.listFor(cacheKey.value));
const pageInfo = computed(() => books.pageFor(cacheKey.value));

const currentPage = computed(() => pageInfo.value?.page ?? currentQuery.value.page ?? 1);
const totalPages = computed(() => pageInfo.value?.totalPages ?? 0);
const totalItems = computed(() => pageInfo.value?.total ?? 0);

async function loadBooks(): Promise<void> {
  try {
    await books.fetchBooks(currentQuery.value);
  } catch {
    // El error ya quedó registrado en el store (errorByKey) y se muestra vía errorMessage.
  } finally {
    loadedFirstPage.value = true;
  }
}

watch(
  () => route.query,
  () => {
    syncFromQuery(route.query);
    void loadBooks();
  }
);

onMounted(() => {
  syncFromQuery(route.query);
  void catalog.fetchAll();
  void loadBooks();
});

onBeforeUnmount(() => {
  debouncedSearch.cancel();
});

const genreOptions = computed(() => catalog.genres);
const authorOptions = computed(() => catalog.authors);

const hasFilters = computed(
  () =>
    searchTerm.value !== '' ||
    genreId.value !== '' ||
    authorId.value !== '' ||
    yearFrom.value !== '' ||
    yearTo.value !== '' ||
    language.value !== '' ||
    minRating.value !== ''
);
</script>

<template>
  <section class="catalog-view">
    <h1 class="catalog-view__title">Catálogo de libros</h1>

    <form class="catalog-filters" role="search" @submit.prevent="apply()">
      <div class="field catalog-filters__search">
        <label class="field__label" for="search">Buscar</label>
        <input
          id="search"
          v-model="searchTerm"
          class="field__input"
          type="search"
          name="q"
          placeholder="Título, autor o tags…"
          @input="debouncedSearch"
        />
      </div>

      <div class="field">
        <label class="field__label" for="genre">Género</label>
        <select id="genre" v-model="genreId" class="field__input" name="genre" @change="onFilterChange">
          <option value="">Todos</option>
          <option v-for="genre in genreOptions" :key="genre.id" :value="genre.id">
            {{ genre.name }}
          </option>
        </select>
      </div>

      <div class="field">
        <label class="field__label" for="author">Autor</label>
        <select id="author" v-model="authorId" class="field__input" name="author" @change="onFilterChange">
          <option value="">Todos</option>
          <option v-for="author in authorOptions" :key="author.id" :value="author.id">
            {{ author.name }}
          </option>
        </select>
      </div>

      <div class="field catalog-filters__year">
        <label class="field__label" for="yearFrom">Año desde</label>
        <input
          id="yearFrom"
          v-model="yearFrom"
          class="field__input"
          type="number"
          name="yearFrom"
          min="0"
          max="2100"
          inputmode="numeric"
          @change="onFilterChange"
        />
      </div>

      <div class="field catalog-filters__year">
        <label class="field__label" for="yearTo">Año hasta</label>
        <input
          id="yearTo"
          v-model="yearTo"
          class="field__input"
          type="number"
          name="yearTo"
          min="0"
          max="2100"
          inputmode="numeric"
          @change="onFilterChange"
        />
      </div>

      <div class="field">
        <label class="field__label" for="language">Idioma</label>
        <input
          id="language"
          v-model="language"
          class="field__input"
          type="text"
          name="language"
          placeholder="es, en…"
          @change="onFilterChange"
        />
      </div>

      <div class="field">
        <label class="field__label" for="minRating">Valoración mínima</label>
        <select id="minRating" v-model="minRating" class="field__input" name="minRating" @change="onFilterChange">
          <option value="">Cualquiera</option>
          <option v-for="stars in ratingOptions" :key="stars" :value="String(stars)">
            {{ stars }} estrellas
          </option>
        </select>
      </div>

      <div class="field catalog-filters__sort">
        <label class="field__label" for="sort">Ordenar por</label>
        <div class="catalog-filters__sort-row">
          <select id="sort" v-model="sort" class="field__input" name="sort" @change="onSortChange">
            <option value="createdAt">Fecha de alta</option>
            <option value="title">Título</option>
            <option value="publishedYear">Año de publicación</option>
            <option value="averageRating">Valoración media</option>
          </select>
          <select
            v-model="order"
            class="field__input"
            name="order"
            aria-label="Dirección del orden"
            @change="onSortChange"
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>
      </div>

      <div class="catalog-filters__actions">
        <button v-if="hasFilters" type="button" class="btn btn--ghost" @click="clearFilters">
          Limpiar filtros
        </button>
      </div>
    </form>

    <div class="catalog-view__status" aria-live="polite">
      <span v-if="loading && !loadedFirstPage" class="catalog-view__count">
        Cargando catálogo…
      </span>
      <span v-else-if="totalItems > 0" class="catalog-view__count">
        {{ totalItems }} {{ totalItems === 1 ? 'libro' : 'libros' }}
      </span>
    </div>

    <div v-if="loading || !loadedFirstPage" class="catalog-view__body">
      <SkeletonCard :count="8" />
    </div>

    <ErrorState
      v-else-if="errorMessage !== null"
      class="catalog-view__body"
      :message="errorMessage"
      @retry="loadBooks"
    />

    <EmptyState
      v-else-if="totalItems === 0"
      class="catalog-view__body"
      title="No hay libros con estos filtros"
      description="Prueba a limpiar la búsqueda o elegir otros filtros."
    />

    <template v-else>
      <ul class="catalog-grid">
        <li v-for="book in pageBooks" :key="book.id">
          <BookCard :book="book" />
        </li>
      </ul>

      <PaginationBar
        v-if="totalPages > 1"
        class="catalog-view__pagination"
        :page="currentPage"
        :total-pages="totalPages"
        @change="onPageChange"
      />
    </template>
  </section>
</template>

<style scoped>
.catalog-view {
  padding: 1.5rem;
}

.catalog-view__title {
  margin: 0 0 1rem;
  color: var(--text-color);
}

.catalog-filters {
  display: grid;
  grid-template-columns:
    minmax(12rem, 2fr)
    repeat(2, minmax(9rem, 1fr))
    repeat(2, minmax(6rem, 1fr))
    minmax(8rem, 1fr)
    minmax(9rem, 1fr)
    minmax(12rem, 1fr);
  gap: 0.75rem;
  align-items: end;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.catalog-filters__search {
  grid-column: span 2;
}

.catalog-filters__sort-row {
  display: flex;
  gap: 0.5rem;
}

.catalog-filters__actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.catalog-view__status {
  min-height: 1.5rem;
  margin: 0.5rem 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.catalog-view__body {
  min-height: 12rem;
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.catalog-view__pagination {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

@media (max-width: 1060px) {
  .catalog-filters {
    grid-template-columns: repeat(2, 1fr);
  }

  .catalog-filters__search {
    grid-column: 1 / -1;
  }

  .catalog-filters__actions {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-card :deep(.skeleton-card__line) {
    animation: none;
  }
}
</style>