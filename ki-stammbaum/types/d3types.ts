import * as d3 from 'd3';
import type { Node } from './concept';

export interface GraphNode extends Node, d3.SimulationNodeDatum {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  index?: number;
  fx?: number | null;
  fy?: number | null;
  previous_x?: number;
  previous_y?: number;
  isCluster?: boolean;
  count?: number;
  childNodes?: Node[];
  categoriesInCluster?: string[];
  categoryColorsInCluster?: string[];
}
