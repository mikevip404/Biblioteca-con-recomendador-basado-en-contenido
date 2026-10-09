<script setup lang="ts">
import { computed } from 'vue';

import StarRating from '@/components/StarRating.vue';
import type { BookDTO } from '@/types';

const props = defineProps<{ book: BookDTO }>();

const averageLabel = computed(() => {
  if (props.book.ratingCount === 0) return 'Sin valoraciones';
  return `${Math.round(props.book.averageRating * 10) / 10} (${props.book.ratingCount})`;
});

const formattedYear = computed(() => {
  if (props.book.publishedYear === undefined) return undefined;
  return String(props.book.publishedYear);
});
</script>

<template>
  <article class="book-card">
    <RouterLink
      :to="{ name: 'book-detail', params: { id: book.id } }"
      class="book-card__link"
    >
      <span class="book-card__title">{{ book.title }}</span>
    </RouterLink>
    <p v-if="book.author" class="book-card__author">{{ book.author.name }}</p>

    <p v-if="book.description" class="book-card__description">
      {{ book.description }}
    </p>

    <ul v-if="book.genres.length > 0" class="book-card__genres">
      <li v-for="genre in book.genres" :key="genre.id" class="book-card__genre">
        {{ genre.name }}
      </li>
    </ul>

    <div class="book-card__meta">
      <span v-if="formattedYear !== undefined" class="book-card__year">
        {{ formattedYear }}
      </span>
      <span class="book-card__rating" :aria-label="averageLabel">
        <StarRating :rating="book.averageRating" />
        <span aria-hidden="true" class="book-card__count">{{ averageLabel }}</span>
      </span>
    </div>
  </article>
</template>

<style scoped>
.book-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--text-color);
}

.book-card__link {
  color: inherit;
  font-size: 1.05rem;
  font-weight: 600;
  text-decoration: none;
}

.book-card__link:hover {
  text-decoration: underline;
}

.book-card__author {
  margin: 0;
  color: var(--text-muted);
}

.book-card__description {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.book-card__genres {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.book-card__genre {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-color);
  font-size: 0.8rem;
}

.book-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
}

.book-card__rating {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.book-card__year {
  color: var(--text-muted);
  font-size: 0.9rem;
}
</style>