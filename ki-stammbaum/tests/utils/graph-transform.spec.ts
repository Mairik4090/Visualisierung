import { describe, it, expect } from 'vitest';
import { transformToGraph } from '@/utils/graph-transform';
import type { Concept } from '@/types/concept';

describe('transformToGraph', () => {
  it('converts concepts to nodes and links', () => {
    const concepts: Concept[] = [
      { id: 'a', name: 'A', year: 1950, description: '', category: 'concept', dependencies: [] },
      { id: 'b', name: 'B', year: 1960, description: '', category: 'algorithm', dependencies: ['a'] },
    ];

    const graph = transformToGraph(concepts);
    expect(graph.nodes).toEqual([
      { id: 'a', name: 'A', year: 1950, description: '', category: 'concept' },
      { id: 'b', name: 'B', year: 1960, description: '', category: 'algorithm' },
    ]);
    expect(graph.links).toEqual([{ source: 'a', target: 'b' }]);
  });

  it('handles multiple dependencies', () => {
    const concepts: Concept[] = [
      { id: 'a', name: 'A', year: 1950, description: '', category: 'concept', dependencies: [] },
      { id: 'b', name: 'B', year: 1960, description: '', category: 'algorithm', dependencies: ['a'] },
      { id: 'c', name: 'C', year: 1970, description: '', category: 'technology', dependencies: ['a', 'b'] },
    ];

    const { links } = transformToGraph(concepts);
    expect(links).toEqual([
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'c' },
    ]);
  });
});
