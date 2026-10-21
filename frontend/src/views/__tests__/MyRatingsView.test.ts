import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Router } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ratingsApi } from '@/api/ratingsApi';
import MyRatingsView from '@/views/MyRatingsView.vue';
import { ApiError } from '@/types';
import type { Paginated, RatingWithBookDTO } from '@/types';

vi.mock('@/api/ratingsApi', () => ({
  ratingsApi: {
    putMine: vi.fn(),
    deleteMine: vi.fn(),
    listByBook: vi.fn(),
    listMine: vi.fn(),
    remove: vi.fn()
  }
}));

function rating(id: string, bookId: string, title: string, value: number, comment: string): RatingWithBookDTO {
  const dto: RatingWithBookDTO = {
    id,
    value,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    book: { id: bookId, title, averageRating: value }
  };
  if (comment !== '') dto.comment = comment;
  return dto;
}

function pageOf(
  items: RatingWithBookDTO[],
  overrides: Partial<Paginated<RatingWithBookDTO>> = {}
): Paginated<RatingWithBookDTO> {
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
  return mount(MyRatingsView, {
    global: { plugins: [pinia, router] }
  });
}

describe('MyRatingsView', () => {
  let router: Router;

  beforeEach(async () => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(ratingsApi.listMine).mockResolvedValue(pageOf([]));
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/me/ratings', name: 'my-ratings', component: MyRatingsView },
        { path: '/books/:id', component: { template: '<div />' }, name: 'book-detail' },
        { path: '/:pathMatch(.*)*', component: { template: '<div />' }, name: 'not-found' }
      ]
    });
    await router.push('/me/ratings');
    await router.isReady();
  });

  it('muestra el esqueleto mientras carga', async () => {
    const pending = deferred<Paginated<RatingWithBookDTO>>();
    vi.mocked(ratingsApi.listMine).mockReturnValue(pending.promise);

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.skeleton-card').exists()).toBe(true);

    pending.resolve(pageOf([rating('r1', 'b1', 'Rayuela', 5, '')]));
    await flushPromises();

    expect(wrapper.find('.skeleton-card').exists()).toBe(false);
    expect(wrapper.find('.rating-row').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renderiza mis valoraciones', async () => {
    vi.mocked(ratingsApi.listMine).mockResolvedValue(
      pageOf([
        rating('r1', 'b1', 'Rayuela', 5, 'Una obra maestra'),
        rating('r2', 'b2', 'Ficciones', 4, '')
      ])
    );

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.text()).toContain('Rayuela');
    expect(wrapper.text()).toContain('Ficciones');
    expect(wrapper.text()).toContain('Una obra maestra');
    expect(wrapper.findAll('.rating-row')).toHaveLength(2);
    wrapper.unmount();
  });

  it('muestra el estado vacío sin valoraciones', async () => {
    vi.mocked(ratingsApi.listMine).mockResolvedValue(pageOf([]));

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.text()).toContain('Todavía no has valorado ningún libro');
    expect(wrapper.find('.rating-row').exists()).toBe(false);
    wrapper.unmount();
  });

  it('muestra el error y reintenta la carga', async () => {
    vi.mocked(ratingsApi.listMine).mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL', 'Servidor caído')
    );
    vi.mocked(ratingsApi.listMine).mockResolvedValueOnce(
      pageOf([rating('r1', 'b1', 'Rayuela', 5, '')])
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
    vi.mocked(ratingsApi.listMine).mockResolvedValue(
      pageOf([rating('r1', 'b1', 'Rayuela', 5, '')], { total: 21, totalPages: 2 })
    );

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.find('.pagination-bar').exists()).toBe(true);

    await wrapper.find('[aria-label="Página siguiente"]').trigger('click');
    await flushPromises();

    const calls = vi.mocked(ratingsApi.listMine).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]?.[0]).toBe(2);
    wrapper.unmount();
  });

  it('elimina una valoración de la lista', async () => {
    vi.mocked(ratingsApi.listMine).mockResolvedValue(
      pageOf([rating('r1', 'b1', 'Rayuela', 5, '')])
    );
    vi.mocked(ratingsApi.remove).mockResolvedValue(undefined);

    const wrapper = mountView(router);
    await flushPromises();

    expect(wrapper.findAll('.rating-row')).toHaveLength(1);

    await wrapper.find('.rating-row__actions .btn--ghost').trigger('click');
    await flushPromises();

    expect(ratingsApi.remove).toHaveBeenCalledWith('r1');
    expect(wrapper.findAll('.rating-row')).toHaveLength(0);
    expect(wrapper.text()).toContain('Todavía no has valorado ningún libro');
    wrapper.unmount();
  });

  it('edita una valoración y la guarda', async () => {
    vi.mocked(ratingsApi.listMine).mockResolvedValue(
      pageOf([rating('r1', 'b1', 'Rayuela', 3, 'Regular')])
    );
    vi.mocked(ratingsApi.putMine).mockResolvedValue({
      id: 'r1',
      value: 5,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z'
    });

    const wrapper = mountView(router);
    await flushPromises();

    await wrapper.find('.rating-row__actions .btn--secondary').trigger('click');
    await flushPromises();

    const stars = wrapper.findAll('.rating-row__editor .star-rating__button');
    await stars[4]?.trigger('click');
    await flushPromises();

    // Se vacía el comentario para comprobar que también se edita.
    await wrapper.find('.rating-row__editor textarea').setValue('');
    await wrapper.find('.rating-row__editor .btn--primary').trigger('click');
    await flushPromises();

    expect(ratingsApi.putMine).toHaveBeenCalledWith('b1', { value: 5 });
    expect(wrapper.find('.rating-row__editor').exists()).toBe(false);
    wrapper.unmount();
  });
});
