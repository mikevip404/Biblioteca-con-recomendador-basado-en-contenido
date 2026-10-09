<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const bookId = computed(() =>
  typeof route.params['id'] === 'string' ? route.params['id'] : ''
);
</script>

<template>
  <section class="placeholder-view">
    <h1 class="placeholder-view__title">Detalle del libro</h1>
    <p class="placeholder-view__text">
      La vista de detalle del libro <code>{{ bookId }}</code> llegará en la
      siguiente fase (valoraciones, favoritos y libros afines).
    </p>
  </section>
</template>

<style scoped>
.placeholder-view {
  padding: 2rem 1.5rem;
  color: var(--text-color);
}

.placeholder-view__title {
  margin: 0 0 0.5rem;
}

.placeholder-view__text {
  color: var(--text-muted);
}

.placeholder-view__text code {
  padding: 0.1rem 0.3rem;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-color);
}
</style>