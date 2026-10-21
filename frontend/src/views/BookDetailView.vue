<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import BookRatingForm from '@/components/BookRatingForm.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import RatingList from '@/components/RatingList.vue';
import StarRating from '@/components/StarRating.vue';
import { useAuthStore } from '@/stores/auth';
import { useBooksStore } from '@/stores/books';
import { useFavoritesStore } from '@/stores/favorites';
import { useRatingsStore } from '@/stores/ratings';
import { useToastsStore } from '@/stores/toasts';
import type { BookDTO, BookSummaryDTO, RatingDTO, RatingValue } from '@/types';
import { apiErrorMessage } from '@/utils/errors';

/** Valoraciones por página en el detalle. */
const RATINGS_LIMIT = 10;

const route = useRoute();
const auth = useAuthStore();
const books = useBooksStore();
const ratings = useRatingsStore();
const favorites = useFavoritesStore();
const toasts = useToastsStore();

const bookId = computed(() =>
  typeof route.params['id'] === 'string' ? route.params['id'] : ''
);

const book = computed<BookDTO | undefined>(() => books.getBook(bookId.value));

const bookLoading = ref(false);
const bookError = ref<string | null>(null);
const ratingsPage = ref(1);

let routeController: AbortController | null = null;
let ratingsController: AbortController | null = null;

async function loadBook(signal: AbortSignal): Promise<void> {
  const id = bookId.value;
  if (id === '') return;
  if (books.getBook(id) === undefined) bookLoading.value = true;
  bookError.value = null;
  try {
    // Si ya está en el store se muestra al instante y esto lo refresca.
    await books.fetchBook(id, { signal, force: true });
  } catch (error) {
    if (signal.aborted) return;
    bookError.value = apiErrorMessage(error);
  } finally {
    if (!signal.aborted) bookLoading.value = false;
  }
}

async function loadRatings(page: number, signal: AbortSignal): Promise<void> {
  const id = bookId.value;
  if (id === '') return;
  ratingsPage.value = page;
  await ratings.fetchBookRatings(id, { page, limit: RATINGS_LIMIT, signal });
}

function load(page = 1): void {
  routeController?.abort();
  ratingsController?.abort();
  routeController = new AbortController();
  ratingsController = new AbortController();
  void loadBook(routeController.signal);
  void loadRatings(page, ratingsController.signal);
}

function changeRatingsPage(page: number): void {
  ratingsController?.abort();
  ratingsController = new AbortController();
  void loadRatings(page, ratingsController.signal);
}

function retryBook(): void {
  load(ratingsPage.value);
}

function retryRatings(): void {
  changeRatingsPage(ratingsPage.value);
}

onMounted(() => {
  load();
});

watch(bookId, () => {
  load();
});

onBeforeUnmount(() => {
  routeController?.abort();
  ratingsController?.abort();
});

// Siembra mi valoración y el estado de favorito desde el detalle del libro.
watch(
  book,
  (value) => {
    if (value === undefined) return;
    if (ratings.myRatingFor(value.id) === undefined) {
      if (value.myRating === undefined || value.myRating === null) {
        ratings.setMyRatingLocal(value.id, null);
      } else {
        ratings.setMyRatingLocal(value.id, {
          id: `book-${value.id}`,
          value: value.myRating,
          createdAt: value.updatedAt,
          updatedAt: value.updatedAt
        });
      }
    }
    if (favorites.isFavorite(value.id) === undefined && typeof value.isFavorite === 'boolean') {
      favorites.setMembershipLocal(value.id, value.isFavorite);
    }
  },
  { immediate: true }
);

const allRatings = computed(() => (bookId.value === '' ? [] : ratings.ratingsForBook(bookId.value)));

/** Listado visible: solo valoraciones de otros usuarios. */
const otherRatings = computed(() => {
  const viewerId = auth.user?.id;
  if (viewerId === undefined) return allRatings.value;
  return allRatings.value.filter((rating) => rating.user.id !== viewerId);
});

// Si la lista de valoraciones trae la mía, aprovecha para conocer su id real.
watch(allRatings, (list) => {
  const viewerId = auth.user?.id;
  if (viewerId === undefined) return;
  const mine = list.find((rating) => rating.user.id === viewerId);
  if (mine === undefined) return;
  if (ratings.myRatingFor(bookId.value) !== undefined) return;
  const dto: RatingDTO = {
    id: mine.id,
    value: mine.value,
    createdAt: mine.createdAt,
    updatedAt: mine.updatedAt
  };
  if (mine.comment !== undefined) dto.comment = mine.comment;
  ratings.setMyRatingLocal(bookId.value, dto);
});

const ratingsMeta = computed(() => ratings.bookMeta(bookId.value));
const ratingsTotalPages = computed(() => ratingsMeta.value?.totalPages ?? 0);
const ratingsLoading = computed(() => bookId.value !== '' && ratings.isLoadingBook(bookId.value));
const ratingsError = computed(() =>
  bookId.value === '' ? null : ratings.bookErrorFor(bookId.value)
);

const myRating = computed(() => ratings.myRatingFor(bookId.value));
const myRatingValue = computed(() => myRating.value?.value ?? 0);
const myRatingComment = computed(() => myRating.value?.comment ?? '');
const hasMyRating = computed(() => myRating.value !== undefined && myRating.value !== null);
const savingRating = computed(() => ratings.isSaving(bookId.value));

const isFavorite = computed(
  () => favorites.isFavorite(bookId.value) ?? book.value?.isFavorite ?? false
);
const favoriteBusy = computed(() => favorites.isToggling(bookId.value));

const ratingCountLabel = computed(() => {
  const value = book.value;
  if (value === undefined) return '';
  if (value.ratingCount === 0) return 'Sin valoraciones';
  const count = value.ratingCount === 1 ? '1 valoración' : `${value.ratingCount} valoraciones`;
  return `${Math.round(value.averageRating * 10) / 10} · ${count}`;
});

const metaParts = computed(() => {
  const value = book.value;
  if (value === undefined) return [] as string[];
  const parts: string[] = [];
  if (value.publishedYear !== undefined) parts.push(String(value.publishedYear));
  if (value.pages !== undefined) parts.push(`${value.pages} págs.`);
  if (value.language !== undefined && value.language !== '') parts.push(value.language.toUpperCase());
  return parts;
});

function toSummary(value: BookDTO): BookSummaryDTO {
  const summary: BookSummaryDTO = {
    id: value.id,
    title: value.title,
    averageRating: value.averageRating
  };
  if (value.coverUrl !== undefined) summary.coverUrl = value.coverUrl;
  return summary;
}

function isRatingValue(value: number): value is RatingValue {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

async function onToggleFavorite(): Promise<void> {
  const value = book.value;
  if (value === undefined) return;
  const next = !isFavorite.value;
  try {
    await favorites.setFavorite(toSummary(value), next);
    toasts.success(next ? 'Añadido a favoritos' : 'Quitado de favoritos');
  } catch (error) {
    toasts.error(apiErrorMessage(error));
  }
}

async function onSaveRating(value: number, comment: string): Promise<void> {
  if (!isRatingValue(value)) return;
  try {
    await ratings.saveMyRating(bookId.value, value, comment === '' ? undefined : comment);
    toasts.success('Valoración guardada');
  } catch (error) {
    toasts.error(apiErrorMessage(error));
  }
}

async function onDeleteRating(): Promise<void> {
  try {
    await ratings.deleteMyRating(bookId.value);
    toasts.success('Valoración eliminada');
  } catch (error) {
    toasts.error(apiErrorMessage(error));
  }
}
</script>

<template>
  <section class="book-detail">
    <RouterLink :to="{ name: 'books' }" class="book-detail__back">
      ← Volver al catálogo
    </RouterLink>

    <div v-if="bookLoading && book === undefined" class="book-detail__skeleton" role="status">
      <span class="book-detail__skeleton-line book-detail__skeleton-line--title"></span>
      <span class="book-detail__skeleton-line"></span>
      <span class="book-detail__skeleton-line book-detail__skeleton-line--short"></span>
      <span class="sr-only">Cargando el detalle del libro…</span>
    </div>

    <ErrorState
      v-else-if="bookError !== null && book === undefined"
      :message="bookError"
      @retry="retryBook"
    />

    <EmptyState
      v-else-if="book === undefined"
      title="Libro no encontrado"
      description="Puede que se haya eliminado o que el enlace sea incorrecto."
    />

    <template v-else>
      <header class="book-detail__header">
        <div class="book-detail__intro">
          <h1 class="book-detail__title">{{ book.title }}</h1>
          <p class="book-detail__author">{{ book.author.name }}</p>
          <p v-if="metaParts.length > 0" class="book-detail__meta">
            {{ metaParts.join(' · ') }}
          </p>

          <ul v-if="book.genres.length > 0" class="book-detail__chips">
            <li v-for="genre in book.genres" :key="genre.id" class="book-detail__chip">
              {{ genre.name }}
            </li>
          </ul>

          <ul v-if="book.tags.length > 0" class="book-detail__tags" aria-label="Etiquetas">
            <li v-for="tag in book.tags" :key="tag" class="book-detail__tag">#{{ tag }}</li>
          </ul>

          <div class="book-detail__rating-summary">
            <StarRating :rating="book.averageRating" />
            <span class="book-detail__rating-count">{{ ratingCountLabel }}</span>
          </div>
        </div>

        <button
          type="button"
          class="btn btn--secondary book-detail__favorite"
          :aria-pressed="isFavorite"
          :disabled="favoriteBusy"
          @click="onToggleFavorite"
        >
          <span aria-hidden="true">{{ isFavorite ? '★' : '☆' }}</span>
          {{ isFavorite ? 'En favoritos' : 'Añadir a favoritos' }}
        </button>
      </header>

      <p v-if="bookError !== null" class="book-detail__refresh-error" role="status">
        No se pudo refrescar la ficha:
        <button type="button" class="book-detail__link-button" @click="retryBook">
          reintentar
        </button>
      </p>

      <p v-if="book.description" class="book-detail__description">{{ book.description }}</p>

      <BookRatingForm
        class="book-detail__form"
        :value="myRatingValue"
        :comment="myRatingComment"
        :saving="savingRating"
        :can-delete="hasMyRating"
        @save="onSaveRating"
        @delete="onDeleteRating"
      />

      <section class="book-detail__ratings" aria-labelledby="ratings-heading">
        <h2 id="ratings-heading" class="book-detail__section-title">Valoraciones</h2>
        <RatingList
          :ratings="otherRatings"
          :loading="ratingsLoading"
          :error="ratingsError"
          :page="ratingsPage"
          :total-pages="ratingsTotalPages"
          @retry="retryRatings"
          @change="changeRatingsPage"
        />
      </section>
    </template>
  </section>
</template>

<style scoped>
.book-detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
}

.book-detail__back {
  align-self: flex-start;
  color: var(--accent-color);
  text-decoration: none;
}

.book-detail__back:hover {
  text-decoration: underline;
}

.book-detail__header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-detail__title {
  margin: 0 0 0.25rem;
  color: var(--text-color);
}

.book-detail__author {
  margin: 0;
  color: var(--text-muted);
  font-size: 1.05rem;
}

.book-detail__meta {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.book-detail__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.book-detail__chip {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-color);
  font-size: 0.8rem;
}

.book-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.book-detail__rating-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.book-detail__rating-count {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.book-detail__favorite {
  align-self: flex-start;
}

.book-detail__refresh-error {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.book-detail__link-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
}

.book-detail__description {
  margin: 0;
  color: var(--text-color);
}

.book-detail__section-title {
  margin: 0 0 0.75rem;
  color: var(--text-color);
}

.book-detail__skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.book-detail__skeleton-line {
  display: block;
  height: 1rem;
  width: 100%;
  border-radius: var(--radius-sm);
  background: var(--skeleton-color);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.book-detail__skeleton-line--title {
  height: 1.6rem;
  width: 60%;
}

.book-detail__skeleton-line--short {
  width: 35%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

@media (min-width: 768px) {
  .book-detail__header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .book-detail__intro {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-detail__skeleton-line {
    animation: none;
  }
}
</style>
