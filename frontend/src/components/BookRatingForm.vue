<script setup lang="ts">
import { ref, watch } from 'vue';

import StarRating from '@/components/StarRating.vue';

const props = withDefaults(
  defineProps<{
    /** Mi valoración actual (0 = sin valorar). */
    value?: number;
    /** Comentario actual (opcional). */
    comment?: string;
    /** Hay una operación de guardado/borrado en curso. */
    saving?: boolean;
    /** Mostrar el botón de eliminar (solo si ya existe valoración). */
    canDelete?: boolean;
  }>(),
  {
    value: 0,
    comment: '',
    saving: false,
    canDelete: false
  }
);

const emit = defineEmits<{
  (event: 'save', value: number, comment: string): void;
  (event: 'delete'): void;
}>();

const localValue = ref(props.value);
const localComment = ref(props.comment);

watch(
  () => props.value,
  (value) => {
    localValue.value = value;
  }
);

watch(
  () => props.comment,
  (comment) => {
    localComment.value = comment;
  }
);

const MAX_COMMENT = 500;

function onSave(): void {
  if (localValue.value < 1 || props.saving) return;
  emit('save', localValue.value, localComment.value.trim());
}
</script>

<template>
  <form class="rating-form" @submit.prevent="onSave">
    <fieldset class="rating-form__fieldset" :disabled="saving">
      <legend class="rating-form__legend">Tu valoración</legend>

      <StarRating
        v-model="localValue"
        interactive
        :disabled="saving"
        label="Tu valoración"
      />

      <label class="rating-form__label" for="rating-comment">
        Comentario (opcional)
      </label>
      <textarea
        id="rating-comment"
        v-model="localComment"
        class="field__input rating-form__comment"
        name="comment"
        rows="3"
        :maxlength="MAX_COMMENT"
        placeholder="¿Qué te ha parecido?"
      ></textarea>
      <p class="field__help">{{ localComment.length }} / {{ MAX_COMMENT }}</p>

      <div class="rating-form__actions">
        <button
          type="submit"
          class="btn btn--primary"
          :disabled="saving || localValue < 1"
        >
          {{ canDelete ? 'Actualizar valoración' : 'Valorar' }}
        </button>
        <button
          v-if="canDelete"
          type="button"
          class="btn btn--secondary"
          :disabled="saving"
          @click="emit('delete')"
        >
          Eliminar mi valoración
        </button>
      </div>
    </fieldset>
  </form>
</template>

<style scoped>
.rating-form__fieldset {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.rating-form__legend {
  padding: 0 0.4rem;
  font-weight: 600;
}

.rating-form__label {
  font-weight: 500;
}

.rating-form__comment {
  resize: vertical;
}

.rating-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
