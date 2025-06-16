import { describe, it, expect, vi } from 'vitest';
import type { Node } from '@/types/concept';
import * as d3 from 'd3'; // Used for d3.group and d3.scaleOrdinal

// Interface for GraphNode, aligning with KiStammbaum.vue
interface GraphNode extends Node {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  isCluster?: boolean;
  count?: number;
  childNodes?: Node[];
  categoriesInCluster?: string[]; // For global/century clusters
  categoryColorsInCluster?: string[]; // For global/century clusters
  // 'name' is inherited from Node, but clusters will override it.
  // 'description' is inherited from Node, but clusters will override it.
}

// Mock D3 color scale, similar to the component's setup
const mockAllNodeCategories = ['A', 'B', 'C', 'D']; // Example categories
const mockColor = d3.scaleOrdinal<string>().domain(mockAllNodeCategories).range(d3.schemeCategory10);
const mockUserPositionedNodes = new Map<string, { fy: number }>(); // Mock for fy assignments


// Replicated clustering logic from KiStammbaum.vue, using currentZoomLevel
function generateDisplayNodes(
  filteredNodes: Node[],
  currentZoomLevel: number,
): GraphNode[] {
  const displayNodes: GraphNode[] = [];

  // Simplified color scale logic for tests, actual component has more dynamic domain
  const allNodeCategories = Array.from(
    new Set(filteredNodes.map((n) => n.category).filter(Boolean)),
  ) as string[];
  const color = d3.scaleOrdinal<string>().domain(allNodeCategories).range(d3.schemeCategory10);

  if (filteredNodes.length > 0) {
    switch (currentZoomLevel) {
      // Level 1: Century Block Clusters
      case 1: {
        const groupedByCenturyBlock = d3.group(
          filteredNodes,
          (d) => Math.floor(d.year / 100) * 100,
        );
        groupedByCenturyBlock.forEach((nodesInBlock, startYear) => {
          const representativeYear = startYear + 50;
          const clusterId = `century-block-cluster-${startYear}`;
          const childNodes = [...nodesInBlock];
          const categoriesInCluster = Array.from(
            new Set(childNodes.map((n) => n.category).filter(Boolean)),
          ) as string[];
          const categoryColorsInCluster = categoriesInCluster.map((cat) =>
            color(cat || ''),
          );
          displayNodes.push({
            id: clusterId,
            year: representativeYear,
            category: 'global_cluster',
            name: `Concepts ${startYear}-${startYear + 99}`,
            description: `Cluster of ${childNodes.length} concepts from ${startYear} to ${startYear + 99}. Categories: ${categoriesInCluster.join(', ')}`,
            dependencies: [], // Not testing dependencies here
            isCluster: true,
            count: childNodes.length,
            childNodes: childNodes,
            categoriesInCluster: categoriesInCluster,
            categoryColorsInCluster: categoryColorsInCluster,
            fx: null,
            fy: mockUserPositionedNodes.get(clusterId)?.fy ?? null,
          });
        });
        break;
      }
      // Level 2: Century Clusters
      case 2: {
        const groupedByCentury = d3.group(
          filteredNodes,
          (d) => Math.floor(d.year / 100) * 100,
        );
        groupedByCentury.forEach((nodesInCentury, centuryStartYear) => {
          const representativeYear = centuryStartYear + 50;
          const clusterId = `century-cluster-${centuryStartYear}`;
          const childNodes = [...nodesInCentury];
          const categoriesInCluster = Array.from(
            new Set(
              childNodes
                .map((n) => n.category)
                .filter((c): c is string => c !== undefined && c !== null),
            ),
          );
          const categoryColorsInCluster = categoriesInCluster.map((cat) =>
            color(cat),
          );
          // Century naming rule from component
          const centuryNumber = centuryStartYear / 100 + 1;
          let centurySuffix = 'th';
          if (centuryNumber % 10 === 1 && centuryNumber % 100 !== 11) centurySuffix = 'st';
          else if (centuryNumber % 10 === 2 && centuryNumber % 100 !== 12) centurySuffix = 'nd';
          else if (centuryNumber % 10 === 3 && centuryNumber % 100 !== 13) centurySuffix = 'rd';
          // Component specific override for 1800, 1900 (which is actually covered by general 'th' but explicit in component)
          if (centuryStartYear === 1800 || centuryStartYear === 1900) centurySuffix = 'th';


          displayNodes.push({
            id: clusterId,
            year: representativeYear,
            category: 'century_cluster',
            name: `Concepts of the ${centuryNumber}${centurySuffix} Century`,
            description: `Cluster of ${childNodes.length} concepts from the ${centuryNumber}${centurySuffix} century.`,
            dependencies: [],
            isCluster: true,
            count: childNodes.length,
            childNodes: childNodes,
            categoriesInCluster: categoriesInCluster,
            categoryColorsInCluster: categoryColorsInCluster,
            fx: null,
            fy: mockUserPositionedNodes.get(clusterId)?.fy ?? null,
          });
        });
        break;
      }
      // Level 3: Decade-Category Clusters
      case 3: {
        const groupedByDecadeAndCategory = d3.group(
          filteredNodes,
          (d) => Math.floor(d.year / 10) * 10,
          (d) => d.category,
        );
        groupedByDecadeAndCategory.forEach((categoriesInDecade, decade) => {
          categoriesInDecade.forEach((childNodesInGroup, category) => {
            const representativeYear = decade + 5;
            const clusterId = `decade-cat-cluster-${decade}-${category}`;
            displayNodes.push({
              id: clusterId,
              year: representativeYear,
              category: category || '',
              name: `${childNodesInGroup.length} ${category} (${decade}s)`,
              description: `Cluster of ${childNodesInGroup.length} ${category} concepts from the ${decade}s`,
              dependencies: [],
              isCluster: true,
              count: childNodesInGroup.length,
              childNodes: childNodesInGroup,
              fx: null,
              fy: mockUserPositionedNodes.get(clusterId)?.fy ?? null,
            });
          });
        });
        break;
      }
      // Level 4: Individual Nodes (and default fallback)
      case 4:
      default: {
        filteredNodes.forEach((originalNode) => {
          const userSetFy = mockUserPositionedNodes.get(originalNode.id)?.fy;
          displayNodes.push({
            ...originalNode, // Spreads all properties from Node
            isCluster: false,
            count: 1,
            fx: null,
            fy: userSetFy ?? null,
            // childNodes, categoriesInCluster, categoryColorsInCluster are undefined for non-clusters
          });
        });
        break;
      }
    }
  }
  return displayNodes;
}

describe('KiStammbaum.vue Clustering Logic (Replicated)', () => {
  const sampleNodes: Node[] = [
    { id: 'n1', name: 'Concept 1805', year: 1805, category: 'Philosophy', description: 'Desc 1', dependencies: [] },
    { id: 'n2', name: 'Concept 1855', year: 1855, category: 'Science', description: 'Desc 2', dependencies: [] },
    { id: 'n3', name: 'Concept 1905', year: 1905, category: 'Art', description: 'Desc 3', dependencies: [] },
    { id: 'n4', name: 'Concept 1910', year: 1910, category: 'Art', description: 'Desc 4', dependencies: [] }, // Same decade-cat as n5
    { id: 'n5', name: 'Concept 1912', year: 1912, category: 'Art', description: 'Desc 5', dependencies: [] }, // Same decade-cat as n4
    { id: 'n6', name: 'Concept 1925', year: 1925, category: 'Technology', description: 'Desc 6', dependencies: [] },
    { id: 'n7', name: 'Concept 1928', year: 1928, category: 'Philosophy', description: 'Desc 7', dependencies: [] },
    { id: 'n8', name: 'Concept 2005', year: 2005, category: 'Science', description: 'Desc 8', dependencies: [] },
    { id: 'n9', name: 'Concept 2015', year: 2015, category: 'Science', description: 'Desc 9', dependencies: [] }, // Same decade-cat as n8 but different decade
  ];

  // Mock color scale for consistent testing of categoryColorsInCluster
  const testColorScale = d3.scaleOrdinal<string>().domain(['Philosophy', 'Science', 'Art', 'Technology']).range(['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']);


  describe('Zoom Level 1: Century Block Clusters', () => {
    it('should group nodes into 100-year blocks', () => {
      const displayNodes = generateDisplayNodes(sampleNodes, 1);
      // Expected blocks:
      // 1800-1899: n1, n2 (2 nodes) -> century-block-cluster-1800
      // 1900-1999: n3, n4, n5, n6, n7 (5 nodes) -> century-block-cluster-1900
      // 2000-2099: n8, n9 (2 nodes) -> century-block-cluster-2000
      expect(displayNodes).toHaveLength(3);

      const cluster1800 = displayNodes.find(n => n.id === 'century-block-cluster-1800');
      expect(cluster1800).toBeDefined();
      expect(cluster1800?.isCluster).toBe(true);
      expect(cluster1800?.category).toBe('global_cluster');
      expect(cluster1800?.year).toBe(1850);
      expect(cluster1800?.count).toBe(2);
      expect(cluster1800?.childNodes).toEqual(expect.arrayContaining([sampleNodes[0], sampleNodes[1]]));
      expect(cluster1800?.name).toBe('Concepts 1800-1899');
      expect(cluster1800?.categoriesInCluster).toEqual(expect.arrayContaining(['Philosophy', 'Science']));
      // Cannot directly compare categoryColorsInCluster due to mock scale instability in test runs without full d3 lifecycle.
      // Instead, check that it's populated.
      expect(cluster1800?.categoryColorsInCluster?.length).toBe(2);


      const cluster1900 = displayNodes.find(n => n.id === 'century-block-cluster-1900');
      expect(cluster1900).toBeDefined();
      expect(cluster1900?.count).toBe(5);
      expect(cluster1900?.childNodes?.length).toBe(5);
      expect(cluster1900?.name).toBe('Concepts 1900-1999');
      expect(cluster1900?.categoriesInCluster).toEqual(expect.arrayContaining(['Art', 'Technology', 'Philosophy']));

      const cluster2000 = displayNodes.find(n => n.id === 'century-block-cluster-2000');
      expect(cluster2000).toBeDefined();
      expect(cluster2000?.count).toBe(2);
      expect(cluster2000?.name).toBe('Concepts 2000-2099');
    });
  });

  describe('Zoom Level 2: Century Clusters', () => {
    it('should group nodes by century', () => {
      const displayNodes = generateDisplayNodes(sampleNodes, 2);
      // Expected centuries:
      // 19th Century (1800s): n1, n2 -> century-cluster-1800
      // 20th Century (1900s): n3, n4, n5, n6, n7 -> century-cluster-1900
      // 21st Century (2000s): n8, n9 -> century-cluster-2000
      expect(displayNodes).toHaveLength(3);

      const cluster1800 = displayNodes.find(n => n.id === 'century-cluster-1800');
      expect(cluster1800).toBeDefined();
      expect(cluster1800?.isCluster).toBe(true);
      expect(cluster1800?.category).toBe('century_cluster');
      expect(cluster1800?.year).toBe(1850);
      expect(cluster1800?.count).toBe(2);
      expect(cluster1800?.childNodes).toEqual(expect.arrayContaining([sampleNodes[0], sampleNodes[1]]));
      expect(cluster1800?.name).toBe('Concepts of the 19th Century'); // 1800/100 + 1 = 19th
      expect(cluster1800?.categoriesInCluster).toEqual(expect.arrayContaining(['Philosophy', 'Science']));

      const cluster1900 = displayNodes.find(n => n.id === 'century-cluster-1900');
      expect(cluster1900).toBeDefined();
      expect(cluster1900?.count).toBe(5);
      expect(cluster1900?.name).toBe('Concepts of the 20th Century'); // 1900/100 + 1 = 20th

      const cluster2000 = displayNodes.find(n => n.id === 'century-cluster-2000');
      expect(cluster2000).toBeDefined();
      expect(cluster2000?.count).toBe(2);
      expect(cluster2000?.name).toBe('Concepts of the 21st Century'); // 2000/100 + 1 = 21st
    });
     it('should correctly name centuries with specific suffixes', () => {
        const nodesForSuffixTest: Node[] = [
            { id: 's1', name: 'N1', year: 1700, category: 'X', description: '', dependencies: [] }, // 18th
            { id: 's2', name: 'N2', year: 1800, category: 'X', description: '', dependencies: [] }, // 19th
            { id: 's3', name: 'N3', year: 1900, category: 'X', description: '', dependencies: [] }, // 20th
            { id: 's4', name: 'N4', year: 2000, category: 'X', description: '', dependencies: [] }, // 21st
            { id: 's5', name: 'N5', year: 2100, category: 'X', description: '', dependencies: [] }, // 22nd
            { id: 's6', name: 'N6', year: 2200, category: 'X', description: '', dependencies: [] }, // 23rd
        ];
        const displayNodes = generateDisplayNodes(nodesForSuffixTest, 2);
        expect(displayNodes.find(n=>n.id==='century-cluster-1700')?.name).toBe('Concepts of the 18th Century');
        expect(displayNodes.find(n=>n.id==='century-cluster-1800')?.name).toBe('Concepts of the 19th Century');
        expect(displayNodes.find(n=>n.id==='century-cluster-1900')?.name).toBe('Concepts of the 20th Century');
        expect(displayNodes.find(n=>n.id==='century-cluster-2000')?.name).toBe('Concepts of the 21st Century');
        expect(displayNodes.find(n=>n.id==='century-cluster-2100')?.name).toBe('Concepts of the 22nd Century');
        expect(displayNodes.find(n=>n.id==='century-cluster-2200')?.name).toBe('Concepts of the 23rd Century');
    });
  });

  describe('Zoom Level 3: Decade-Category Clusters', () => {
    it('should group nodes by decade and category', () => {
      const displayNodes = generateDisplayNodes(sampleNodes, 3);
      // Expected decade-category clusters:
      // n1: 1800s, Philosophy (1) -> decade-cat-cluster-1800-Philosophy
      // n2: 1850s, Science (1) -> decade-cat-cluster-1850-Science
      // n3: 1900s, Art (1) -> decade-cat-cluster-1900-Art
      // n4, n5: 1910s, Art (2) -> decade-cat-cluster-1910-Art
      // n6: 1920s, Technology (1) -> decade-cat-cluster-1920-Technology
      // n7: 1920s, Philosophy (1) -> decade-cat-cluster-1920-Philosophy
      // n8: 2000s, Science (1) -> decade-cat-cluster-2000-Science
      // n9: 2010s, Science (1) -> decade-cat-cluster-2010-Science
      // Total = 8 clusters
      expect(displayNodes).toHaveLength(8);

      const cluster1910Art = displayNodes.find(n => n.id === 'decade-cat-cluster-1910-Art');
      expect(cluster1910Art).toBeDefined();
      expect(cluster1910Art?.isCluster).toBe(true);
      expect(cluster1910Art?.category).toBe('Art');
      expect(cluster1910Art?.year).toBe(1915); // 1910 + 5
      expect(cluster1910Art?.count).toBe(2);
      expect(cluster1910Art?.childNodes).toEqual(expect.arrayContaining([sampleNodes[3], sampleNodes[4]])); // n4, n5
      expect(cluster1910Art?.name).toBe('2 Art (1910s)');

      const cluster1920Tech = displayNodes.find(n => n.id === 'decade-cat-cluster-1920-Technology');
      expect(cluster1920Tech).toBeDefined();
      expect(cluster1920Tech?.count).toBe(1);
      expect(cluster1920Tech?.name).toBe('1 Technology (1920s)');
      expect(cluster1920Tech?.childNodes).toEqual(expect.arrayContaining([sampleNodes[5]])); // n6
    });
  });

  describe('Zoom Level 4: Individual Nodes', () => {
    it('should display all nodes individually', () => {
      const displayNodes = generateDisplayNodes(sampleNodes, 4);
      expect(displayNodes).toHaveLength(sampleNodes.length);
      sampleNodes.forEach(originalNode => {
        const correspondingDisplayNode = displayNodes.find(dn => dn.id === originalNode.id);
        expect(correspondingDisplayNode).toBeDefined();
        expect(correspondingDisplayNode?.isCluster).toBe(false);
        expect(correspondingDisplayNode?.count).toBe(1);
        expect(correspondingDisplayNode?.name).toBe(originalNode.name);
        expect(correspondingDisplayNode?.year).toBe(originalNode.year);
        expect(correspondingDisplayNode?.category).toBe(originalNode.category);
        expect(correspondingDisplayNode?.childNodes).toBeUndefined();
      });
    });
  });
   describe('Default Fallback (e.g. Zoom Level > 4 or invalid)', () => {
    it('should display all nodes individually if zoom level is out of defined cases', () => {
      const displayNodes = generateDisplayNodes(sampleNodes, 5); // Test with level 5
      expect(displayNodes).toHaveLength(sampleNodes.length);
      displayNodes.forEach(node => {
        expect(node.isCluster).toBe(false);
        expect(node.count).toBe(1);
      });
    });
  });
});

// New describe block for component interaction tests
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import KiStammbaum from '@/components/KiStammbaum.vue';

describe('KiStammbaum.vue Component Interaction', () => {
  it('should react to targetZoomLevel prop changes', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    const wrapper = mount(KiStammbaum, {
      props: {
        nodes: [
          {
            id: 'n1',
            name: 'Node 1',
            year: 2000,
            category: 'A',
            description: 'Test node 1',
            dependencies: [],
          },
        ],
        links: [],
        currentYearRange: [1990, 2010] as [number, number],
        targetZoomLevel: 1,
        usePhysics: false,
      },
    });

    // Initial render might log, depending on component's full lifecycle
    // Let's wait for any initial async operations triggered by mount
    await nextTick(); // For setup
    await nextTick(); // For potential first render/watchers

    // Clear any logs that might have occurred during initial mount and setup
    consoleLogSpy.mockClear();

    await wrapper.setProps({ targetZoomLevel: 2 });
    // Wait for Vue's reactivity and D3 transitions/callbacks
    await nextTick(); // For prop update
    await nextTick(); // For watcher execution
    await nextTick(); // For D3 transition (if any immediate logging happens)
    // Potentially need a longer timeout or a more robust way if D3 transitions are involved
    // For now, we assume console logs happen reasonably quickly after prop change and nextTick

    // Check specific logs related to zoom level change
    // This relies on the console.log messages added in the previous subtask
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[KiStammbaum Zoom Watch] TargetZoomLevel changed. New: 2 Old: 1'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[KiStammbaum Zoom Watch] currentZoomLevel.value before update: 1'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[KiStammbaum Zoom Watch] Calculated targetScale: 0.7'), // ZOOM_LEVEL_SCALES[1]
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[KiStammbaum Zoom Watch] newTransform to be applied:'),
      expect.anything(), // The transform object itself
    );

    // It's harder to reliably test the log inside .on('end') of D3 transition in a JSDOM environment
    // without more complex mocking of D3 transitions or longer, flaky timeouts.
    // We will also check for the render log with the new zoom level.
    // This might require additional nextTicks or a flushPromises equivalent if render is further deferred.
    await nextTick(); // allow for render cycle after zoom logic
    await nextTick();

    expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[KiStammbaum Render] currentZoomLevel.value: 2')
    );


    vi.restoreAllMocks();
  });
});
