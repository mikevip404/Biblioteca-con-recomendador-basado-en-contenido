<script setup lang="ts">
import { RouterView } from 'vue-router';

import AppHeader from '@/components/AppHeader.vue';
import ToastHost from '@/components/ToastHost.vue';
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main id="main-content" class="app-main">
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>
