<script setup lang="ts">
withDefaults(defineProps<{ message?: string | undefined }>(), {
  message: 'No se pudo completar la operación.'
});

const emit = defineEmits<{ (event: 'retry'): void }>();
</script>

<template>
  <div class="error-state" role="alert">
    <p class="error-state__message">{{ message }}</p>
    <button type="button" class="btn btn--secondary" @click="emit('retry')">
      Reintentar
    </button>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  max-width: 40rem;
  padding: 1.25rem;
  border: 1px solid var(--danger-soft);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--danger-color);
}

.error-state__message {
  margin: 0;
  font-weight: 500;
}
</style>
