import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import StarRating from '@/components/StarRating.vue';

describe('StarRating', () => {
  it('expone la valoración en el aria-label', () => {
    const wrapper = mount(StarRating, { props: { rating: 3.5 } });

    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('3.5 de 5 estrellas');
  });

  it('aplica el relleno proporcional a la valoración', () => {
    const wrapper = mount(StarRating, { props: { rating: 2.5 } });

    const fill = wrapper.find('.star-rating__fill');
    expect(fill.attributes('style')).toContain('width: 50%');
    expect(wrapper.findAll('.star-rating__star')).toHaveLength(10);
  });

  it('respeta el máximo cuando las estrellas no son 5', () => {
    const wrapper = mount(StarRating, { props: { rating: 1, max: 3 } });

    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('1 de 3 estrellas');
    expect(wrapper.findAll('.star-rating__star')).toHaveLength(6);
  });

  it('clampa la valoración fuera de rango', () => {
    const wrapper = mount(StarRating, { props: { rating: 7 } });

    const fill = wrapper.find('.star-rating__fill');
    expect(fill.attributes('style')).toContain('width: 100%');
  });
});