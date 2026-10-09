<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ page: number; totalPages: number }>();
const emit = defineEmits<{ (event: 'change', page: number): void }>();

/** Páginas a mostrar (números o elipsis) alrededor del número actual. */
const items = computed<Array<number | 'ellipsis'>>(() => {
  const total = Math.max(1, props.totalPages);
  const current = Math.min(Math.max(1, props.page), total);

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...wanted].sort((a, b) => a - b);
  const list: Array<number | 'ellipsis'> = [];

  let previous: number | undefined;
  for (const page of sorted) {
    if (page < 1 || page > total) continue;
    if (previous !== undefined && page - previous > 1) {
      list.push('ellipsis');
    }
    list.push(page);
    previous = page;
  }
  return list;
});

function selectPage(page: number): void {
  const { totalPages } = props;
  if (page < 1 || page > totalPages) return;
  emit('change', page);
}
</script>

<template>
  <nav
    class="pagination-bar"
    :aria-label="`Página ${page} de ${totalPages}`"
  >
    <button
      type="button"
      class="btn btn--secondary pagination-bar__nav"
      :disabled="page <= 1"
      aria-label="Página anterior"
      @click="selectPage(page - 1)"
    >
      &lsaquo; Anterior
    </button>

    <ul v-if="items.length > 0" class="pagination-bar__list">
      <li
        v-for="(item, index) in items"
        :key="typeof item === 'number' ? `page-${item}` : `ellipsis-${index}`"
      >
        <button
          v-if="typeof item === 'number'"
          type="button"
          class="pagination-bar__item"
          :class="{ 'pagination-bar__item--active': item === page }"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="`Ir a la página ${item}`"
          @click="selectPage(item)"
        >
          {{ item }}
        </button>
        <span v-else class="pagination-bar__ellipsis" aria-hidden="true">…</span>
      </li>
    </ul>

    <button
      type="button"
      class="btn btn--secondary pagination-bar__nav"
      :disabled="page >= totalPages || totalPages === 0"
      aria-label="Página siguiente"
      @click="selectPage(page + 1)"
    >
      Siguiente &rsaquo;
    </button>
  </nav>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pagination-bar__nav {
  padding: 0.4rem 0.8rem;
}

.pagination-bar__list {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pagination-bar__item {
  min-width: 2.25rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
}

.pagination-bar__item:hover:not(:disabled) {
  background: var(--accent-soft);
}

.pagination-bar__item--active {
  border-color: var(--accent-color);
  background: var(--accent-color);
  color: var(--accent-contrast);
  font-weight: 600;
}

.pagination-bar__item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pagination-bar__ellipsis {
  padding: 0 0.25rem;
  color: var(--text-muted);
}
</style>