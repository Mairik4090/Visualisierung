import type { KiConcept, Node, Link, Graph } from '@/types/concept';

/**
 * Convert an array of KiConcept objects into a graph structure usable by D3.
 * @param concepts Array of concepts loaded from the JSON data.
 * @returns Graph object containing nodes and links.
 */
export function transformToGraph(concepts: KiConcept[]): Graph {
  const nodes: Node[] = concepts.map((c) => ({ id: c.id, year: c.year }));
  const links: Link[] = concepts.flatMap((c) =>
    c.dependencies.map((dep) => ({ source: dep, target: c.id })),
  );
  return { nodes, links };
}
