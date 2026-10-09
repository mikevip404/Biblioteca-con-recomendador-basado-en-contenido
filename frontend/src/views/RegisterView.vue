<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import { isApiError } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import { useAuthStore } from '@/stores/auth';
import { apiErrorMessage } from '@/utils/errors';
import { validateRegisterForm } from '@/utils/validation';
import type { FieldErrors, RegisterForm } from '@/utils/validation';

const router = useRouter();
const auth = useAuthStore();

const form = reactive<RegisterForm>({ email: '', password: '', fullName: '' });
const errors = ref<FieldErrors<RegisterForm>>({});
const serverError = ref<string | null>(null);
const loading = computed(() => auth.status === 'loading');

async function onSubmit(): Promise<void> {
  serverError.value = null;
  errors.value = validateRegisterForm(form);
  if (Object.keys(errors.value).length > 0) return;

  try {
    await auth.register({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      fullName: form.fullName.trim()
    });
    await router.push('/books');
  } catch (err) {
    // El backend usa CONFLICT para el correo ya registrado: se muestra en el campo.
    if (isApiError(err) && err.code === 'CONFLICT') {
      errors.value = { ...errors.value, email: err.message };
      return;
    }
    serverError.value = apiErrorMessage(err);
  }
}
</script>

<template>
  <section class="auth-view">
    <div class="auth-card">
      <h1 class="auth-card__title">Crear cuenta</h1>
      <p class="auth-card__subtitle">Únete a Biblioteca para explorar el catálogo.</p>

      <p v-if="serverError !== null" class="auth-card__server" role="alert" aria-live="assertive">
        {{ serverError }}
      </p>

      <form class="auth-form" novalidate @submit.prevent="onSubmit">
        <div class="field">
          <label class="field__label" for="register-name">Nombre completo</label>
          <input
            id="register-name"
            v-model="form.fullName"
            class="field__input"
            type="text"
            name="fullName"
            autocomplete="name"
            required
            :aria-invalid="errors.fullName !== undefined"
            :aria-describedby="errors.fullName !== undefined ? 'register-name-error' : undefined"
          />
          <p v-if="errors.fullName" id="register-name-error" class="field__error" role="alert">
            {{ errors.fullName }}
          </p>
        </div>

        <div class="field">
          <label class="field__label" for="register-email">Correo electrónico</label>
          <input
            id="register-email"
            v-model="form.email"
            class="field__input"
            type="email"
            name="email"
            autocomplete="email"
            required
            :aria-invalid="errors.email !== undefined"
            :aria-describedby="errors.email !== undefined ? 'register-email-error' : undefined"
          />
          <p v-if="errors.email" id="register-email-error" class="field__error" role="alert">
            {{ errors.email }}
          </p>
        </div>

        <div class="field">
          <label class="field__label" for="register-password">Contraseña</label>
          <input
            id="register-password"
            v-model="form.password"
            class="field__input"
            type="password"
            name="password"
            autocomplete="new-password"
            required
            minlength="8"
            :aria-invalid="errors.password !== undefined"
            :aria-describedby="errors.password !== undefined ? 'register-password-error' : undefined"
          />
          <ul
            v-if="errors.password"
            id="register-password-error"
            class="field__hint"
            role="alert"
          >
            <li>{{ errors.password }}</li>
          </ul>
          <p class="field__help">Mínimo 8 caracteres con mayúscula, minúscula y número.</p>
        </div>

        <button type="submit" class="btn btn--primary auth-card__submit" :disabled="loading">
          <LoadingSpinner v-if="loading" label="Creando cuenta…" />
          <span v-else>Registrarse</span>
        </button>
      </form>

      <p class="auth-card__footer">
        ¿Ya tienes cuenta?
        <RouterLink to="/login">Inicia sesión</RouterLink>
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

.field__hint {
  margin: 0;
  padding-left: 1rem;
  color: var(--danger-color);
  font-size: 0.85rem;
}

.field__help {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.auth-card__footer {
  margin: 1.25rem 0 0;
  text-align: center;
  color: var(--text-muted);
}
</style>