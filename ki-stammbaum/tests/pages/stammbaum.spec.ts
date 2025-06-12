import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import Page from '@/pages/stammbaum.vue';

// Mock data composable to provide deterministic concepts
vi.mock('@/composables/useStammbaumData', () => ({
  useStammbaumData: () => ({
    data: ref({
      nodes: [
        { id: 'a', name: 'A', year: 2000, description: '', dependencies: [] },
        { id: 'b', name: 'B', year: 2001, description: '', dependencies: [] },
      ],
    }),
    pending: ref(false),
    error: ref(null),
  }),
}));

const TimelineStub = {
  template: '<button data-test="bar" @click="$emit(\'yearSelected\', 2001)"></button>',
};
const ConceptDetailStub = {
  props: ['concept'],
  template: '<div class="detail" v-if="concept">{{ concept.name }}</div>',
};

describe('stammbaum page integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens concept when Timeline emits yearSelected with single node', async () => {
    const wrapper = mount(Page, {
      global: {
        stubs: {
          Timeline: TimelineStub,
          KiStammbaum: true,
          FilterControls: true,
          Legend: true,
          ConceptDetail: ConceptDetailStub,
        },
      },
    });

    await wrapper.find('[data-test="bar"]').trigger('click');

    expect(wrapper.find('.detail').text()).toBe('B');
  });
});
