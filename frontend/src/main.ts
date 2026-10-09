import { createPinia } from 'pinia';
import { createApp } from 'vue';

import { setSessionExpiredHandler } from '@/api/http';
import router from '@/router';
import { useAuthStore } from '@/stores/auth';

import App from './App.vue';
import '@/styles/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Un 401 no renovable (refresh fallido) limpia la sesión y vuelve a /login
// conservando la ruta que se estaba visitando.
setSessionExpiredHandler(() => {
  const auth = useAuthStore(pinia);
  auth.clearSession();
  const current = router.currentRoute.value;
  const safe = current.name !== 'login' && current.name !== 'register';
  if (current.meta.requiresAuth === true && safe) {
    void router.push({ name: 'login', query: { redirect: current.fullPath } });
  }
});

app.mount('#app');