import { describe, it, expect, vi } from 'vitest';
import type { Node } from '@/types/concept';

// Timeline-specific zoom thresholds
const TIMELINE_CLUSTER_THRESHOLD_DECADE = 1.2;
const TIMELINE_CLUSTER_THRESHOLD_YEAR = 2.0;

// Interface for items displayed on the timeline
interface TimelineDisplayItem extends Partial<Node> {
  id: string;
  year: number;
  category: string;
  isCluster: boolean;
  count?: number;
  childNodes?: Node[];
  name?: string;
  description?: string;
  categoriesInCluster?: string[];
  categoryColorsInCluster?: string[];
}

// Mock D3 color scale
const mockColorScale = vi.fn((category: string) => `${category}-color`);

// Replicated timeline clustering logic from draw() function
function generateTimelineDisplayItems(
  nodes: Node[],
  currentZoomLevel: number,
  colorScale: (category: string) => string
): TimelineDisplayItem[] {
  let displayableTimelineItems: TimelineDisplayItem[] = [];

  if (nodes && nodes.length > 0) {
    if (currentZoomLevel < TIMELINE_CLUSTER_THRESHOLD_DECADE) {
      const decadeBuckets = new Map<number, Node[]>();
      nodes.forEach(node => {
        const decade = Math.floor(node.year / 10) * 10;
        if (!decadeBuckets.has(decade)) {
          decadeBuckets.set(decade, []);
        }
        decadeBuckets.get(decade)!.push(node);
      });

      decadeBuckets.forEach((childNodes, decade) => {
        const categoriesInCluster = Array.from(new Set(childNodes.map(n => n.category)));
        const categoryColorsInCluster = categoriesInCluster.map(cat => colorScale(cat));
        displayableTimelineItems.push({
          id: `timeline-decade-cluster-${decade}`,
          year: decade,
          category: 'timeline_decade_cluster',
          isCluster: true,
          count: childNodes.length,
          childNodes: childNodes,
          name: `${childNodes.length} items (${decade}s)`,
          description: `Cluster for ${decade}s containing ${childNodes.length} items. Categories: ${categoriesInCluster.join(', ')}`,
          categoriesInCluster,
          categoryColorsInCluster,
        });
      });
    } else if (currentZoomLevel < TIMELINE_CLUSTER_THRESHOLD_YEAR) {
      const yearCategoryBuckets = new Map<string, Node[]>(); // Key: "year-category"
      nodes.forEach(node => {
        const key = `${node.year}-${node.category}`;
        if (!yearCategoryBuckets.has(key)) {
          yearCategoryBuckets.set(key, []);
        }
        yearCategoryBuckets.get(key)!.push(node);
      });

      yearCategoryBuckets.forEach((childNodes, key) => {
        const [yearStr, category] = key.split('-');
        const year = parseInt(yearStr);
        if (childNodes.length > 1) {
          displayableTimelineItems.push({
            id: `timeline-year-cat-cluster-${year}-${category}`,
            year: year,
            category: category,
            isCluster: true,
            count: childNodes.length,
            childNodes: childNodes,
            name: `${childNodes.length} ${category} (${year})`,
            description: `Cluster of ${childNodes.length} ${category} items for ${year}`,
          });
        } else {
          childNodes.forEach(node => {
            displayableTimelineItems.push({
              ...node,
              isCluster: false,
              count: 1,
            });
          });
        }
      });
    } else {
      nodes.forEach(node => {
        displayableTimelineItems.push({
          ...node,
          isCluster: false,
          count: 1,
        });
      });
    }
  }
  return displayableTimelineItems;
}

describe('Timeline.vue Clustering Logic', () => {
  const sampleNodes: Node[] = [
    { id: 't1', name: 'TNode 1', year: 1995, category: 'X', description: 'TDesc 1', dependencies: [] },
    { id: 't2', name: 'TNode 2', year: 1998, category: 'Y', description: 'TDesc 2', dependencies: [] }, // Same decade (1990s)
    { id: 't3', name: 'TNode 3', year: 2001, category: 'X', description: 'TDesc 3', dependencies: [] }, // Decade 2000s
    { id: 't4', name: 'TNode 4', year: 2003, category: 'Z', description: 'TDesc 4', dependencies: [] }, // Decade 2000s
    { id: 't5', name: 'TNode 5', year: 2003, category: 'Z', description: 'TDesc 5', dependencies: [] }, // Same year & cat as t4
    { id: 't6', name: 'TNode 6', year: 2010, category: 'X', description: 'TDesc 6', dependencies: [] }, // Decade 2010s
    { id: 't7', name: 'TNode 7', year: 2012, category: 'Y', description: 'TDesc 7', dependencies: [] }, // Decade 2010s, different cat
  ];

  describe('Timeline Decade Clustering (Low Timeline Zoom)', () => {
    it('should form decade clusters when zoom < TIMELINE_CLUSTER_THRESHOLD_DECADE', () => {
      const zoomLevel = 1.0; // Below 1.2
      const result = generateTimelineDisplayItems(sampleNodes, zoomLevel, mockColorScale);

      // Expected decades:
      // 1990s: t1, t2 (2 nodes, Cat X, Y)
      // 2000s: t3, t4, t5 (3 nodes, Cat X, Z)
      // 2010s: t6, t7 (2 nodes, Cat X, Y)
      expect(result).toHaveLength(3);

      const cluster1990 = result.find(item => item.id === 'timeline-decade-cluster-1990');
      expect(cluster1990).toBeDefined();
      expect(cluster1990?.isCluster).toBe(true);
      expect(cluster1990?.category).toBe('timeline_decade_cluster');
      expect(cluster1990?.year).toBe(1990);
      expect(cluster1990?.count).toBe(2);
      expect(cluster1990?.childNodes).toEqual(expect.arrayContaining([sampleNodes[0], sampleNodes[1]]));
      expect(cluster1990?.categoriesInCluster).toEqual(expect.arrayContaining(['X', 'Y']));
      expect(cluster1990?.categoryColorsInCluster).toEqual(expect.arrayContaining(['X-color', 'Y-color']));
      expect(cluster1990?.name).toBe('2 items (1990s)');

      const cluster2000 = result.find(item => item.id === 'timeline-decade-cluster-2000');
      expect(cluster2000).toBeDefined();
      expect(cluster2000?.count).toBe(3);
      expect(cluster2000?.childNodes?.length).toBe(3);
      expect(cluster2000?.categoriesInCluster).toEqual(expect.arrayContaining(['X', 'Z']));

      const cluster2010 = result.find(item => item.id === 'timeline-decade-cluster-2010');
      expect(cluster2010).toBeDefined();
      expect(cluster2010?.count).toBe(2);
      expect(cluster2010?.childNodes?.length).toBe(2);
      expect(cluster2010?.categoriesInCluster).toEqual(expect.arrayContaining(['X', 'Y']));
    });
  });
  // More test cases for other timeline clustering levels will be added here
  describe('Timeline Year/Category Clustering (Mid Timeline Zoom)', () => {
    it('should form year/category clusters when zoom is between decade and year thresholds', () => {
      const zoomLevel = 1.8; // Between 1.2 and 2.0
      const result = generateTimelineDisplayItems(sampleNodes, zoomLevel, mockColorScale);

      // Expected:
      // Node t1 (1995, X) - individual
      // Node t2 (1998, Y) - individual
      // Node t3 (2001, X) - individual
      // Nodes t4, t5 (2003, Z) form timeline-year-cat-cluster-2003-Z (count 2)
      // Node t6 (2010, X) - individual
      // Node t7 (2012, Y) - individual
      // Total: 7 sample nodes. 1 cluster takes 2 nodes. 7-2 = 5 individual. 5+1 = 6 display items.
      expect(result).toHaveLength(6);

      const cluster2003Z = result.find(item => item.id === 'timeline-year-cat-cluster-2003-Z');
      expect(cluster2003Z).toBeDefined();
      expect(cluster2003Z?.isCluster).toBe(true);
      expect(cluster2003Z?.category).toBe('Z');
      expect(cluster2003Z?.year).toBe(2003);
      expect(cluster2003Z?.count).toBe(2);
      expect(cluster2003Z?.childNodes).toEqual(expect.arrayContaining([sampleNodes[3], sampleNodes[4]]));
      expect(cluster2003Z?.name).toBe('2 Z (2003)');

      const individualNodeT1 = result.find(item => item.id === 't1');
      expect(individualNodeT1).toBeDefined();
      expect(individualNodeT1?.isCluster).toBe(false);
      expect(individualNodeT1?.count).toBe(1);
      expect(individualNodeT1?.year).toBe(1995);

      const individualNodeT6 = result.find(item => item.id === 't6');
      expect(individualNodeT6).toBeDefined();
      expect(individualNodeT6?.isCluster).toBe(false);
      expect(individualNodeT6?.year).toBe(2010);
    });
  });

  describe('Individual Timeline Items (High Timeline Zoom)', () => {
    it('should show individual items when zoom >= TIMELINE_CLUSTER_THRESHOLD_YEAR', () => {
      const zoomLevel = 2.5; // >= 2.0
      const result = generateTimelineDisplayItems(sampleNodes, zoomLevel, mockColorScale);

      expect(result).toHaveLength(sampleNodes.length);
      result.forEach((item, index) => {
        expect(item.isCluster).toBe(false);
        expect(item.count).toBe(1);
        // Check if original node properties are preserved
        expect(item.id).toBe(sampleNodes[index].id);
        expect(item.year).toBe(sampleNodes[index].year);
        expect(item.category).toBe(sampleNodes[index].category);
      });
    });
  });
});

// New describe block for component interaction tests
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Timeline from '@/components/Timeline.vue'; // Adjust path as necessary

describe('Timeline.vue Component Interaction', () => {
  const sampleNodes: Node[] = [
    { id: 't1', name: 'TNode 1', year: 1995, category: 'X', description: 'TDesc 1', dependencies: [] },
    { id: 't2', name: 'TNode 2', year: 1998, category: 'Y', description: 'TDesc 2', dependencies: [] },
  ];

  it('should apply highlighting based on highlightNodeId prop', async () => {
    const wrapper = mount(Timeline, {
      props: {
        nodes: sampleNodes,
        highlightNodeId: null,
      },
      // Mock the SVG element and its clientWidth/Height as D3 relies on it for rendering
      attachTo: document.body, // Mounting to body to ensure clientWidth/Height are available
    });

    // Wait for D3 to render initially
    await nextTick(); // For Vue's initial render
    await nextTick(); // For D3's rendering logic which might be in onMounted or watchers

    // Check initial state: no node highlighted
    // Note: D3 might take a moment to draw, especially in test environment.
    // We need to ensure the SVG has been populated by D3.
    // A simple check for any rect element can be a proxy for D3 having run.
    expect(wrapper.find('svg rect').exists()).toBe(true);


    let highlightedRectT1 = wrapper.find('rect[data-id="t1"][data-highlighted="true"]');
    expect(highlightedRectT1.exists()).toBe(false);
    let highlightedRectT2 = wrapper.find('rect[data-id="t2"][data-highlighted="true"]');
    expect(highlightedRectT2.exists()).toBe(false);

    // Update prop to highlight 't1'
    await wrapper.setProps({ highlightNodeId: 't1' });
    await nextTick(); // For Vue reactivity
    await nextTick(); // For D3 to re-render/update attributes

    highlightedRectT1 = wrapper.find('rect[data-id="t1"][data-highlighted="true"]');
    expect(highlightedRectT1.exists()).toBe(true);
    // Check the actual attribute value
    expect(highlightedRectT1.attributes('data-highlighted')).toBe('true');


    highlightedRectT2 = wrapper.find('rect[data-id="t2"][data-highlighted="true"]');
    expect(highlightedRectT2.exists()).toBe(false);
     // Also check its data-highlighted attribute is 'false' or not present if that's the logic
    const nonHighlightedRectT2 = wrapper.find('rect[data-id="t2"]');
    expect(nonHighlightedRectT2.attributes('data-highlighted')).toBe('false');


    // Update prop to highlight 't2'
    await wrapper.setProps({ highlightNodeId: 't2' });
    await nextTick();
    await nextTick();

    highlightedRectT1 = wrapper.find('rect[data-id="t1"][data-highlighted="true"]');
    expect(highlightedRectT1.exists()).toBe(false);
    const nonHighlightedRectT1 = wrapper.find('rect[data-id="t1"]');
    expect(nonHighlightedRectT1.attributes('data-highlighted')).toBe('false');


    highlightedRectT2 = wrapper.find('rect[data-id="t2"][data-highlighted="true"]');
    expect(highlightedRectT2.exists()).toBe(true);
    expect(highlightedRectT2.attributes('data-highlighted')).toBe('true');


    // Update prop to remove highlighting
    await wrapper.setProps({ highlightNodeId: null });
    await nextTick();
    await nextTick();

    highlightedRectT1 = wrapper.find('rect[data-id="t1"][data-highlighted="true"]');
    expect(highlightedRectT1.exists()).toBe(false);
    highlightedRectT2 = wrapper.find('rect[data-id="t2"][data-highlighted="true"]');
    expect(highlightedRectT2.exists()).toBe(false);

    const finalNonHighlightedRectT1 = wrapper.find('rect[data-id="t1"]');
    expect(finalNonHighlightedRectT1.attributes('data-highlighted')).toBe('false');
    const finalNonHighlightedRectT2 = wrapper.find('rect[data-id="t2"]');
    expect(finalNonHighlightedRectT2.attributes('data-highlighted')).toBe('false');


    wrapper.unmount(); // Clean up
  });
});
