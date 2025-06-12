import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import KiStammbaum from '@/components/KiStammbaum.vue';

describe('KiStammbaum', () => {
  it('renders heading and svg element', () => {
    const wrapper = mount(KiStammbaum, {
      props: { nodes: [], links: [] },
    });
    expect(wrapper.find('h2').text()).toBe('KI-Stammbaum Visualisierung');
    expect(wrapper.find('svg').exists()).toBe(true);
  });
});
