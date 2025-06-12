<template>
  <div class="ki-stammbaum-container" ref="container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg
      ref="svg"
      class="ki-stammbaum-svg"
      aria-label="KI-Stammbaum Visualisierung"
      role="img"
    >
      <title>KI-Stammbaum Visualisierung</title>
      <!-- Fallback-Anzeige während des Ladens -->
      <text
        v-if="!nodes || nodes.length === 0"
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
      >
        Visualisierung lädt...
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, withDefaults } from 'vue';
import * as d3 from 'd3';
import type { Node, Link } from '@/types/concept';

interface GraphNode extends Node {
  name?: string;
}

const props = withDefaults(
  defineProps<{
    nodes?: GraphNode[];
    links?: Link[];
    usePhysics?: boolean;
  }>(),
  { usePhysics: true },
);

const emit = defineEmits<{
  conceptSelected: [node: GraphNode];
}>();

const svg = ref<SVGSVGElement | null>(null);
const container = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let simulation: d3.Simulation<GraphNode, undefined> | null = null;
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;

function render(): void {
  if (!svg.value || !props.nodes || props.nodes.length === 0) return;
  simulation?.stop();

  const svgSel = d3.select(svg.value);
  svgSel.selectAll('*').remove();

  const width = svg.value.clientWidth || 600;
  const height = svg.value.clientHeight || 400;

  svgSel
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // X-Skala nach Jahr
  const years = props.nodes.map((d) => d.year);
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(years) as [number, number])
    .range([40, width - 40]);

  // Kategorien und Y-Skala
  const categories = Array.from(new Set(props.nodes.map((d) => d.category)));
  const yScale = d3
    .scalePoint<string>()
    .domain(categories)
    .range([40, height - 40]);

  // Farbskala pro Kategorie
  const color = d3
    .scaleOrdinal<string>()
    .domain(categories)
    .range(d3.schemeCategory10);

  // Cluster-Offsets berechnen
  const groupCounts = new Map<string, number>();
  props.nodes.forEach((n) => {
    const key = `${n.year}-${n.category}`;
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  });
  const groupIndex = new Map<string, number>();
  props.nodes.forEach((n) => {
    const key = `${n.year}-${n.category}`;
    const idx = groupIndex.get(key) ?? 0;
    groupIndex.set(key, idx + 1);
    const offset = idx - (groupCounts.get(key)! - 1) / 2;
    (n as any)._offset = offset;
    (n as any)._x = xScale(n.year) + offset * 12;
    (n as any)._y = yScale(n.category!);
  });

  // Gruppe für alles
  const g = svgSel.append('g');

  // Zoom-/Pan-Verhalten
  zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 5])
    .on('zoom', (ev) => {
      g.attr('transform', ev.transform.toString());
    });
  svgSel.call(zoomBehavior as any);

  // Links zeichnen
  const link = g
    .append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(props.links ?? [])
    .join('line')
    .attr('stroke-width', 1.5);

  // Knoten zeichnen
  const node = g
    .append('g')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .selectAll('circle')
    .data(props.nodes, (d: any) => d.id)
    .join('circle')
    .attr('r', 6)
    .attr('fill', (d: any) => color(d.category!))
    .style('cursor', 'pointer')
    .on('click', (_e, d) => emit('conceptSelected', d as GraphNode));

  // Labels hinzufügen
  const labels = g
    .append('g')
    .selectAll('text')
    .data(props.nodes, (d: any) => d.id)
    .join('text')
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', '#333')
    .text((d) => d.name ?? d.id);

  node.call(
    d3
      .drag<SVGCircleElement, GraphNode>()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded),
  );

  if (props.usePhysics) {
    simulation = d3
      .forceSimulation(props.nodes)
      .force(
        'link',
        d3
          .forceLink(props.links ?? [])
          .id((d: any) => d.id)
          .distance(60),
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('x', d3.forceX((d: any) => (d as any)._x))
      .force('y', d3.forceY((d: any) => (d as any)._y).strength(0.1))
      .on('tick', ticked);
  } else {
    node
      .attr('cx', (d: any) => (d as any)._x)
      .attr('cy', (d: any) => (d as any)._y);
    labels
      .attr('x', (d: any) => (d as any)._x)
      .attr('y', (d: any) => (d as any)._y - 12);
    link
      .attr('x1', (d: any) => (d.source as any)._x)
      .attr('y1', (d: any) => (d.source as any)._y)
      .attr('x2', (d: any) => (d.target as any)._x)
      .attr('y2', (d: any) => (d.target as any)._y);
  }

  function ticked() {
    link
      .attr('x1', (d: any) => (d.source as GraphNode).x)
      .attr('y1', (d: any) => (d.source as GraphNode).y)
      .attr('x2', (d: any) => (d.target as GraphNode).x)
      .attr('y2', (d: any) => (d.target as GraphNode).y);
    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);
    labels
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => (d.y ?? 0) - 12);
  }

  function dragStarted(event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>) {
    event.sourceEvent?.stopPropagation();
    if (!event.active) simulation?.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>) {
    event.sourceEvent?.stopPropagation();
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragEnded(event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>) {
    event.sourceEvent?.stopPropagation();
    if (!event.active) simulation?.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
}

onMounted(() => {
  render();
  resizeObserver = new ResizeObserver(() => render());
  if (container.value) resizeObserver.observe(container.value);
});

onBeforeUnmount(() => {
  simulation?.stop();
  resizeObserver?.disconnect();
});

watch(
  () => [props.nodes, props.links],
  render,
  { deep: true },
);

watch(() => props.usePhysics, () => {
  if (!props.usePhysics) simulation?.stop();
  render();
});
</script>

<style scoped>
.ki-stammbaum-container {
  width: 100%;
  height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.ki-stammbaum-container h2 {
  margin-bottom: 20px;
  color: #333;
  font-size: 1.5rem;
}

.ki-stammbaum-svg {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fafafa;
  cursor: grab;
}

.ki-stammbaum-svg text {
  font-family: 'Arial', sans-serif;
  fill: #666;
}
</style>
