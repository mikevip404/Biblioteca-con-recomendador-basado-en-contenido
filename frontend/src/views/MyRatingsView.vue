<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import SkeletonCard from '@/components/SkeletonCard.vue';
import StarRating from '@/components/StarRating.vue';
import { useRatingsStore } from '@/stores/ratings';
import { useToastsStore } from '@/stores/toasts';
import { useUiStore } from '@/stores/ui';
import type { RatingValue, RatingWithBookDTO } from '@/types';
import { apiErrorMessage } from '@/utils/errors';

const ratings = useRatingsStore();
const toasts = useToastsStore();
const ui = useUiStore();

const page = ref(1);
const editingId = ref<string | null>(null);
const editValue = ref<number>(0);
const editComment = ref('');
let controller: AbortController | null = null;

const items = computed(() => ratings.mine);
const totalPages = computed(() => ratings.mineMeta.totalPages);

async function load(target: number = page.value): Promise<void> {
  controller?.abort();
  controller = new AbortController();
  page.value = target;
  await ratings.fetchMine({ page: target, limit: ui.pageSize, signal: controller.signal });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function isRatingValue(value: number): value is RatingValue {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function startEdit(rating: RatingWithBookDTO): void {
  editingId.value = rating.id;
  editValue.value = rating.value;
  editComment.value = rating.comment ?? '';
}

function cancelEdit(): void {
  editingId.value = null;
}

async function saveEdit(rating: RatingWithBookDTO): Promise<void> {
  if (!isRatingValue(editValue.value)) return;
  const comment = editComment.value.trim();
  try {
    await ratings.saveMyRating(
      rating.book.id,
      editValue.value,
      comment === '' ? undefined : comment
    );
    editingId.value = null;
    toasts.success('Valoración actualizada');
  } catch (error) {
    toasts.error(apiErrorMessage(error));
  }
}

async function removeRating(rating: RatingWithBookDTO): Promise<void> {
  try {
    await ratings.deleteRating(rating.id, rating.book.id);
    toasts.success('Valoración eliminada');
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
  <section class="my-ratings-view">
    <h1 class="my-ratings-view__title">Mis valoraciones</h1>

    <div v-if="ratings.mineLoading && items.length === 0" class="my-ratings-view__body" role="status">
      <SkeletonCard :count="4" />
      <span class="sr-only">Cargando tus valoraciones…</span>
    </div>

    <ErrorState
      v-else-if="ratings.mineError !== null"
      class="my-ratings-view__body"
      :message="ratings.mineError"
      @retry="load()"
    />

    <EmptyState
      v-else-if="items.length === 0"
      class="my-ratings-view__body"
      title="Todavía no has valorado ningún libro"
      description="Entra en un libro y deja tu valoración."
    />

    <template v-else>
      <ul class="ratings-list">
        <li v-for="rating in items" :key="rating.id" class="rating-row">
          <div class="rating-row__main">
            <RouterLink
              :to="{ name: 'book-detail', params: { id: rating.book.id } }"
              class="rating-row__title"
            >
              {{ rating.book.title }}
            </RouterLink>

            <StarRating :rating="rating.value" />

            <p v-if="rating.comment && editingId !== rating.id" class="rating-row__comment">
              {{ rating.comment }}
            </p>

            <time class="rating-row__date" :datetime="rating.updatedAt">
              {{ formatDate(rating.updatedAt) }}
            </time>
          </div>

          <div v-if="editingId === rating.id" class="rating-row__editor">
            <StarRating
              v-model="editValue"
              interactive
              label="Tu valoración"
            />
            <label class="rating-row__label" :for="`edit-comment-${rating.id}`">
              Comentario (opcional)
            </label>
            <textarea
              :id="`edit-comment-${rating.id}`"
              v-model="editComment"
              class="field__input"
              rows="3"
              maxlength="500"
            ></textarea>
            <div class="rating-row__actions">
              <button
                type="button"
                class="btn btn--primary"
                :disabled="editValue < 1"
                @click="saveEdit(rating)"
              >
                Guardar
              </button>
              <button type="button" class="btn btn--ghost" @click="cancelEdit">Cancelar</button>
            </div>
          </div>

          <div v-else class="rating-row__actions">
            <button type="button" class="btn btn--secondary" @click="startEdit(rating)">
              Editar
            </button>
            <button type="button" class="btn btn--ghost" @click="removeRating(rating)">
              Eliminar
            </button>
          </div>
        </li>
      </ul>

      <PaginationBar
        v-if="totalPages > 1"
        class="my-ratings-view__pagination"
        :page="page"
        :total-pages="totalPages"
        @change="load"
      />
    </template>
  </section>
</template>

<style scoped>
.my-ratings-view {
  padding: 1.5rem;
}

.my-ratings-view__title {
  margin: 0 0 1rem;
  color: var(--text-color);
}

.my-ratings-view__body {
  min-height: 12rem;
}

.ratings-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rating-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.rating-row__main {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.rating-row__title {
  color: var(--text-color);
  font-size: 1.05rem;
  font-weight: 600;
  text-decoration: none;
}

.rating-row__title:hover {
  text-decoration: underline;
}

.rating-row__comment {
  margin: 0;
  color: var(--text-color);
}

.rating-row__date {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.rating-row__editor {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.rating-row__label {
  font-weight: 500;
}

.rating-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.my-ratings-view__pagination {
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

@media (min-width: 768px) {
  .rating-row {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .rating-row__actions {
    flex-direction: column;
    flex-shrink: 0;
  }
}
</style>
