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

  it('renders nodes as circles with labels', () => {
    const wrapper = mount(KiStammbaum, {
      props: {
        nodes: [
          { id: 'a', name: 'Node A', year: 1950 },
          { id: 'b', name: 'Node B', year: 1960 },
        ],
        links: [],
      },
    });

    const circles = wrapper.findAll('circle');
    expect(circles).toHaveLength(2);

    const labels = wrapper.findAll('text');
    // first two text elements are labels since last one may be loading text
    const labelTexts = labels.map((t) => t.text()).filter((t) => t !== 'Visualisierung lädt...');
    expect(labelTexts).toContain('Node A');
    expect(labelTexts).toContain('Node B');
  });
});
