<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const themeLabel = computed(() => (ui.theme === 'dark' ? 'Modo claro' : 'Modo oscuro'));
</script>

<template>
  <div class="auth-layout">
    <header class="auth-layout__bar">
      <RouterLink to="/books" class="auth-layout__brand">Biblioteca</RouterLink>
      <button
        type="button"
        class="btn btn--ghost"
        :aria-label="themeLabel"
        @click="ui.toggleTheme()"
      >
        {{ ui.theme === 'dark' ? '🌙' : '☀️' }}
      </button>
    </header>
    <main class="auth-layout__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.auth-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.auth-layout__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-color);
}

.auth-layout__brand {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent-color);
  text-decoration: none;
}

.auth-layout__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}
</style>
