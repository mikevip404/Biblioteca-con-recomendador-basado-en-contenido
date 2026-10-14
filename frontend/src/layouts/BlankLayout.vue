<template>
  <div class="blank-layout">
    <main class="blank-layout__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.blank-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.blank-layout__main {
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
</style>
