<script setup lang="ts">
import { computed } from 'vue';

import StarRating from '@/components/StarRating.vue';
import type { SimilarBookDTO } from '@/types';

const props = defineProps<{ item: SimilarBookDTO }>();

const averageLabel = computed(() =>
  (Math.round(props.item.book.averageRating * 10) / 10).toFixed(1)
);

const scorePercent = computed(() => Math.round(props.item.score * 100));
</script>

<template>
  <article class="recommendation-card">
    <header class="recommendation-card__header">
      <RouterLink
        :to="{ name: 'book-detail', params: { id: item.book.id } }"
        class="recommendation-card__title"
      >
        {{ item.book.title }}
      </RouterLink>
      <span v-if="item.book.mainGenre" class="recommendation-card__genre">
        {{ item.book.mainGenre }}
      </span>
    </header>

    <div class="recommendation-card__meta">
      <span class="recommendation-card__rating">
        <StarRating :rating="item.book.averageRating" />
        <span aria-hidden="true">{{ averageLabel }}</span>
      </span>
      <span
        v-if="item.score > 0"
        class="recommendation-card__score"
        title="Similitud de coseno"
      >
        {{ scorePercent }}% afín
      </span>
      <span v-else class="recommendation-card__score" title="Respaldo por popularidad">
        Popular
      </span>
    </div>

    <ul v-if="item.reasons.length > 0" class="recommendation-card__reasons">
      <li
        v-for="reason in item.reasons"
        :key="`${reason.type}-${reason.label}`"
        class="recommendation-card__reason"
      >
        {{ reason.label }}
      </li>
    </ul>
  </article>
</template>

<style scoped>
.recommendation-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--text-color);
}

.recommendation-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.recommendation-card__title {
  color: inherit;
  font-size: 1.05rem;
  font-weight: 600;
  text-decoration: none;
}

.recommendation-card__title:hover {
  text-decoration: underline;
}

.recommendation-card__genre {
  align-self: flex-start;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-color);
  font-size: 0.8rem;
}

.recommendation-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.recommendation-card__rating {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.recommendation-card__score {
  font-variant-numeric: tabular-nums;
}

.recommendation-card__reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recommendation-card__reason {
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 0.78rem;
}
</style>
