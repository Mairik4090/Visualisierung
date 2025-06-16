import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { ref } from 'vue'; // Removed computed
import StammbaumPage from '@/pages/StammbaumPage.vue';
import FilterControls from '@/components/FilterControls.vue'; // To emit events
import KiStammbaum from '@/components/KiStammbaum.vue'; // To check props
import type { Node, Link, Concept } from '@/types/concept'; // Import Concept

// Mock data for useStammbaumData
const mockNodes: Concept[] = [
  // Changed Node[] to Concept[]
  {
    id: 'n1',
    name: 'Node 1',
    year: 1990,
    category: 'algorithm',
    description: 'Desc 1',
    dependencies: ['n2'],
  },
  {
    id: 'n2',
    name: 'Node 2',
    year: 1995,
    category: 'concept',
    description: 'Desc 2',
    dependencies: [],
  },
  {
    id: 'n3',
    name: 'Node 3',
    year: 2000,
    category: 'algorithm',
    description: 'Desc 3',
    dependencies: [],
  },
  {
    id: 'n4',
    name: 'Node 4',
    year: 2005,
    category: 'technology',
    description: 'Desc 4',
    dependencies: ['n1'],
  },
  {
    id: 'n5',
    name: 'Node 5',
    year: 2010,
    category: 'concept',
    description: 'Desc 5',
    dependencies: [],
  },
];

// Mock the composable
vi.mock('@/composables/useStammbaumData', () => ({
  useStammbaumData: () => ({
    data: ref({ nodes: mockNodes }),
    pending: ref(false),
    error: ref(null),
  }),
}));

// Stubs for child components not central to the filtering logic tests
const TimelineStub = { template: '<div>Timeline</div>' };
const ConceptDetailStub = {
  props: ['concept'],
  template: '<div>ConceptDetail</div>',
};
const LegendStub = { template: '<div>Legend</div>' };

describe('StammbaumPage.vue', () => {
  let wrapper: VueWrapper<InstanceType<typeof StammbaumPage>>;

  beforeEach(() => {
    wrapper = mount(StammbaumPage, {
      global: {
        stubs: {
          Timeline: TimelineStub,
          ConceptDetail: ConceptDetailStub,
          Legend: LegendStub,
          // KiStammbaum: true, // We might want to inspect its props
        },
      },
    });
  });

  it('initializes with no active filters and displays all nodes initially', () => {
    // Access activeFilters (internal ref, so test its effect via stammbaumGraph)
    // Check props passed to KiStammbaum
    const kiStammbaumComponent = wrapper.findComponent(KiStammbaum);
    expect(kiStammbaumComponent.props('nodes').length).toBe(mockNodes.length);
    // Links are also generated, check based on mockNodes
    // n1 depends on n2 -> link n2->n1
    // n4 depends on n1 -> link n1->n4
    expect(kiStammbaumComponent.props('links').length).toBe(2);
  });

  it('updates activeFilters when onFilters is called (tested via FilterControls emission)', async () => {
    const filterControls = wrapper.findComponent(FilterControls);
    const testFilters = { startYear: 1995, endYear: 2005, type: 'concept' };

    // Simulate event emission from FilterControls
    // This will call onFilters in StammbaumPage's setup
    await filterControls.vm.$emit('filtersApplied', testFilters);

    // activeFilters is not directly accessible unless exposed via defineExpose,
    // so we test its effect on stammbaumGraph.
    // Wait for computed properties to update
    await wrapper.vm.$nextTick();

    const kiStammbaumComponent = wrapper.findComponent(KiStammbaum);
    const displayedNodes = kiStammbaumComponent.props('nodes') as Node[];

    // Expected nodes:
    // n2 (1995, concept)
    // n5 (2010, concept) - Oh, endYear is 2005. So n5 is out.
    // Corrected expected: n2
    expect(displayedNodes.length).toBe(1);
    expect(displayedNodes.find((n) => n.id === 'n2')).toBeTruthy();
  });

  describe('stammbaumGraph computed property with activeFilters', () => {
    it('filters by startYear', async () => {
      const filterControls = wrapper.findComponent(FilterControls);
      await filterControls.vm.$emit('filtersApplied', {
        startYear: 2000,
        endYear: null,
        type: '',
      });
      await wrapper.vm.$nextTick();

      const kiStammbaum = wrapper.findComponent(KiStammbaum);
      const nodes = kiStammbaum.props('nodes') as Node[];
      // Expected: n3 (2000), n4 (2005), n5 (2010)
      expect(nodes.length).toBe(3);
      expect(nodes.some((n) => n.id === 'n3')).toBe(true);
      expect(nodes.some((n) => n.id === 'n4')).toBe(true);
      expect(nodes.some((n) => n.id === 'n5')).toBe(true);
    });

    it('filters by endYear', async () => {
      const filterControls = wrapper.findComponent(FilterControls);
      await filterControls.vm.$emit('filtersApplied', {
        startYear: null,
        endYear: 1995,
        type: '',
      });
      await wrapper.vm.$nextTick();

      const kiStammbaum = wrapper.findComponent(KiStammbaum);
      const nodes = kiStammbaum.props('nodes') as Node[];
      // Expected: n1 (1990), n2 (1995)
      expect(nodes.length).toBe(2);
      expect(nodes.some((n) => n.id === 'n1')).toBe(true);
      expect(nodes.some((n) => n.id === 'n2')).toBe(true);
    });

    it('filters by type', async () => {
      const filterControls = wrapper.findComponent(FilterControls);
      await filterControls.vm.$emit('filtersApplied', {
        startYear: null,
        endYear: null,
        type: 'concept',
      });
      await wrapper.vm.$nextTick();

      const kiStammbaum = wrapper.findComponent(KiStammbaum);
      const nodes = kiStammbaum.props('nodes') as Node[];
      // Expected: n2 (concept), n5 (concept)
      expect(nodes.length).toBe(2);
      expect(nodes.some((n) => n.id === 'n2')).toBe(true);
      expect(nodes.some((n) => n.id === 'n5')).toBe(true);
    });

    it('filters by startYear, endYear, and type', async () => {
      const filterControls = wrapper.findComponent(FilterControls);
      await filterControls.vm.$emit('filtersApplied', {
        startYear: 1990,
        endYear: 2000,
        type: 'algorithm',
      });
      await wrapper.vm.$nextTick();

      const kiStammbaum = wrapper.findComponent(KiStammbaum);
      const nodes = kiStammbaum.props('nodes') as Node[];
      // Expected: n1 (1990, algorithm), n3 (2000, algorithm)
      expect(nodes.length).toBe(2);
      expect(nodes.some((n) => n.id === 'n1')).toBe(true);
      expect(nodes.some((n) => n.id === 'n3')).toBe(true);
    });

    it('returns all nodes if filters are empty or null', async () => {
      const filterControls = wrapper.findComponent(FilterControls);
      await filterControls.vm.$emit('filtersApplied', {
        startYear: null,
        endYear: null,
        type: '',
      });
      await wrapper.vm.$nextTick();

      const kiStammbaum = wrapper.findComponent(KiStammbaum);
      const nodes = kiStammbaum.props('nodes') as Node[];
      expect(nodes.length).toBe(mockNodes.length);
    });

    it('correctly updates links when nodes are filtered', async () => {
      const filterControls = wrapper.findComponent(FilterControls);
      // Filter that keeps n1 and n4, but removes n2.
      // n1 (1990, alg), n4 (2005, tech)
      // Original links: n2->n1, n1->n4
      // If n2 is filtered out, link n2->n1 should be removed.
      // Link n1->n4 should remain.
      await filterControls.vm.$emit('filtersApplied', {
        startYear: 1985,
        endYear: 2006,
        type: 'algorithm',
      }); // This will select n1, n3
      // Let's adjust to keep n1 and n4 for a better link test
      // To keep n1 (1990, algorithm) & n4 (2005, technology)
      // We need a type filter that includes both, or no type filter.
      // And a year range that includes 1990 and 2005.
      // If we filter for type 'algorithm', n4 is out.
      // Let's filter for year range 1990-2005, no type filter.
      // This would keep n1, n2, n3, n4. Links: n2->n1, n1->n4.
      // Let's filter to remove n2, but keep n1 and n4.
      // Start year 1990, End year 2005. Type: 'algorithm' OR 'technology'
      // This is not possible with current single type filter.

      // Test case: Filter out n2. This should remove the link n2->n1.
      // Keep n1, n3, n4, n5. Filter out n2 (year 1995)
      await filterControls.vm.$emit('filtersApplied', {
        startYear: 1996,
        endYear: null,
        type: '',
      });
      await wrapper.vm.$nextTick();

      const kiStammbaum = wrapper.findComponent(KiStammbaum);
      const nodes = kiStammbaum.props('nodes') as Node[]; // n3, n4, n5
      // const links = kiStammbaum.props('links') as Link[]; // Commented out as 'links' is unused

      // Expected nodes: n3 (2000), n4 (2005), n5 (2010)
      expect(nodes.length).toBe(3);

      // Original links:
      // { source: 'n2', target: 'n1' }
      // { source: 'n1', target: 'n4' }
      // After filtering out n2 AND n1 (as n1's year is 1990, outside startYear 1996):
      // No nodes from the original links remain. So 0 links.
      // Let's refine the filter to keep n1 and n4, but remove n2.
      // This means startYear must be <= 1990.
      // And n2 (year 1995) must be excluded. This is hard with current filters.

      // Alternative: Filter such that a source node is removed.
      // Filter out n1. Link n1->n4 should be removed.
      // Keep n2, n3, n4 (if type matches), n5.
      // Filter: startYear 1995, no endYear, no type. (Keeps n2, n3, n4, n5)
      // Nodes: n2, n3, n4, n5.
      // Links: n1->n4. Since n1 is out, this link should be gone.
      // No other links involve only n2,n3,n4,n5.
      await filterControls.vm.$emit('filtersApplied', {
        startYear: 1991,
        endYear: null,
        type: '',
      }); // n1 is out.
      await wrapper.vm.$nextTick();
      const linksAfterFilter = kiStammbaum.props('links') as Link[];
      expect(linksAfterFilter.length).toBe(0); // n1->n4 is gone, n2->n1 also gone.

      // Test case: All nodes, all links
      await filterControls.vm.$emit('filtersApplied', {
        startYear: null,
        endYear: null,
        type: '',
      });
      await wrapper.vm.$nextTick();
      const allLinks = kiStammbaum.props('links') as Link[];
      // n2->n1, n1->n4
      expect(allLinks.length).toBe(2);
      expect(allLinks.some((l) => l.source === 'n2' && l.target === 'n1')).toBe(
        true,
      );
      expect(allLinks.some((l) => l.source === 'n1' && l.target === 'n4')).toBe(
        true,
      );
    });
  });
});
