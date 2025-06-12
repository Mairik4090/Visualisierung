/**
 * Utility functions for transforming the KI-Stammbaum dataset into
 * a D3-compatible format.
 * @module graph-transform
 * @author KI-Stammbaum
 */

import type { Concept, Graph, Node, Link } from '../types/concept';

/**
 * Converts a list of concepts into nodes and links for D3.
 * @param concepts - Preprocessed concepts from the JSON file.
 * @returns Object containing arrays of nodes and links.
 */
export function transformToGraph(concepts: Concept[]): Graph {
  // 1 Nodes erstellen – jedes Konzept wird zum Knoten
  const nodes: Node[] = concepts.map((c) => ({
    id: c.id,
    name: c.name,
    year: +c.year,
    description: c.description,
    category: c.category,
  }));
  // 2 Links erstellen – Abhängigkeiten bilden gerichtete Kanten
  const links: Link[] = concepts.flatMap((c) =>
    (c.dependencies ?? []).map((dep) => ({ source: dep, target: c.id })),
  );
  return { nodes, links };
}
