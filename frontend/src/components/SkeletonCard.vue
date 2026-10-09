<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), {
  count: 8
});
</script>

<template>
  <ul class="skeleton-card" aria-hidden="true">
    <li v-for="index in count" :key="index" class="skeleton-card__item">
      <span class="skeleton-card__line skeleton-card__line--title"></span>
      <span class="skeleton-card__line skeleton-card__line--short"></span>
      <span class="skeleton-card__line skeleton-card__line--body"></span>
      <span class="skeleton-card__line skeleton-card__line--short"></span>
    </li>
  </ul>
</template>

<style scoped>
.skeleton-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.skeleton-card__item {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.skeleton-card__line {
  display: block;
  height: 0.9rem;
  border-radius: var(--radius-sm);
  background: var(--skeleton-color);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-card__line--title {
  height: 1.1rem;
  width: 85%;
}

.skeleton-card__line--short {
  width: 45%;
}

.skeleton-card__line--body {
  width: 100%;
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

@media (prefers-reduced-motion: reduce) {
  .skeleton-card__line {
    animation: none;
  }
}
</style>