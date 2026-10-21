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

describe('StarRating interactivo', () => {
  function mountInteractive(modelValue: number | null, disabled = false): ReturnType<typeof mount> {
    return mount(StarRating, { props: { modelValue, interactive: true, disabled } });
  }

  it('expone las estrellas como un radiogroup con etiquetas accesibles', () => {
    const wrapper = mountInteractive(3);

    const group = wrapper.find('[role="radiogroup"]');
    expect(group.attributes('aria-label')).toBe('Valoración, 3 de 5 estrellas');

    const radios = wrapper.findAll('[role="radio"]');
    expect(radios).toHaveLength(5);
    expect(radios[0]?.attributes('aria-label')).toBe('1 de 5 estrellas');
    expect(radios[2]?.attributes('aria-checked')).toBe('true');
    expect(radios[3]?.attributes('aria-checked')).toBe('false');
  });

  it('emite la estrella elegida al hacer clic', async () => {
    const wrapper = mountInteractive(0);

    const radios = wrapper.findAll('[role="radio"]');
    await radios[3]?.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([4]);
    expect(wrapper.emitted('change')?.[0]).toEqual([4]);
  });

  it('navega y selecciona con el teclado', async () => {
    const wrapper = mountInteractive(0);
    const group = wrapper.find('[role="radiogroup"]');

    // El componente es controlado (v-model): el padre refleja cada cambio.
    await group.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([1]);

    await wrapper.setProps({ modelValue: 1 });
    await group.trigger('keydown', { key: 'End' });
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([5]);

    await wrapper.setProps({ modelValue: 5 });
    await group.trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.emitted('update:modelValue')?.[2]).toEqual([4]);

    await wrapper.setProps({ modelValue: 4 });
    await group.trigger('keydown', { key: 'Home' });
    expect(wrapper.emitted('update:modelValue')?.[3]).toEqual([1]);
  });

  it('no emite nada cuando está deshabilitado', async () => {
    const wrapper = mountInteractive(2, true);

    const radios = wrapper.findAll('[role="radio"]');
    await radios[4]?.trigger('click');
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(radios[4]?.attributes('disabled')).toBeDefined();
  });
});
