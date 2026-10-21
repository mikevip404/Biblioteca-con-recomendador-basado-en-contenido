import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Router } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { favoritesApi } from '@/api/favoritesApi';
import FavoritesView from '@/views/FavoritesView.vue';
import { ApiError } from '@/types';
import type { FavoriteDTO, Paginated } from '@/types';

vi.mock('@/api/favoritesApi', () => ({
  favoritesApi: { add: vi.fn(), remove: vi.fn(), listMine: vi.fn() }
}));

function favorite(id: string, bookId: string, title: string): FavoriteDTO {
  return {
    id,
    createdAt: '2024-01-01T00:00:00.000Z',
    book: { id: bookId, title, averageRating: 4.5 }
  };
}

function pageOf(items: FavoriteDTO[], overrides: Partial<Paginated<FavoriteDTO>> = {}): Paginated<FavoriteDTO> {
  return {
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    ...overrides
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mountView(router: Router): ReturnType<typeof mount> {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(FavoritesView, {
    global: { plugins: [pinia, router] }
  });
}

describe('FavoritesView', () => {
  let router: Router;

  beforeEach(async () => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(favoritesApi.listMine).mockResolvedValue(pageOf([]));
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/favorites', name: 'favorites', component: FavoritesView },
        { path: '/books/:id', component: { template: '<div />' }, name: 'book-detail' },
        { path: '/:pathMatch(.*)*', component: { template: '<div />' }, name: 'not-found' }
      ]
    });
    await router.push('/favorites');
    await router.isReady();
  });

  it('muestra el esqueleto mientras carga', async () => {
    const pending = deferred<Paginated<FavoriteDTO>>();
    vi.mocked(favoritesApi.listMine).mockReturnValue(pending.promise);

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.skeleton-card').exists()).toBe(true);

    pending.resolve(pageOf([favorite('f1', 'b1', 'Rayuela')]));
    await flushPromises();

    expect(wrapper.find('.skeleton-card').exists()).toBe(false);
    expect(wrapper.find('.favorite-card').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renderiza el listado de favoritos', async () => {
    vi.mocked(favoritesApi.listMine).mockResolvedValue(
      pageOf([favorite('f1', 'b1', 'Rayuela'), favorite('f2', 'b2', 'Ficciones')])
    );

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.text()).toContain('Rayuela');
    expect(wrapper.text()).toContain('Ficciones');
    expect(wrapper.findAll('.favorite-card')).toHaveLength(2);
    wrapper.unmount();
  });

  it('muestra el estado vacío sin favoritos', async () => {
    vi.mocked(favoritesApi.listMine).mockResolvedValue(pageOf([]));

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.text()).toContain('Aún no tienes favoritos');
    expect(wrapper.find('.favorite-card').exists()).toBe(false);
    wrapper.unmount();
  });

  it('muestra el error y reintenta la carga', async () => {
    vi.mocked(favoritesApi.listMine).mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL', 'Servidor caído')
    );
    vi.mocked(favoritesApi.listMine).mockResolvedValueOnce(
      pageOf([favorite('f1', 'b1', 'Rayuela')])
    );

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.error-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Servidor caído');

    await wrapper.find('.error-state .btn--secondary').trigger('click');
    await flushPromises();

    expect(wrapper.find('.error-state').exists()).toBe(false);
    expect(wrapper.text()).toContain('Rayuela');
    wrapper.unmount();
  });

  it('cambia de página desde la paginación', async () => {
    vi.mocked(favoritesApi.listMine).mockResolvedValue(
      pageOf([favorite('f1', 'b1', 'Rayuela')], { total: 21, totalPages: 2 })
    );

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.pagination-bar').exists()).toBe(true);

    await wrapper.find('[aria-label="Página siguiente"]').trigger('click');
    await flushPromises();

    const calls = vi.mocked(favoritesApi.listMine).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]?.[0]).toBe(2);
    wrapper.unmount();
  });

  it('quita un favorito de la lista', async () => {
    vi.mocked(favoritesApi.listMine).mockResolvedValue(
      pageOf([favorite('f1', 'b1', 'Rayuela')])
    );
    vi.mocked(favoritesApi.remove).mockResolvedValue({ bookId: 'b1', isFavorite: false });

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.findAll('.favorite-card')).toHaveLength(1);

    await wrapper.find('.favorite-card__remove').trigger('click');
    await flushPromises();

    expect(favoritesApi.remove).toHaveBeenCalledWith('b1');
    expect(wrapper.findAll('.favorite-card')).toHaveLength(0);
    wrapper.unmount();
  });
});
