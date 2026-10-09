<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="status-view">
    <p class="status-view__code" aria-hidden="true">404</p>
    <h1 class="status-view__title">Página no encontrada</h1>
    <p class="status-view__text">La página que buscas no existe o fue movida.</p>
    <RouterLink to="/books" class="btn btn--primary">Volver al catálogo</RouterLink>
  </section>
</template>

<style scoped>
.status-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 4rem 1.5rem;
  text-align: center;
  color: var(--text-color);
}

.status-view__code {
  margin: 0;
  font-size: 3rem;
  font-weight: 700;
  color: var(--accent-color);
}

.status-view__title {
  margin: 0;
}

.status-view__text {
  margin: 0 0 0.5rem;
  color: var(--text-muted);
}
</style>