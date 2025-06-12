
export interface Concept {
 main
  id: string;
  name: string;
  year: number;
  description: string;
  dependencies: string[];
}

export interface Node {
  id: string;
  year: number;
}

export interface Link {
  source: string;
  target: string;
}

export interface Graph {
  nodes: Node[];
  links: Link[];
}
