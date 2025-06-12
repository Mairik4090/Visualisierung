<template>
  <div class="ki-stammbaum-container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg
      ref="svg"
      class="ki-stammbaum-svg"
      aria-label="KI-Stammbaum Visualisierung"
      role="img"
    >
      <title>KI-Stammbaum Visualisierung</title>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import * as d3 from 'd3';
import type { Node, Link } from '@/types/concept';

/** Node definition extended with optional name for labels */
interface GraphNode extends Node {
  name?: string;
}

/**
 * Eingehende Daten für die Darstellung des KI-Stammbaums.
 */
const props = defineProps<{
  nodes: GraphNode[];
  links: Link[];
}>();

/**
 * Event-Emitter für Kommunikation mit der Parent-Komponente.
 */
const emit = defineEmits<{
  conceptSelected: [node: GraphNode];
}>();

/** SVG-Referenz für alle D3-Manipulationen */
const svg = ref<SVGSVGElement | null>(null);

/**
 * Render-Funktion erzeugt die Visualisierung des Stammbaums.
 */
function render(): void {
  if (!svg.value) return;

  const svgSel = d3.select(svg.value);
  svgSel.selectAll('*').remove();

  const width = svg.value.clientWidth || 600;
  const height = svg.value.clientHeight || 400;

  svgSel
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  if (props.nodes.length === 0) return;

  const years = props.nodes.map((d) => d.year);
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(years) as [number, number])
    .range([40, width - 40]);

  const y = height / 2;
  const g = svgSel.append('g');

  g.selectAll('circle')
    .data(props.nodes, (d: any) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.year))
    .attr('cy', y)
    .attr('r', 6)
    .attr('fill', '#1f77b4')
    .on('click', (_event, d) => emit('conceptSelected', d as GraphNode));

  g.selectAll('text')
    .data(props.nodes, (d: any) => d.id)
    .join('text')
    .attr('x', (d) => xScale(d.year))
    .attr('y', y - 12)
    .attr('text-anchor', 'middle')
    .text((d) => d.name ?? d.id);
}

onMounted(render);
watch(
  () => [props.nodes, props.links],
  render,
  { deep: true },
);
</script>

<style scoped>
/* Hauptcontainer für die Stammbaum-Visualisierung */
.ki-stammbaum-container {
  width: 100%;
  height: 80vh; /* Beispielhöhe - anpassbar je nach Layout-Anforderungen */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* SVG-Element für die D3.js-Visualisierung */
.ki-stammbaum-svg {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc; /* Visueller Platzhalter während der Entwicklung */
}
</style>