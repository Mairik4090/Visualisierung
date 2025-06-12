import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Timeline from '@/components/Timeline.vue';

describe('Timeline', () => {
  it('renders svg with bars', () => {
    const wrapper = mount(Timeline, {
      props: {
        nodes: [
          { id: 'a', name: 'A', year: 2000 },
          { id: 'b', name: 'B', year: 2000 },
          { id: 'c', name: 'C', year: 2001 },
        ],
      },
    });

    expect(wrapper.find('svg').exists()).toBe(true);
    // at least one bar should be drawn
    expect(wrapper.findAll('rect').length).toBeGreaterThan(0);
  });
});
