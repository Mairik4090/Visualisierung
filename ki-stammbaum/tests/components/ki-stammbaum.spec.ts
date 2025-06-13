import { describe, it, expect, vi } from 'vitest';
import type { Node } from '@/types/concept';
// Cannot directly import KiStammbaum.vue and test its internals like displayNodes generation without mounting or refactoring.
// Instead, we will replicate the core clustering logic here for focused unit testing.

const GLOBAL_CLUSTER_THRESHOLD = 0.5;
const CATEGORY_DECADE_CLUSTER_THRESHOLD = 1.0;
const CATEGORY_YEAR_CLUSTER_THRESHOLD = 1.8;

interface GraphNode extends Node {
  name?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  isCluster?: boolean;
  count?: number;
  childNodes?: Node[];
  categoriesInCluster?: string[];
  categoryColorsInCluster?: string[];
}

// Mock D3 color scale
const mockColorScale = vi.fn((category: string) => `${category}-color`);

// Replicated clustering logic (simplified for testing, focusing on displayNodes generation)
function generateDisplayNodes(
  filteredNodes: Node[],
  currentZoomScale: number,
  // Passing mock color scale for testing categoryColorsInCluster
  colorScale: (category: string) => string
): GraphNode[] {
  const displayNodes: GraphNode[] = [];

  if (filteredNodes.length > 0) {
    if (currentZoomScale < GLOBAL_CLUSTER_THRESHOLD) {
      const yearBucketSize = 50;
      const groupedByGlobalBuckets = new Map<number, Node[]>();
      filteredNodes.forEach(node => {
        const bucket = Math.floor(node.year / yearBucketSize) * yearBucketSize;
        if (!groupedByGlobalBuckets.has(bucket)) {
          groupedByGlobalBuckets.set(bucket, []);
        }
        groupedByGlobalBuckets.get(bucket)!.push(node);
      });

      groupedByGlobalBuckets.forEach((nodesInBucket, bucketYear) => {
        const representativeYear = bucketYear + yearBucketSize / 2;
        const clusterId = `global-cluster-${bucketYear}`;
        const childNodes = [...nodesInBucket];
        const categoriesInCluster = Array.from(new Set(childNodes.map(n => n.category)));
        const categoryColorsInCluster = categoriesInCluster.map(cat => colorScale(cat));

        displayNodes.push({
          id: clusterId,
          year: representativeYear,
          category: 'global_cluster',
          name: `${childNodes.length} items (ca. ${bucketYear} - ${bucketYear + yearBucketSize -1})`,
          description: `Global cluster of ${childNodes.length} concepts from ${bucketYear} to ${bucketYear + yearBucketSize - 1}. Categories: ${categoriesInCluster.join(', ')}`,
          dependencies: [], // Assuming clusters don't have direct dependencies for now
          isCluster: true,
          count: childNodes.length,
          childNodes: childNodes,
          categoriesInCluster: categoriesInCluster,
          categoryColorsInCluster: categoryColorsInCluster,
        });
      });
    } else if (currentZoomScale < CATEGORY_DECADE_CLUSTER_THRESHOLD) {
      const groupedByDecadeAndCategory = new Map<string, Node[]>(); // Key: "decade-category"
      filteredNodes.forEach(node => {
        const decade = Math.floor(node.year / 10) * 10;
        const key = `${decade}-${node.category}`;
        if (!groupedByDecadeAndCategory.has(key)) {
          groupedByDecadeAndCategory.set(key, []);
        }
        groupedByDecadeAndCategory.get(key)!.push(node);
      });

      groupedByDecadeAndCategory.forEach((childNodesInGroup, key) => {
        const [decadeStr, category] = key.split('-');
        const decade = parseInt(decadeStr);
        const representativeYear = decade + 5;
        const clusterId = `cat-decade-cluster-${decade}-${category}`;
        displayNodes.push({
          id: clusterId,
          year: representativeYear,
          category: category,
          name: `${childNodesInGroup.length} ${category} (${decade}s)`,
          description: `Cluster of ${childNodesInGroup.length} ${category} concepts from the ${decade}s`,
          dependencies: [],
          isCluster: true,
          count: childNodesInGroup.length,
          childNodes: childNodesInGroup,
        });
      });
    } else if (currentZoomScale < CATEGORY_YEAR_CLUSTER_THRESHOLD) {
      const groupedByYearAndCategory = new Map<string, Node[]>(); // Key: "year-category"
       filteredNodes.forEach(node => {
        const key = `${node.year}-${node.category}`;
        if (!groupedByYearAndCategory.has(key)) {
          groupedByYearAndCategory.set(key, []);
        }
        groupedByYearAndCategory.get(key)!.push(node);
      });

      groupedByYearAndCategory.forEach((originalNodesInGroup, key) => {
        const [yearStr, category] = key.split('-');
        const year = parseInt(yearStr);
        if (originalNodesInGroup.length > 1) {
          const clusterId = `cat-year-cluster-${year}-${category}`;
          displayNodes.push({
            id: clusterId,
            year: year,
            category: category,
            name: `${originalNodesInGroup.length} ${category} (${year})`,
            description: `Cluster of ${originalNodesInGroup.length} ${category} items for ${year}`,
            dependencies: [],
            isCluster: true,
            count: originalNodesInGroup.length,
            childNodes: originalNodesInGroup,
          });
        } else {
          originalNodesInGroup.forEach(originalNode => {
            displayNodes.push({
              ...originalNode,
              isCluster: false,
              count: 1,
            });
          });
        }
      });
    } else { // Highest Zoom
      filteredNodes.forEach(originalNode => {
        displayNodes.push({
          ...originalNode,
          isCluster: false,
          count: 1,
        });
      });
    }
  }
  return displayNodes;
}


describe('KiStammbaum.vue Clustering Logic', () => {
  const sampleNodes: Node[] = [
    { id: '1', name: 'Node 1', year: 1900, category: 'A', description: 'Desc 1', dependencies: [] },
    { id: '2', name: 'Node 2', year: 1910, category: 'B', description: 'Desc 2', dependencies: [] },
    { id: '3', name: 'Node 3', year: 1949, category: 'A', description: 'Desc 3', dependencies: [] }, // Same 50yr bucket as 1 & 2
    { id: '4', name: 'Node 4', year: 1950, category: 'C', description: 'Desc 4', dependencies: [] }, // New 50yr bucket
    { id: '5', name: 'Node 5', year: 1965, category: 'B', description: 'Desc 5', dependencies: [] }, // Same 50yr bucket as 4
    { id: '6', name: 'Node 6', year: 1970, category: 'A', description: 'Desc 6', dependencies: [] }, // Same decade (70s) & category as 7
    { id: '7', name: 'Node 7', year: 1975, category: 'A', description: 'Desc 7', dependencies: [] }, // Same decade (70s) & category as 6
    { id: '8', name: 'Node 8', year: 1980, category: 'C', description: 'Desc 8', dependencies: [] }, // Single in decade-cat
    { id: '9', name: 'Node 9', year: 1990, category: 'A', description: 'Desc 9', dependencies: [] }, // year-cat cluster with 10
    { id: '10', name: 'Node 10', year: 1990, category: 'A', description: 'Desc 10', dependencies: [] },// year-cat cluster with 9
    { id: '11', name: 'Node 11', year: 1991, category: 'B', description: 'Desc 11', dependencies: [] },// individual
    { id: '12', name: 'Node 12', year: 2000, category: 'D', description: 'Desc 12', dependencies: [] },
  ];

  describe('Global Clustering (Low Zoom)', () => {
    it('should form global clusters for zoom < GLOBAL_CLUSTER_THRESHOLD', () => {
      const zoomScale = 0.4; // Below GLOBAL_CLUSTER_THRESHOLD (0.5)
      const result = generateDisplayNodes(sampleNodes, zoomScale, mockColorScale);

      // Expected buckets:
      // 1900-1949: Node 1, 2, 3 (3 nodes, Cat A, B)
      // 1950-1999: Node 4, 5, 6, 7, 8, 9, 10, 11 (8 nodes, Cat A, B, C)
      // 2000-2049: Node 12 (1 node, Cat D)
      expect(result).toHaveLength(3);

      const cluster1900 = result.find(n => n.id === 'global-cluster-1900');
      expect(cluster1900).toBeDefined();
      expect(cluster1900?.isCluster).toBe(true);
      expect(cluster1900?.category).toBe('global_cluster');
      expect(cluster1900?.count).toBe(3);
      expect(cluster1900?.childNodes).toEqual(expect.arrayContaining([sampleNodes[0], sampleNodes[1], sampleNodes[2]]));
      expect(cluster1900?.categoriesInCluster).toEqual(expect.arrayContaining(['A', 'B']));
      expect(cluster1900?.categoryColorsInCluster).toEqual(expect.arrayContaining(['A-color', 'B-color']));
      expect(cluster1900?.name).toBe('3 items (ca. 1900 - 1949)');

      const cluster1950 = result.find(n => n.id === 'global-cluster-1950');
      expect(cluster1950).toBeDefined();
      expect(cluster1950?.count).toBe(8);
      expect(cluster1950?.childNodes?.length).toBe(8);
      expect(cluster1950?.categoriesInCluster).toEqual(expect.arrayContaining(['C', 'B', 'A']));
      expect(cluster1950?.categoryColorsInCluster).toEqual(expect.arrayContaining(['C-color', 'B-color', 'A-color']));
      expect(cluster1950?.name).toBe('8 items (ca. 1950 - 1999)');

      const cluster2000 = result.find(n => n.id === 'global-cluster-2000');
      expect(cluster2000).toBeDefined();
      expect(cluster2000?.count).toBe(1);
      expect(cluster2000?.childNodes).toEqual(expect.arrayContaining([sampleNodes[11]]));
      expect(cluster2000?.categoriesInCluster).toEqual(['D']);
      expect(cluster2000?.categoryColorsInCluster).toEqual(['D-color']);
      expect(cluster2000?.name).toBe('1 items (ca. 2000 - 2049)');
    });
  });

  // More test cases for other clustering levels will be added here
  describe('Category-Decade Clustering (Mid Zoom 1)', () => {
    it('should form category-decade clusters for zoom between GLOBAL and CATEGORY_DECADE thresholds', () => {
      const zoomScale = 0.9; // Between 0.5 and 1.0
      const result = generateDisplayNodes(sampleNodes, zoomScale, mockColorScale);

      // Expected:
      // Decade 1900, Cat A: Node 1 (1)
      // Decade 1910, Cat B: Node 2 (1)
      // Decade 1940, Cat A: Node 3 (1)
      // Decade 1950, Cat C: Node 4 (1)
      // Decade 1960, Cat B: Node 5 (1)
      // Decade 1970, Cat A: Node 6, 7 (2) -> cluster `cat-decade-cluster-1970-A`
      // Decade 1980, Cat C: Node 8 (1)
      // Decade 1990, Cat A: Node 9, 10 (2) -> cluster `cat-decade-cluster-1990-A`
      // Decade 1990, Cat B: Node 11 (1) -> (Note: year is 1991, so decade is 1990)
      // Decade 2000, Cat D: Node 12 (1)
      // Total: 8 individual nodes that don't form decade clusters by category + 2 clusters = 10 display items

      // Adjusting expectations based on current logic:
      // The current decade clustering forms clusters if ANY nodes exist for that cat/decade.
      // It does not check for childNodes.length > 1 for decade clusters.
      // Let's list expected clusters/nodes:
      // cat-decade-cluster-1900-A (Node 1)
      // cat-decade-cluster-1910-B (Node 2)
      // cat-decade-cluster-1940-A (Node 3)
      // cat-decade-cluster-1950-C (Node 4)
      // cat-decade-cluster-1960-B (Node 5)
      // cat-decade-cluster-1970-A (Node 6, 7) - count 2
      // cat-decade-cluster-1980-C (Node 8)
      // cat-decade-cluster-1990-A (Node 9, 10) - count 2
      // cat-decade-cluster-1990-B (Node 11)
      // cat-decade-cluster-2000-D (Node 12)
      expect(result).toHaveLength(10);

      const cluster1970A = result.find(n => n.id === 'cat-decade-cluster-1970-A');
      expect(cluster1970A).toBeDefined();
      expect(cluster1970A?.isCluster).toBe(true);
      expect(cluster1970A?.category).toBe('A');
      expect(cluster1970A?.year).toBe(1975); // Mid-point of decade
      expect(cluster1970A?.count).toBe(2);
      expect(cluster1970A?.childNodes).toEqual(expect.arrayContaining([sampleNodes[5], sampleNodes[6]]));
      expect(cluster1970A?.name).toBe('2 A (1970s)');

      const cluster1990A = result.find(n => n.id === 'cat-decade-cluster-1990-A');
      expect(cluster1990A).toBeDefined();
      expect(cluster1990A?.isCluster).toBe(true);
      expect(cluster1990A?.category).toBe('A');
      expect(cluster1990A?.count).toBe(2);
      expect(cluster1990A?.childNodes).toEqual(expect.arrayContaining([sampleNodes[8], sampleNodes[9]]));
      expect(cluster1990A?.name).toBe('2 A (1990s)');

      // Check one single-node "cluster" to verify behavior
      const cluster1900A = result.find(n => n.id === 'cat-decade-cluster-1900-A');
      expect(cluster1900A).toBeDefined();
      expect(cluster1900A?.isCluster).toBe(true); // As per current logic
      expect(cluster1900A?.count).toBe(1);
      expect(cluster1900A?.childNodes).toEqual(expect.arrayContaining([sampleNodes[0]]));
      expect(cluster1900A?.name).toBe('1 A (1900s)');
    });
  });

  describe('Category-Year Clustering (Mid Zoom 2)', () => {
    it('should form category-year clusters for zoom between CATEGORY_DECADE and CATEGORY_YEAR thresholds', () => {
      const zoomScale = 1.6; // Between 1.0 and 1.8
      const result = generateDisplayNodes(sampleNodes, zoomScale, mockColorScale);
      // Expected:
      // Nodes 1,2,3,4,5 are individual (isCluster: false, count: 1)
      // Nodes 6,7 (1970, A) form cat-year-cluster-1970-A (count 2)
      // Node 8 is individual
      // Nodes 9,10 (1990, A) form cat-year-cluster-1990-A (count 2)
      // Nodes 11, 12 are individual
      // Total: 12 nodes in sample. 2 clusters take 4 nodes. 12-4 = 8 individual nodes. 8+2 = 10 display items.
      expect(result).toHaveLength(10);

      const cluster1970A = result.find(n => n.id === 'cat-year-cluster-1970-A');
      expect(cluster1970A).toBeDefined();
      expect(cluster1970A?.isCluster).toBe(true);
      expect(cluster1970A?.category).toBe('A');
      expect(cluster1970A?.year).toBe(1970);
      expect(cluster1970A?.count).toBe(2);
      expect(cluster1970A?.childNodes).toEqual(expect.arrayContaining([sampleNodes[5], sampleNodes[6]]));
      expect(cluster1970A?.name).toBe('2 A (1970)');

      const cluster1990A = result.find(n => n.id === 'cat-year-cluster-1990-A');
      expect(cluster1990A).toBeDefined();
      expect(cluster1990A?.isCluster).toBe(true);
      expect(cluster1990A?.category).toBe('A');
      expect(cluster1990A?.year).toBe(1990);
      expect(cluster1990A?.count).toBe(2);
      expect(cluster1990A?.childNodes).toEqual(expect.arrayContaining([sampleNodes[8], sampleNodes[9]]));
      expect(cluster1990A?.name).toBe('2 A (1990)');

      const individualNode1 = result.find(n => n.id === '1');
      expect(individualNode1).toBeDefined();
      expect(individualNode1?.isCluster).toBe(false);
      expect(individualNode1?.count).toBe(1);
    });
  });

  describe('Individual Nodes (High Zoom)', () => {
    it('should show individual nodes for zoom >= CATEGORY_YEAR_THRESHOLD', () => {
      const zoomScale = 2.0; // >= CATEGORY_YEAR_THRESHOLD (1.8)
      const result = generateDisplayNodes(sampleNodes, zoomScale, mockColorScale);

      expect(result).toHaveLength(sampleNodes.length);
      result.forEach((node, index) => {
        expect(node.isCluster).toBe(false);
        expect(node.count).toBe(1);
        expect(node.id).toBe(sampleNodes[index].id);
      });
    });
  });
});
