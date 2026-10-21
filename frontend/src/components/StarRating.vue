<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Valor mostrado en modo solo lectura. */
    rating?: number;
    /** Número total de estrellas. */
    max?: number;
    /** Valor interactivo (v-model). */
    modelValue?: number | null;
    /** Activa el modo interactivo (ratón y teclado). */
    interactive?: boolean;
    /** Deshabilita la interacción (solo en modo interactivo). */
    disabled?: boolean | undefined;
    /** Nombre accesible del grupo de estrellas. */
    label?: string;
  }>(),
  {
    rating: 0,
    max: 5,
    modelValue: null,
    interactive: false,
    disabled: false,
    label: 'Valoración'
  }
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: number): void;
  (event: 'change', value: number): void;
}>();

/** Estrellas de la fila, numeradas de 1 a `max`. */
const stars = computed(() => Array.from({ length: props.max }, (_, index) => index + 1));

const dashes = computed(() => (props.max === 1 ? 'estrella' : 'estrellas'));

const selected = computed(() => {
  const value = props.modelValue ?? 0;
  return Math.min(Math.max(value, 0), props.max);
});

/** Previsualización al pasar el ratón (solo interactivo). */
const hoverValue = ref<number | null>(null);

const displayValue = computed(() => {
  if (props.interactive) {
    const value = hoverValue.value ?? selected.value;
    return Math.min(Math.max(value, 0), props.max);
  }
  return Math.min(Math.max(props.rating, 0), props.max);
});

/** Ancho del relleno: fracción de la valoración mostrada sobre el máximo. */
const fillPercent = computed(() => (displayValue.value / props.max) * 100);

const readonlyLabel = computed(() => {
  const value = Math.round(props.rating * 10) / 10;
  return `${value} de ${props.max} ${dashes.value}`;
});

const groupLabel = computed(
  () => `${props.label}, ${selected.value} de ${props.max} ${dashes.value}`
);

function select(value: number): void {
  if (!props.interactive || props.disabled) return;
  const clamped = Math.min(Math.max(value, 1), props.max);
  if (clamped === selected.value) return;
  emit('update:modelValue', clamped);
  emit('change', clamped);
}

function onMouseEnter(value: number): void {
  if (!props.interactive || props.disabled) return;
  hoverValue.value = value;
}

function onMouseLeave(): void {
  hoverValue.value = null;
}

function onFocus(value: number): void {
  if (!props.interactive || props.disabled) return;
  hoverValue.value = value;
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.interactive || props.disabled) return;
  const current = selected.value;
  let next: number | null = null;
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      next = Math.min(props.max, current + 1);
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      next = Math.max(1, current - 1);
      break;
    case 'Home':
      next = 1;
      break;
    case 'End':
      next = props.max;
      break;
    default:
      return;
  }
  event.preventDefault();
  select(next);
}
</script>

<template>
  <span v-if="!interactive" class="star-rating" role="img" :aria-label="readonlyLabel">
    <span class="star-rating__stars" aria-hidden="true">
      <svg
        v-for="star in stars"
        :key="star"
        class="star-rating__star"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        focusable="false"
      >
        <path
          d="M12 2.5l2.9 6.2 6.6.9-4.8 4.6 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6-4.8-4.6 6.6-.9z"
        />
      </svg>
      <span class="star-rating__fill" :style="{ width: fillPercent + '%' }">
        <svg
          v-for="star in stars"
          :key="star"
          class="star-rating__star"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          focusable="false"
        >
          <path
            d="M12 2.5l2.9 6.2 6.6.9-4.8 4.6 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6-4.8-4.6 6.6-.9z"
          />
        </svg>
      </span>
    </span>
  </span>

  <span
    v-else
    class="star-rating star-rating--interactive"
    :class="{ 'star-rating--disabled': disabled }"
    role="radiogroup"
    :aria-label="groupLabel"
    @keydown="onKeydown"
    @mouseleave="onMouseLeave"
  >
    <span class="star-rating__stars">
      <span class="star-rating__fill" :style="{ width: fillPercent + '%' }" aria-hidden="true">
        <svg
          v-for="star in stars"
          :key="star"
          class="star-rating__star"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          focusable="false"
        >
          <path
            d="M12 2.5l2.9 6.2 6.6.9-4.8 4.6 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6-4.8-4.6 6.6-.9z"
          />
        </svg>
      </span>
      <button
        v-for="star in stars"
        :key="star"
        type="button"
        class="star-rating__button"
        role="radio"
        :aria-checked="star === selected"
        :aria-label="`${star} de ${max} ${dashes}`"
        :tabindex="star === (selected === 0 ? 1 : selected) ? 0 : -1"
        :disabled="disabled"
        @click="select(star)"
        @mouseenter="onMouseEnter(star)"
        @focus="onFocus(star)"
      >
        <svg
          class="star-rating__star"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          focusable="false"
        >
          <path
            d="M12 2.5l2.9 6.2 6.6.9-4.8 4.6 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6-4.8-4.6 6.6-.9z"
          />
        </svg>
      </button>
    </span>
  </span>
</template>

<style scoped>
.star-rating {
  display: inline-flex;
  align-items: center;
}

.star-rating__stars {
  position: relative;
  display: inline-flex;
  line-height: 0;
}

.star-rating__star path {
  fill: var(--star-empty);
}

.star-rating__fill {
  position: absolute;
  inset: 0 auto 0 0;
  overflow: hidden;
  display: inline-flex;
  /* Las estrellas interiores no deben ocupar ancho real: solo visualizan el relleno. */
  width: 0;
  height: 100%;
}

.star-rating__fill .star-rating__star path {
  fill: var(--star-filled);
}

.star-rating--interactive .star-rating__button {
  display: inline-flex;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 0;
  cursor: pointer;
}

.star-rating--interactive .star-rating__button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.star-rating--disabled .star-rating__button {
  cursor: not-allowed;
}
</style>
