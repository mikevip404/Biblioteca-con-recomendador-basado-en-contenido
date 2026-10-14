<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
</script>

<template>
  <div class="default-layout app-shell">
    <AppHeader />
    <main id="main-content" class="app-main">
      <slot />
    </main>
  </div>
</template>
