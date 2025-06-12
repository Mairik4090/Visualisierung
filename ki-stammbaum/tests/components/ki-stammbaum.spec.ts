import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import KiStammbaum from '@/components/KiStammbaum.vue';

vi.mock('@/composables/useStammbaumData', () => {
  return {
    useStammbaumData: () => ({
      data: ref(null),
      pending: ref(true),
    }),
  };
});

describe('KiStammbaum', () => {
  it('renders heading and loading text', () => {
    const wrapper = mount(KiStammbaum);
    expect(wrapper.find('h2').text()).toBe('KI-Stammbaum Visualisierung');
    expect(wrapper.text()).toContain('Visualisierung lädt...');
  });
});
