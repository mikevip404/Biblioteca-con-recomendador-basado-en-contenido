<script setup lang="ts">
import { useToastsStore } from '@/stores/toasts';

const toasts = useToastsStore();
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <div
      v-for="toast in toasts.items"
      :key="toast.id"
      class="toast"
      :class="`toast--${toast.type}`"
      :role="toast.type === 'error' ? 'alert' : 'status'"
    >
      <span class="toast__message">{{ toast.message }}</span>
      <button
        type="button"
        class="toast__close"
        aria-label="Cerrar notificación"
        @click="toasts.dismiss(toast.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  left: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: min(24rem, 100%);
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border-color);
  border-left-width: 4px;
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--text-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
}

.toast--success {
  border-left-color: #1f8a4c;
}

.toast--error {
  border-left-color: var(--danger-color);
}

.toast--info {
  border-left-color: var(--accent-color);
}

.toast__message {
  flex: 1;
  font-size: 0.95rem;
}

.toast__close {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 0.2rem;
}

.toast__close:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

@media (max-width: 480px) {
  .toast-host {
    align-items: stretch;
  }
}
</style>
