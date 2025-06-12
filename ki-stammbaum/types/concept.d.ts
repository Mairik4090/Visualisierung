export interface Concept {
  id: string;
  name: string;
  year: number;
  description: string;
  dependencies: string[];
}

export interface Node {
  id: string;
  /** Display name of the concept */
  name: string;
  year: number;
  /** Optional description shown in tooltips */
  description?: string;
}

export interface Link {
  source: string;
  target: string;
}

export interface Graph {
  nodes: Node[];
  links: Link[];
}
