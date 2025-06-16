export interface Concept {
  id: string;
  name: string;
  year: number; // Primary year associated with the concept, often year of origin or publication.
  description: string; // Detailed description of the concept.
  /** Classification used for grouping, coloring, and filtering. e.g., "algorithm", "concept", "technology" */
  category: string;
  /**
   * Array of IDs of other concepts that this concept depends on (i.e., was influenced by).
   * For visualization, a link will typically be drawn from a dependency (source) to this concept (target).
   * Example: If Concept A has Concept B in its dependencies, the link is B -> A.
   */
  dependencies: string[];
  // Optional fields that might exist in the raw JSON data
  contributions?: string;
  references?: Array<{ title: string; url?: string }>;
  influenced?: string[]; // IDs of concepts this concept influenced (opposite of dependencies)
  tags?: string[];
  year_of_origin?: number; // Explicit field for year of origin if 'year' serves a different purpose.
  short_description?: string; // A shorter version of the description, often used for tooltips.
}

/**
 * Represents a node in the D3 graph visualization.
 * This is often derived from a `Concept` but might be simplified or augmented
 * for display purposes (e.g., by clustering).
 */
export interface Node {
  id: string; // Unique identifier for the node.
  /** Display name of the concept. */
  name?: string;
  /** The primary year associated with this node for positioning on the x-axis. */
  year: number;
  /** Optional detailed description, often shown in tooltips or detail views. */
  description?: string;
  /** Category for coloring, grouping, and filtering. */
  category?: string;
  // Properties specific to D3 or graph rendering, often added during transformation.
  x?: number;
  y?: number;
  fx?: number | null; // Fixed x-position for D3 force simulation.
  fy?: number | null; // Fixed y-position for D3 force simulation.
  isCluster?: boolean; // True if this node represents a cluster of other nodes.
  count?: number; // Number of original nodes this visual node represents (1 if not a cluster).
  childNodes?: Node[]; // If it's a cluster, the original nodes it contains.
}

/**
 * Represents a link in the D3 graph visualization.
 * Connects two nodes, identified by their string IDs.
 * The direction is from source to target (source -> target).
 */
export interface Link {
  source: string; // ID of the source node.
  target: string; // ID of the target node.
}

/** Represents the overall graph structure containing nodes and links for D3. */
export interface Graph {
  nodes: Node[];
  links: Link[];
}
