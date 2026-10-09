<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), {
  label: 'Cargando…'
});
</script>

<template>
  <span class="loading-spinner" role="status">
    <span class="loading-spinner__icon" aria-hidden="true"></span>
    <span class="loading-spinner__label">{{ label }}</span>
  </span>
</template>

<style scoped>
.loading-spinner {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-muted);
}

.loading-spinner__icon {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--accent-soft);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: loading-spinner-rotate 0.8s linear infinite;
}

@keyframes loading-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner__icon {
    animation-duration: 1.5s;
  }
}
</style>