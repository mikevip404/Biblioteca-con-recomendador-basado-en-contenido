import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

import { authGuard } from './guards';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guest: true, title: 'Iniciar sesión' }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guest: true, title: 'Crear cuenta' }
  },
  {
    path: '/books',
    name: 'books',
    component: () => import('@/views/BooksView.vue'),
    meta: { requiresAuth: true, title: 'Catálogo' }
  },
  {
    path: '/books/:id',
    name: 'book-detail',
    component: () => import('@/views/BookDetailView.vue'),
    meta: { requiresAuth: true, title: 'Detalle del libro' }
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('@/views/FavoritesView.vue'),
    meta: { requiresAuth: true, title: 'Mis favoritos' }
  },
  {
    path: '/me/ratings',
    name: 'my-ratings',
    component: () => import('@/views/MyRatingsView.vue'),
    meta: { requiresAuth: true, title: 'Mis valoraciones' }
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { title: 'Acceso denegado' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Página no encontrada' }
  },
  {
    path: '/',
    redirect: () => ({ name: 'books' })
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

router.beforeEach(authGuard);

router.afterEach((to) => {
  const title = to.meta.title;
  document.title = title === undefined ? 'Biblioteca' : `${title} · Biblioteca`;
});

export default router;
