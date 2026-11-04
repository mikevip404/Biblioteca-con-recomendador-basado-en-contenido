import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Router } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recommendationsApi } from '@/api/recommendationsApi';
import RecommendationsView from '@/views/RecommendationsView.vue';
import type { RecommendationSetDTO } from '@/types';

vi.mock('@/api/recommendationsApi', () => ({
  recommendationsApi: {
    getRecommendations: vi.fn(),
    getSimilar: vi.fn(),
    getGraph: vi.fn()
  }
}));

function recommendationSet(
  overrides: Partial<RecommendationSetDTO> = {}
): RecommendationSetDTO {
  return {
    strategy: 'content-based',
    data: [
      {
        book: {
          id: 'b2',
          title: 'Estación estelar',
          averageRating: 4.6,
          mainGenre: 'Ciencia ficción'
        },
        score: 0.82,
        reasons: [{ type: 'genre', label: 'Género: Ciencia ficción' }]
      }
    ],
    ...overrides
  };
}

async function mountView(): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recommendations', name: 'recommendations', component: RecommendationsView },
      {
        path: '/books/:id',
        name: 'book-detail',
        component: { template: '<div />' }
      }
    ]
  });
  await router.push('/recommendations');
  await router.isReady();
  const wrapper = mount(RecommendationsView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

describe('RecommendationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra las recomendaciones por contenido con motivos y afinidad', async () => {
    vi.mocked(recommendationsApi.getRecommendations).mockResolvedValue(recommendationSet());

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('Estación estelar');
    expect(wrapper.text()).toContain('Ciencia ficción');
    expect(wrapper.text()).toContain('82% afín');
    expect(wrapper.text()).toContain('Género: Ciencia ficción');
    wrapper.unmount();
  });

  it('avisa cuando se usa el respaldo por popularidad', async () => {
    vi.mocked(recommendationsApi.getRecommendations).mockResolvedValue(
      recommendationSet({ strategy: 'popular' })
    );

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('libros mejor valorados');
    wrapper.unmount();
  });

  it('muestra un estado vacío si no hay resultados', async () => {
    vi.mocked(recommendationsApi.getRecommendations).mockResolvedValue(
      recommendationSet({ data: [] })
    );

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('Todavía no hay recomendaciones');
    wrapper.unmount();
  });
});
