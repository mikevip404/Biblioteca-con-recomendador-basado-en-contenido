<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ rating: number; max?: number }>(), {
  max: 5
});

/** Ancho del relleno: fracción de la valoración sobre el máximo. */
const fillPercent = computed(() => {
  const clamped = Math.min(Math.max(props.rating, 0), props.max);
  return (clamped / props.max) * 100;
});

const label = computed(() => {
  const value = Math.round(props.rating * 10) / 10;
  const stars = props.max === 1 ? 'estrella' : 'estrellas';
  return `${value} de ${props.max} ${stars}`;
});

/** Estrellas de la fila (íconos estáticos, el relleno se recorta con CSS). */
const stars = computed(() => Array.from({ length: props.max }, (_, index) => index));
</script>

<template>
  <span class="star-rating" role="img" :aria-label="label">
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
</style>