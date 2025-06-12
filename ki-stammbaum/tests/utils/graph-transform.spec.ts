import { describe, it, expect } from 'vitest';
import { transformToGraph } from '@/utils/graph-transform';
import type { Concept } from '@/types/concept';

describe('transformToGraph', () => {
  it('converts concepts to nodes and links', () => {
    const concepts: Concept[] = [
      { id: 'a', name: 'A', year: 1950, description: '', dependencies: [] },
      { id: 'b', name: 'B', year: 1960, description: '', dependencies: ['a'] },
    ];

    const graph = transformToGraph(concepts);
    expect(graph.nodes).toEqual([
      { id: 'a', name: 'A', year: 1950, description: '' },
      { id: 'b', name: 'B', year: 1960, description: '' },
    ]);
    expect(graph.links).toEqual([
      { source: 'a', target: 'b' },
    ]);
  });

  it('handles multiple dependencies', () => {
    const concepts: Concept[] = [
      { id: 'a', name: 'A', year: 1950, description: '', dependencies: [] },
      { id: 'b', name: 'B', year: 1960, description: '', dependencies: ['a'] },
      { id: 'c', name: 'C', year: 1970, description: '', dependencies: ['a', 'b'] },
    ];

    const { links } = transformToGraph(concepts);
    expect(links).toEqual([
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'c' },
    ]);
  });
});
