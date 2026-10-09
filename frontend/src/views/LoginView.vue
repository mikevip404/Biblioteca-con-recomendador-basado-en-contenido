<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import LoadingSpinner from '@/components/LoadingSpinner.vue';
import { useAuthStore } from '@/stores/auth';
import { apiErrorMessage } from '@/utils/errors';
import { validateLoginForm } from '@/utils/validation';
import type { FieldErrors, LoginForm } from '@/utils/validation';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const form = reactive<LoginForm>({ email: '', password: '' });
const errors = ref<FieldErrors<LoginForm>>({});
const serverError = ref<string | null>(null);
const loading = computed(() => auth.status === 'loading');

function redirectPath(): string {
  const redirect = route.query['redirect'];
  if (typeof redirect === 'string' && redirect.startsWith('/')) return redirect;
  return '/books';
}

async function onSubmit(): Promise<void> {
  serverError.value = null;
  errors.value = validateLoginForm(form);
  if (Object.keys(errors.value).length > 0) return;

  try {
    await auth.login({
      email: form.email.trim().toLowerCase(),
      password: form.password
    });
    await router.push(redirectPath());
  } catch (err) {
    serverError.value = apiErrorMessage(err);
  }
}
</script>

<template>
  <section class="auth-view">
    <div class="auth-card">
      <h1 class="auth-card__title">Iniciar sesión</h1>
      <p class="auth-card__subtitle">Accede a tu cuenta de Biblioteca.</p>

      <p v-if="serverError !== null" class="auth-card__server" role="alert" aria-live="assertive">
        {{ serverError }}
      </p>

      <form class="auth-form" novalidate @submit.prevent="onSubmit">
        <div class="field">
          <label class="field__label" for="login-email">Correo electrónico</label>
          <input
            id="login-email"
            v-model="form.email"
            class="field__input"
            type="email"
            name="email"
            autocomplete="email"
            required
            :aria-invalid="errors.email !== undefined"
            :aria-describedby="errors.email !== undefined ? 'login-email-error' : undefined"
          />
          <p v-if="errors.email" id="login-email-error" class="field__error" role="alert">
            {{ errors.email }}
          </p>
        </div>

        <div class="field">
          <label class="field__label" for="login-password">Contraseña</label>
          <input
            id="login-password"
            v-model="form.password"
            class="field__input"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            :aria-invalid="errors.password !== undefined"
            :aria-describedby="errors.password !== undefined ? 'login-password-error' : undefined"
          />
          <p v-if="errors.password" id="login-password-error" class="field__error" role="alert">
            {{ errors.password }}
          </p>
        </div>

        <button type="submit" class="btn btn--primary auth-card__submit" :disabled="loading">
          <LoadingSpinner v-if="loading" label="Iniciando sesión…" />
          <span v-else>Iniciar sesión</span>
        </button>
      </form>

      <p class="auth-card__footer">
        ¿No tienes cuenta?
        <RouterLink to="/register">Regístrate</RouterLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
.auth-view {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.auth-card {
  width: 100%;
  max-width: 26rem;
  padding: 1.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  color: var(--text-color);
}

.auth-card__title {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.auth-card__subtitle {
  margin: 0 0 1rem;
  color: var(--text-muted);
}

.auth-card__server {
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--danger-soft);
  border-radius: var(--radius-sm);
  background: var(--danger-bg);
  color: var(--danger-color);
}

.auth-card__submit {
  width: 100%;
  min-height: 2.8rem;
  margin-top: 0.75rem;
}

.auth-card__submit[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field__label {
  font-weight: 500;
}

.field__input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-color);
}

.field__input:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.field__error {
  margin: 0;
  color: var(--danger-color);
  font-size: 0.85rem;
}

.auth-card__footer {
  margin: 1.25rem 0 0;
  text-align: center;
  color: var(--text-muted);
}
</style>