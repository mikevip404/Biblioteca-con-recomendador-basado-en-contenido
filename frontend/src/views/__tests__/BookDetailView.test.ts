import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Router } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { booksApi } from '@/api/booksApi';
import { favoritesApi } from '@/api/favoritesApi';
import { ratingsApi } from '@/api/ratingsApi';
import BookDetailView from '@/views/BookDetailView.vue';
import { ApiError } from '@/types';
import type { BookDTO, Paginated, RatingWithUserDTO } from '@/types';

vi.mock('@/api/booksApi', () => ({
  booksApi: { list: vi.fn(), getById: vi.fn() }
}));

vi.mock('@/api/ratingsApi', () => ({
  ratingsApi: {
    putMine: vi.fn(),
    deleteMine: vi.fn(),
    listByBook: vi.fn(),
    listMine: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('@/api/favoritesApi', () => ({
  favoritesApi: { add: vi.fn(), remove: vi.fn(), listMine: vi.fn() }
}));

function book(id: string, title: string, overrides: Partial<BookDTO> = {}): BookDTO {
  return {
    id,
    title,
    author: { id: 'a1', name: 'Julio Cortázar' },
    genres: [],
    tags: [],
    createdBy: 'u1',
    averageRating: 4.5,
    ratingCount: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

function ratingOf(id: string, userName: string, value: number): RatingWithUserDTO {
  return {
    id,
    value,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    user: { id: `u-${id}`, name: userName }
  };
}

function pageOf<T>(items: T[], overrides: Partial<Paginated<T>> = {}): Paginated<T> {
  return {
    data: items,
    total: items.length,
    page: 1,
    limit: 10,
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
  return mount(BookDetailView, {
    global: { plugins: [pinia, router] }
  });
}

describe('BookDetailView', () => {
  let router: Router;

  beforeEach(async () => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(booksApi.getById).mockResolvedValue(book('b1', 'Rayuela'));
    vi.mocked(ratingsApi.listByBook).mockResolvedValue(pageOf([]));
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/books/:id', name: 'book-detail', component: BookDetailView },
        { path: '/books', component: { template: '<div />' }, name: 'books' },
        { path: '/:pathMatch(.*)*', component: { template: '<div />' }, name: 'not-found' }
      ]
    });
    await router.push('/books/b1');
    await router.isReady();
  });

  it('muestra el esqueleto mientras carga el detalle', async () => {
    const pending = deferred<BookDTO>();
    vi.mocked(booksApi.getById).mockReturnValue(pending.promise);

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.book-detail__skeleton').exists()).toBe(true);

    pending.resolve(book('b1', 'Rayuela'));
    await flushPromises();

    expect(wrapper.find('.book-detail__skeleton').exists()).toBe(false);
    expect(wrapper.find('.book-detail__title').text()).toBe('Rayuela');
    wrapper.unmount();
  });

  it('renderiza los datos del libro', async () => {
    vi.mocked(booksApi.getById).mockResolvedValue(
      book('b1', 'Rayuela', {
        description: 'Una novela para armar.',
        genres: [{ id: 'g1', name: 'Novela', slug: 'novela' }],
        tags: ['clásico'],
        publishedYear: 1963,
        pages: 256,
        language: 'es'
      })
    );

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.book-detail__title').text()).toBe('Rayuela');
    expect(wrapper.text()).toContain('Julio Cortázar');
    expect(wrapper.text()).toContain('Una novela para armar.');
    expect(wrapper.text()).toContain('1963');
    expect(wrapper.text()).toContain('256 págs.');
    expect(wrapper.text()).toContain('ES');
    expect(wrapper.text()).toContain('Novela');
    expect(wrapper.text()).toContain('#clásico');
    expect(wrapper.text()).toContain('2 valoraciones');
    wrapper.unmount();
  });

  it('muestra el error y reintenta la carga', async () => {
    vi.mocked(booksApi.getById).mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL', 'Servidor caído')
    );

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.error-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Servidor caído');

    await wrapper.find('.error-state .btn--secondary').trigger('click');
    await flushPromises();

    expect(wrapper.find('.error-state').exists()).toBe(false);
    expect(wrapper.find('.book-detail__title').text()).toBe('Rayuela');
    wrapper.unmount();
  });

  it('lista las valoraciones de otros usuarios', async () => {
    vi.mocked(ratingsApi.listByBook).mockResolvedValue(
      pageOf([ratingOf('r1', 'Lectora', 5), ratingOf('r2', 'Crítico', 3)])
    );

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.text()).toContain('Lectora');
    expect(wrapper.text()).toContain('Crítico');
    expect(wrapper.find('.rating-list__item').exists()).toBe(true);
    wrapper.unmount();
  });

  it('alterna el favorito actualizando el botón', async () => {
    vi.mocked(booksApi.getById).mockResolvedValue(book('b1', 'Rayuela', { isFavorite: false }));
    vi.mocked(favoritesApi.add).mockResolvedValue({ bookId: 'b1', isFavorite: true });

    const wrapper = mountView(router);
    await flushPromises();

    const before = wrapper.find('.book-detail__favorite');
    expect(before.text()).toContain('Añadir a favoritos');
    expect(before.attributes('aria-pressed')).toBe('false');

    await before.trigger('click');
    await flushPromises();

    expect(favoritesApi.add).toHaveBeenCalledWith('b1');
    const after = wrapper.find('.book-detail__favorite');
    expect(after.text()).toContain('En favoritos');
    expect(after.attributes('aria-pressed')).toBe('true');
    wrapper.unmount();
  });
});
