<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import SkeletonCard from '@/components/SkeletonCard.vue';
import StarRating from '@/components/StarRating.vue';
import { useFavoritesStore } from '@/stores/favorites';
import { useToastsStore } from '@/stores/toasts';
import { useUiStore } from '@/stores/ui';
import type { FavoriteDTO } from '@/types';
import { apiErrorMessage } from '@/utils/errors';

const favorites = useFavoritesStore();
const toasts = useToastsStore();
const ui = useUiStore();

const page = ref(1);
let controller: AbortController | null = null;

const items = computed(() => favorites.list);
const totalPages = computed(() => favorites.meta.totalPages);

async function load(target: number = page.value): Promise<void> {
  controller?.abort();
  controller = new AbortController();
  page.value = target;
  await favorites.fetchMine({ page: target, limit: ui.pageSize, signal: controller.signal });
}

function formatAverage(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

async function removeFavorite(favorite: FavoriteDTO): Promise<void> {
  try {
    await favorites.remove(favorite.id);
    toasts.success('Quitado de favoritos');
    if (items.value.length === 0 && page.value > 1) {
      await load(page.value - 1);
    }
  } catch (error) {
    toasts.error(apiErrorMessage(error));
  }
}

onMounted(() => {
  void load(1);
});

onBeforeUnmount(() => {
  controller?.abort();
});

watch(
  () => ui.pageSize,
  () => {
    void load(1);
  }
);
</script>

<template>
  <section class="favorites-view">
    <h1 class="favorites-view__title">Mis favoritos</h1>

    <div v-if="favorites.loading && items.length === 0" class="favorites-view__body" role="status">
      <SkeletonCard :count="6" />
      <span class="sr-only">Cargando favoritos…</span>
    </div>

    <ErrorState
      v-else-if="favorites.error !== null"
      class="favorites-view__body"
      :message="favorites.error"
      @retry="load()"
    />

    <EmptyState
      v-else-if="items.length === 0"
      class="favorites-view__body"
      title="Aún no tienes favoritos"
      description="Marca libros como favoritos para verlos aquí."
    />

    <template v-else>
      <ul class="favorites-grid">
        <li v-for="favorite in items" :key="favorite.id" class="favorite-card">
          <RouterLink
            :to="{ name: 'book-detail', params: { id: favorite.book.id } }"
            class="favorite-card__title"
          >
            {{ favorite.book.title }}
          </RouterLink>

          <div class="favorite-card__meta">
            <StarRating :rating="favorite.book.averageRating" />
            <span class="favorite-card__average" aria-hidden="true">
              {{ formatAverage(favorite.book.averageRating) }}
            </span>
          </div>

          <button
            type="button"
            class="btn btn--secondary favorite-card__remove"
            @click="removeFavorite(favorite)"
          >
            Quitar de favoritos
          </button>
        </li>
      </ul>

      <PaginationBar
        v-if="totalPages > 1"
        class="favorites-view__pagination"
        :page="page"
        :total-pages="totalPages"
        @change="load"
      />
    </template>
  </section>
</template>

<style scoped>
.favorites-view {
  padding: 1.5rem;
}

.favorites-view__title {
  margin: 0 0 1rem;
  color: var(--text-color);
}

.favorites-view__body {
  min-height: 12rem;
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.favorite-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.favorite-card__title {
  color: var(--text-color);
  font-size: 1.05rem;
  font-weight: 600;
  text-decoration: none;
}

.favorite-card__title:hover {
  text-decoration: underline;
}

.favorite-card__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
}

.favorite-card__average {
  font-size: 0.85rem;
}

.favorite-card__remove {
  margin-top: auto;
  align-self: flex-start;
}

.favorites-view__pagination {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
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
</style>
