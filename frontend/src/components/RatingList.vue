<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import StarRating from '@/components/StarRating.vue';
import type { RatingWithUserDTO } from '@/types';

const props = withDefaults(
  defineProps<{
    ratings: RatingWithUserDTO[];
    loading?: boolean;
    error?: string | null;
    page?: number;
    totalPages?: number;
    emptyTitle?: string;
    emptyDescription?: string;
  }>(),
  {
    loading: false,
    error: null,
    page: 1,
    totalPages: 0,
    emptyTitle: 'Todavía no hay valoraciones',
    emptyDescription: 'Sé el primero en valorar este libro.'
  }
);

const emit = defineEmits<{
  (event: 'retry'): void;
  (event: 'change', page: number): void;
}>();

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
</script>

<template>
  <div class="rating-list">
    <p v-if="loading" class="rating-list__loading" role="status">Cargando valoraciones…</p>

    <ErrorState v-else-if="error !== null" :message="error" @retry="emit('retry')" />

    <EmptyState
      v-else-if="props.ratings.length === 0"
      :title="emptyTitle"
      :description="emptyDescription"
    />

    <template v-else>
      <ul class="rating-list__items">
        <li v-for="rating in props.ratings" :key="rating.id" class="rating-list__item">
          <div class="rating-list__head">
            <span class="rating-list__user">{{ rating.user.name }}</span>
            <time class="rating-list__date" :datetime="rating.updatedAt">
              {{ formatDate(rating.updatedAt) }}
            </time>
          </div>
          <StarRating :rating="rating.value" />
          <p v-if="rating.comment" class="rating-list__comment">{{ rating.comment }}</p>
        </li>
      </ul>

      <PaginationBar
        v-if="props.totalPages > 1"
        class="rating-list__pagination"
        :page="props.page"
        :total-pages="props.totalPages"
        @change="emit('change', $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.rating-list__loading {
  margin: 0;
  color: var(--text-muted);
}

.rating-list__items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rating-list__item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.rating-list__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.rating-list__user {
  font-weight: 600;
}

.rating-list__date {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.rating-list__comment {
  margin: 0;
  color: var(--text-color);
}

.rating-list__pagination {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}
</style>
