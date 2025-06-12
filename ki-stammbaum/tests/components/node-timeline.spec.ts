import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NodeTimeline from '@/components/NodeTimeline.vue';

const concept = {
  id: 'c1',
  name: 'Test',
  year: 2000,
  description: '',
  dependencies: [],
};

describe('NodeTimeline', () => {
  it('renders svg when concept is provided', () => {
    const wrapper = mount(NodeTimeline, {
      props: { concept },
    });
    expect(wrapper.find('svg').exists()).toBe(true);
  });
});
