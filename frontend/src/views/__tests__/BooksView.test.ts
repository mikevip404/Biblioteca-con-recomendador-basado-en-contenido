import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Router } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { booksApi } from '@/api/booksApi';
import BooksView from '@/views/BooksView.vue';
import { ApiError } from '@/types';
import type { BookDTO, BookPage } from '@/types';

vi.mock('@/api/booksApi', () => ({
  booksApi: { list: vi.fn(), getById: vi.fn() }
}));

vi.mock('@/api/authorsApi', () => ({
  authorsApi: { list: vi.fn(), getById: vi.fn() }
}));

vi.mock('@/api/genresApi', () => ({
  genresApi: { list: vi.fn(), getById: vi.fn() }
}));

const mockedList = vi.mocked(booksApi.list);

function book(id: string, title: string): BookDTO {
  return {
    id,
    title,
    author: { id: 'a1', name: 'Autor Prueba' },
    genres: [],
    tags: [],
    createdBy: 'u1',
    averageRating: 4.5,
    ratingCount: 2,
    publishedYear: 2020,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };
}

function pageOf(...items: BookDTO[]): BookPage {
  return {
    data: items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: 1
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T | Promise<T>) => void } {
  let resolve!: (value: T | Promise<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mountView(router: Router): ReturnType<typeof mount> {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(BooksView, {
    global: { plugins: [pinia, router] }
  });
}

describe('BooksView', () => {
  let router: Router;

  beforeEach(async () => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(booksApi.list).mockResolvedValue(pageOf());
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/books', component: BooksView, name: 'books' },
        { path: '/books/:id', component: { template: '<div />' }, name: 'book-detail' },
        { path: '/:pathMatch(.*)*', component: { template: '<div />' }, name: 'not-found' }
      ]
    });
    await router.push('/books');
    await router.isReady();
  });

  it('muestra el esqueleto mientras carga la primera página', async () => {
    const pending = deferred<BookPage>();
    mockedList.mockReturnValue(pending.promise);

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.skeleton-card').exists()).toBe(true);

    pending.resolve(pageOf(book('b1', 'Don Quijote')));
    await flushPromises();

    expect(wrapper.find('.book-card').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renderiza el listado de libros y el contador', async () => {
    mockedList.mockResolvedValue(pageOf(book('b1', 'Don Quijote'), book('b2', 'Cien años de soledad')));

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.text()).toContain('Don Quijote');
    expect(wrapper.text()).toContain('Cien años de soledad');
    expect(wrapper.text()).toContain('2 libros');
    expect(wrapper.find('.book-card').exists()).toBe(true);
    wrapper.unmount();
  });

  it('muestra estado vacío cuando la página no trae libros', async () => {
    mockedList.mockResolvedValue(pageOf());

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.text()).toContain('No hay libros con estos filtros');
    expect(wrapper.find('.book-card').exists()).toBe(false);
    wrapper.unmount();
  });

  it('muestra el error y reintenta la carga con el botón', async () => {
    mockedList.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'Servidor caído'));
    mockedList.mockResolvedValueOnce(pageOf(book('b1', 'Rayuela')));

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.error-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Servidor caído');

    await wrapper.find('.btn--secondary').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Rayuela');
    expect(wrapper.find('.error-state').exists()).toBe(false);
    wrapper.unmount();
  });
});