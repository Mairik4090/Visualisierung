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

const MAX_HEURISTIC_LINKS_PER_TYPE = 1; // Max links per heuristic type from a single node

export function transformToGraph(concepts: Concept[]): Graph {
  // 1 Nodes erstellen – jedes Konzept wird zum Knoten
  const nodes: Node[] = concepts.map((c) => ({
    id: c.id,
    name: c.name,
    year: +c.year, // Ensure year is a number
    description: c.description,
    category: c.category,
  }));

  const links: Link[] = [];
  // existingLinksSet stores a string representation of each link (e.g., "sourceId-targetId").
  // This is used to prevent duplicate links from being added, whether they come from
  // explicit dependencies or from different heuristic rules.
  // For heuristic links, it also helps in avoiding bi-directional links for the same pair (e.g. A->B and B->A)
  // if the heuristic might suggest both, by checking for both "source-target" and "target-source".
  const existingLinksSet = new Set<string>();

  // 2 Links erstellen – Abhängigkeiten bilden gerichtete Kanten
  concepts.forEach((c) => {
    (c.dependencies ?? []).forEach((dep) => {
      const sourceId = dep;
      const targetId = c.id;
      // For this transform, we assume all referenced dependencies are valid IDs present in the concepts list.
      // D3 itself will also gracefully handle links to missing nodes by not rendering them.
      const linkKey = `${sourceId}-${targetId}`;
      const reverseLinkKey = `${targetId}-${sourceId}`;

      // Add link if it's not a self-loop and neither the link nor its reverse already exists.
      if (
        sourceId !== targetId &&
        !existingLinksSet.has(linkKey) &&
        !existingLinksSet.has(reverseLinkKey)
      ) {
        links.push({ source: sourceId, target: targetId });
        existingLinksSet.add(linkKey); // Add the forward key to the set.
      }
    });
  });

  // 3 Heuristic Link Generation
  // This section attempts to create plausible links between nodes where explicit dependencies might be missing.
  nodes.forEach((currentNode) => {
    // Heuristic 1: Connect to nodes of the Same Category in the Same or Next Year.
    // This can help link contemporary or sequentially related concepts within a domain.
    let h1LinksAdded = 0;
    const h1Candidates = nodes
      .filter(
        (otherNode) =>
          otherNode.id !== currentNode.id &&
          otherNode.category === currentNode.category &&
          (otherNode.year === currentNode.year ||
            otherNode.year === currentNode.year + 1),
      )
      .sort((a, b) => {
        if (a.year !== b.year) {
          return a.year - b.year;
        }
        return a.id.localeCompare(b.id); // Sort by ID for tie-breaking
      });

    for (const targetNode of h1Candidates) {
      if (h1LinksAdded >= MAX_HEURISTIC_LINKS_PER_TYPE) break;

      const sourceNodeId = currentNode.id;
      const targetNodeId = targetNode.id;
      const linkKey = `${sourceNodeId}-${targetNodeId}`;
      const reverseLinkKey = `${targetNodeId}-${sourceNodeId}`;

      // Avoid self-loops (already handled by filter: otherNode.id !== currentNode.id).
      // For links within the same year, ensure a canonical direction (e.g., from smaller ID to larger ID)
      // to prevent creating two links (A->B and B->A) for the same pair due to this heuristic.
      if (
        currentNode.year === targetNode.year &&
        sourceNodeId >= targetNodeId
      ) {
        continue;
      }

      // Add link if it (or its reverse) doesn't already exist.
      if (
        !existingLinksSet.has(linkKey) &&
        !existingLinksSet.has(reverseLinkKey)
      ) {
        links.push({ source: sourceNodeId, target: targetNodeId });
        existingLinksSet.add(linkKey); // Add the forward key.
        h1LinksAdded++;
      }
    }

    // Heuristic 2: Connect to Temporally Close Future Neighbors of the Same Category.
    // This aims to link a concept to its direct successors or closely related future developments.
    let h2LinksAdded = 0;
    const h2Candidates = nodes
      .filter(
        (otherNode) =>
          otherNode.id !== currentNode.id &&
          otherNode.category === currentNode.category &&
          otherNode.year > currentNode.year,
      )
      .sort((a, b) => {
        if (a.year !== b.year) {
          return a.year - b.year; // Sort by year ascending
        }
        return a.id.localeCompare(b.id); // Then by ID for stability
      });

    for (const targetNode of h2Candidates) {
      if (h2LinksAdded >= MAX_HEURISTIC_LINKS_PER_TYPE) break;

      const sourceNodeId = currentNode.id;
      const targetNodeId = targetNode.id;
      const linkKey = `${sourceNodeId}-${targetNodeId}`;
      const reverseLinkKey = `${targetNodeId}-${sourceNodeId}`;

      // Avoid self-loops (already filtered by otherNode.id !== currentNode.id)
      if (
        !existingLinksSet.has(linkKey) &&
        !existingLinksSet.has(reverseLinkKey)
      ) {
        links.push({ source: sourceNodeId, target: targetNodeId });
        existingLinksSet.add(linkKey);
        h2LinksAdded++;
      }
    }
  });

  return { nodes, links };
}
