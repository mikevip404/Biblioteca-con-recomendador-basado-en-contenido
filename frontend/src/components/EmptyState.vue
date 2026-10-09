<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: 'Sin resultados',
  description: ''
});
</script>

<template>
  <div class="empty-state">
    <p class="empty-state__title" role="status">{{ title }}</p>
    <p v-if="description !== ''" class="empty-state__description">
      {{ description }}
    </p>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  text-align: center;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-muted);
}

.empty-state__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.empty-state__description {
  margin: 0;
  font-size: 0.9rem;
}
</style>