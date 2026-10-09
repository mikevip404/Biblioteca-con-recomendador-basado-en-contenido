<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const displayName = computed(() => {
  const fullName = auth.user?.fullName.trim();
  if (fullName !== undefined && fullName !== '') return fullName;
  return auth.user?.email;
});

async function handleLogout(): Promise<void> {
  await auth.logout();
  if (router.currentRoute.value.meta.requiresAuth === true) {
    await router.push({ name: 'login' });
  }
}

const themeLabel = computed(() => (ui.theme === 'dark' ? 'Modo claro' : 'Modo oscuro'));
</script>

<template>
  <header class="app-header">
    <RouterLink to="/books" class="app-header__brand">Biblioteca</RouterLink>

    <nav class="app-header__nav" aria-label="Navegación principal">
      <RouterLink to="/books" class="app-header__link">Catálogo</RouterLink>
      <RouterLink to="/favorites" class="app-header__link">Favoritos</RouterLink>
      <RouterLink v-if="auth.isAdmin" to="/403" class="app-header__link">
        Admin (demo)
      </RouterLink>
    </nav>

    <div class="app-header__actions">
      <button
        type="button"
        class="btn btn--ghost"
        :aria-label="themeLabel"
        @click="ui.toggleTheme()"
      >
        {{ ui.theme === 'dark' ? '🌙' : '☀️' }}
      </button>

      <template v-if="auth.isAuthenticated">
        <span class="app-header__user" :title="auth.user?.email">
          {{ displayName }}
        </span>
        <button type="button" class="btn btn--secondary" @click="handleLogout">
          Salir
        </button>
      </template>

      <template v-else>
        <RouterLink to="/login" class="btn btn--ghost">Iniciar sesión</RouterLink>
        <RouterLink to="/register" class="btn btn--primary">Registrarse</RouterLink>
      </template>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-color);
  color: var(--text-color);
}

.app-header__brand {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent-color);
  text-decoration: none;
}

.app-header__nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.app-header__link {
  padding: 0.4rem 0.7rem;
  border-radius: var(--radius-sm);
  color: var(--text-color);
  text-decoration: none;
}

.app-header__link:hover {
  background: var(--accent-soft);
}

.app-header__link.router-link-active {
  color: var(--accent-color);
  font-weight: 600;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.app-header__user {
  color: var(--text-muted);
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .app-header {
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .app-header__nav {
    order: 3;
    width: 100%;
    overflow-x: auto;
  }
}
</style>