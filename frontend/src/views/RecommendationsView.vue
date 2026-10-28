<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import RecommendationCard from '@/components/RecommendationCard.vue';
import SkeletonCard from '@/components/SkeletonCard.vue';
import { recommendationsApi } from '@/api/recommendationsApi';
import type { RecommendationStrategy, SimilarBookDTO } from '@/types';
import { apiErrorMessage } from '@/utils/errors';

const RECOMMENDATIONS_LIMIT = 12;

const items = ref<SimilarBookDTO[]>([]);
const strategy = ref<RecommendationStrategy | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let controller: AbortController | null = null;

async function load(): Promise<void> {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  error.value = null;
  try {
    const result = await recommendationsApi.getRecommendations(
      { limit: RECOMMENDATIONS_LIMIT },
      { signal: controller.signal }
    );
    items.value = result.data;
    strategy.value = result.strategy;
  } catch (err) {
    if (controller.signal.aborted) return;
    error.value = apiErrorMessage(err);
  } finally {
    if (!controller.signal.aborted) loading.value = false;
  }
}

onMounted(() => {
  void load();
});

onBeforeUnmount(() => {
  controller?.abort();
});
</script>

<template>
  <section class="recommendations-view">
    <header class="recommendations-view__header">
      <h1 class="recommendations-view__title">Recomendados para ti</h1>
      <p class="recommendations-view__intro">
        Basado en los géneros, etiquetas y autores de los libros que has valorado
        y guardado.
      </p>
    </header>

    <div v-if="loading && items.length === 0" class="recommendations-view__body" role="status">
      <SkeletonCard :count="6" />
      <span class="sr-only">Calculando recomendaciones…</span>
    </div>

    <ErrorState
      v-else-if="error !== null"
      class="recommendations-view__body"
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="items.length === 0"
      class="recommendations-view__body"
      title="Todavía no hay recomendaciones"
      description="Valora algunos libros para que el motor pueda construir tu perfil lector."
    />

    <template v-else>
      <p v-if="strategy === 'popular'" class="recommendations-view__strategy" role="status">
        Aún no tienes suficiente historial: mostramos los libros mejor valorados.
      </p>

      <ul class="recommendations-grid">
        <li v-for="item in items" :key="item.book.id">
          <RecommendationCard :item="item" />
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.recommendations-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
}

.recommendations-view__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.recommendations-view__title {
  margin: 0;
  color: var(--text-color);
}

.recommendations-view__intro {
  margin: 0;
  color: var(--text-muted);
  max-width: 48rem;
}

.recommendations-view__strategy {
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--text-muted);
  font-size: 0.9rem;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
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
