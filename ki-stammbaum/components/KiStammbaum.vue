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
      <!-- Fallback-Anzeige während des Ladens -->
      <text v-if="!props.nodes || props.nodes.length === 0" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">
        Visualisierung lädt...
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import * as d3 from 'd3';
import type { Node, Link } from '@/types/concept';
import { useStammbaumStore } from '@/stores/stammbaum';

/** Erweiterte Knotendefinition für Labels */
interface GraphNode extends Node {
  name?: string;
}

/** Props für Knoten und Links */
const props = defineProps<{
  nodes?: GraphNode[];
  links?: Link[];
}>();

/** Event-Emitter für Konzeptauswahl */
const emit = defineEmits<{
  conceptSelected: [node: GraphNode];
}>();

/** SVG-Referenz für D3-Manipulationen */
const svg = ref<SVGSVGElement | null>(null);

/** Pinia-Store-Instanz holen */
const store = useStammbaumStore();

/** Haupt-Render-Funktion */
function render(): void {
  if (!svg.value || !props.nodes || props.nodes.length === 0) return;

  const svgSel = d3.select(svg.value);
  svgSel.selectAll('*').remove();

  const width = svg.value.clientWidth || 600;
  const height = svg.value.clientHeight || 400;

  svgSel
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const years = props.nodes.map((d) => d.year);
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(years) as [number, number])
    .range([40, width - 40]);

  const y = height / 2;
  const g = svgSel.append('g');

  // Knoten zeichnen
  g.selectAll('circle')
    .data(props.nodes, (d: any) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.year))
    .attr('cy', y)
    .attr('r', 6)
    .attr('fill', '#1f77b4')
    .style('cursor', 'pointer')
    .on('click', (_event, d) => handleNodeClick(d as GraphNode));

  // Labels zeichnen
  g.selectAll('text.label')
    .data(props.nodes, (d: any) => d.id)
    .join('text')
    .attr('class', 'label')
    .attr('x', (d) => xScale(d.year))
    .attr('y', y - 12)
    .attr('text-anchor', 'middle')
    .text((d) => d.name ?? d.id)
    .style('font-size', '10px')
    .style('fill', '#333');

  // TODO: Links zwischen Knoten basierend auf props.links hinzufügen
}

/** Klick-Handler für Knoten */
function handleNodeClick(node: GraphNode): void {
  store.setConceptId(node.id);
  emit('conceptSelected', node);
}

// Watcher für Store-Filter: bei Änderung neu rendern
watch(
  () => store.filters,
  () => {
    render();
  },
  { deep: true },
);

// Watcher für ausgewähltes Konzept im Store
watch(
  () => store.conceptId,
  (id) => {
    if (id) {
      console.log('Ausgewähltes Konzept ID:', id);
    }
  },
);

// Initiales Rendering nach Mount
onMounted(() => {
  console.log('KiStammbaum Komponente mounted. SVG-Element:', svg.value);
  render();
});

// Watcher für prop-Änderungen
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
}

.ki-stammbaum-svg text {
  font-family: 'Arial', sans-serif;
  fill: #666;
}
</style>
