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

  /** Node definition extended with optional name for labels */
  interface GraphNode extends Node {
    name?: string;
  }

  /**
   * Eingehende Daten für die Darstellung des KI-Stammbaums.
   * Beide Properties sind optional, um flexibel mit verschiedenen Datenquellen zu arbeiten.
   */
  const props = withDefaults(
    defineProps<{
      nodes?: GraphNode[];
      links?: Link[];
      usePhysics?: boolean;
    }>(),
    {
      usePhysics: true,
    },
  );

  /**
   * Event-Emitter für Kommunikation mit der Parent-Komponente.
   * Wird ausgelöst, wenn ein Benutzer auf einen Knoten klickt.
   */
  const emit = defineEmits<{
    conceptSelected: [node: GraphNode];
  }>();

/** 
 * SVG-Referenz für alle D3-Manipulationen 
 * Wird verwendet, um das DOM-Element direkt mit D3.js zu steuern
 */
const svg = ref<SVGSVGElement | null>(null);
const container = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

/** Aktuelle D3-Simulation zur späteren Bereinigung */
let simulation: d3.Simulation<GraphNode, undefined> | null = null;
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;

  /**
   * Render-Funktion erzeugt die Visualisierung des Stammbaums.
   * Verwendet D3.js für die dynamische SVG-Generierung und Interaktivität.
   */
  function render(): void {
    // Frühzeitiger Ausstieg, falls SVG-Element noch nicht verfügbar
    if (!svg.value || !props.nodes || props.nodes.length === 0) return;

    // Vorherige Simulation beenden
    simulation?.stop();

    // D3-Selektion des SVG-Elements
    const svgSel = d3.select(svg.value);

    // Vorherige Inhalte entfernen für saubere Neuzeichnung
    svgSel.selectAll('*').remove();

    // Dynamische Größenbestimmung basierend auf Container
    const width = svg.value.clientWidth || 600;
    const height = svg.value.clientHeight || 400;

    // ViewBox für responsive Skalierung setzen
    svgSel
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Zeitskala für horizontale Positionierung der Knoten erstellen
    const years = props.nodes.map((d) => d.year);
    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(years) as [number, number])
      .range([40, width - 40]); // Rand von 40px links und rechts

    // Farbskala
    const color = d3.scaleOrdinal(d3.schemeCategory10);

  // Hauptgruppe für alle grafischen Elemente
  const g = svgSel.append('g');

  // Zoom- und Pan-Interaktion auf das gesamte SVG anwenden
  zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 5])
    .on('zoom', (ev) => {
      const { x, k } = ev.transform;
      g.attr('transform', `translate(${x},0) scale(${k})`);
    });
  svgSel.call(zoomBehavior as any);

    // Linien für die Links erstellen
    const link = g
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(props.links ?? [])
      .join('line')
      .attr('stroke-width', 1.5);

    // Gruppe für die Knoten
    const node = g
      .append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(props.nodes, (d: any) => d.id)
      .join('circle')
      .attr('r', 6)
      .attr('fill', (d: any, i) => color(String(i)))
      .style('cursor', 'pointer')
      .on('click', (_event, d) => emit('conceptSelected', d as GraphNode));

    // Textlabels für jeden Knoten hinzufügen
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
      // Simulation mit Kräften initialisieren
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
        .force(
          'x',
          d3.forceX((d: any) => xScale(d.year)),
        )
        .force('y', d3.forceY(height / 2).strength(0.05))
        .on('tick', ticked);
    } else {
      node.attr('cx', (d: any) => xScale(d.year)).attr('cy', height / 2);
      labels.attr('x', (d: any) => xScale(d.year)).attr('y', height / 2 - 12);
      link
        .attr('x1', (d: any) => xScale((d.source as GraphNode).year))
        .attr('y1', height / 2)
        .attr('x2', (d: any) => xScale((d.target as GraphNode).year))
        .attr('y2', height / 2);
    }

    function ticked() {
      link
        .attr('x1', (d: any) => (d.source as GraphNode).x)
        .attr('y1', (d: any) => (d.source as GraphNode).y)
        .attr('x2', (d: any) => (d.target as GraphNode).x)
        .attr('y2', (d: any) => (d.target as GraphNode).y);

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
      labels.attr('x', (d: any) => d.x).attr('y', (d: any) => (d.y ?? 0) - 12);
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

  // Komponente nach dem Mounting rendern

onMounted(() => {
  render();
  resizeObserver = new ResizeObserver(() => render());
  if (container.value) resizeObserver.observe(container.value);
});

// Simulation und ResizeObserver beim Unmount stoppen, um Speicherlecks zu vermeiden
onBeforeUnmount(() => {
  simulation?.stop();
  resizeObserver?.disconnect();
});

  // Bei Änderungen der Props neu rendern
  watch(
    () => [props.nodes, props.links],
    render,
    { deep: true }, // Tiefe Überwachung für verschachtelte Objekte
  );

  watch(
    () => props.usePhysics,
    () => {
      if (!props.usePhysics) simulation?.stop();
      render();
    },
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
    padding: 20px;
    box-sizing: border-box;
  }

  /* Überschrift der Visualisierung */
  .ki-stammbaum-container h2 {
    margin-bottom: 20px;
    color: #333;
    font-size: 1.5rem;
  }

/* SVG-Element für die D3.js-Visualisierung */
.ki-stammbaum-svg {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc; /* Visueller Platzhalter während der Entwicklung */
  border-radius: 4px;
  background-color: #fafafa; /* Leichter Hintergrund für bessere Sichtbarkeit */
  cursor: grab;
}

  /* Styling für Ladetext */
  .ki-stammbaum-svg text {
    font-family: 'Arial', sans-serif;
    fill: #666;
  }
</style>
