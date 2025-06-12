<template>
  <div class="timeline-container">
    <svg ref="svg" class="timeline-svg" aria-label="Zeitstrahl" />
    <div class="zoom-controls">
      <button type="button" class="zoom-in" @click="zoomIn">+</button>
      <button type="button" class="zoom-out" @click="zoomOut">−</button>
    </div>
  </div>
</template>

<script setup lang="ts">
  // Vue Composition API Imports
  import { onMounted, watch, ref, nextTick } from 'vue';
  import type { PropType } from 'vue';

  // D3.js Import für Datenvisualisierung
  import * as d3 from 'd3';
  import type { Node } from '@/types/concept';

  /**
   * Timeline-Komponente: gestapelte Balken pro Kategorie, Zoom/Pan auf X-Achse.
   * Emits:
   *  - 'rangeChanged' mit [minJahr, maxJahr]
   *  - 'nodeClickedInTimeline' mit dem angeklickten Knoten
   *  - 'nodeHoveredInTimeline' mit Hover-Informationen
   *  - 'rangeChangeEnd' mit finaler Bereichsänderung
   */

  // Props Definition
  const props = defineProps({
    nodes: { type: Array as PropType<Node[]>, required: true },
    highlightNodeId: { type: String as PropType<string | null>, default: null },
  });

  // Events Definition
  const emit = defineEmits<{
    (e: 'rangeChanged', range: [number, number]): void;
    (e: 'nodeClickedInTimeline', node: Node): void;
    (
      e: 'nodeHoveredInTimeline',
      payload: { node: Node; event: MouseEvent } | null,
    ): void;
    (e: 'rangeChangeEnd', range: [number, number]): void;
  }>();

  // Reactive References
  const svg = ref<SVGSVGElement | null>(null);
  const zoomScale = ref(1); // Zoom-Level für Debugging und externe Kontrolle

  // D3 Skalen und Variablen
  let minYear = 0;
  let maxYear = 0;
  let x: d3.ScaleLinear<number, number>;
  let y: d3.ScaleLinear<number, number>;
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
  let nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  let axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  let categories: string[] = [];
  let color: d3.ScaleOrdinal<string, string>;

  /**
   * Zeichnet Knoten und Achse unter gegebenem Zoom-Transform
   * @param transform - D3 Zoom Transform Objekt
   */
  function draw(transform: d3.ZoomTransform = d3.zoomIdentity): void {
    if (!svg.value || !props.nodes) return;

    // Angepasste X-Skala basierend auf Zoom-Transform
    const zx = transform.rescaleX(x);

    // Konstante für Balken-Dimensionen
    const barWidth = 5;
    const barHeight = 10;

    // Knoten mit D3 Data Join Pattern zeichnen
    nodesGroup
      .selectAll('rect')
      .data(props.nodes, (d: any) => d.id) // Eindeutige ID als Schlüssel
      .join(
        // Enter: Neue Knoten hinzufügen
        (enter) =>
          enter
            .append('rect')
            .attr('x', (d: Node) => zx(d.year) - barWidth / 2)
            .attr('y', y(0) - barHeight / 2)
            .attr('width', barWidth)
            .attr('height', barHeight)
            .style('opacity', 0) // Startet transparent
            .attr('fill', (d: Node) => color(d.category))
            .attr('stroke', (d: Node) =>
              d.id === props.highlightNodeId ? 'black' : color(d.category),
            )
            .attr('stroke-width', (d: Node) =>
              d.id === props.highlightNodeId ? 2 : 1,
            )
            .style('cursor', 'pointer')
            // Event Handler für Interaktionen
            .on('click', (event: MouseEvent, d: Node) => {
              emit('nodeClickedInTimeline', d);
            })
            .on('mouseover', (event: MouseEvent, d: Node) => {
              emit('nodeHoveredInTimeline', { node: d, event });
            })
            .on('mouseout', () => {
              emit('nodeHoveredInTimeline', null);
            })
            // Einblend-Animation
            .call((enter) =>
              enter.transition().duration(500).style('opacity', 1),
            ),

        // Update: Bestehende Knoten aktualisieren
        (update) =>
          update.call((update) =>
            update
              .transition()
              .duration(300)
              .attr('x', (d: Node) => zx(d.year) - barWidth / 2)
              .attr('fill', (d: Node) => color(d.category))
              .attr('stroke', (d: Node) =>
                d.id === props.highlightNodeId ? 'black' : color(d.category),
              )
              .attr('stroke-width', (d: Node) =>
                d.id === props.highlightNodeId ? 2 : 1,
              ),
          ),

        // Exit: Entfernte Knoten ausblenden
        (exit) =>
          exit.call((exit) =>
            exit.transition().duration(500).style('opacity', 0).remove(),
          ),
      );

    // X-Achse aktualisieren
    axisGroup.call(d3.axisBottom(zx).ticks(5).tickFormat(d3.format('d')));

    // Bereichsänderung emit
    emit('rangeChanged', zx.domain() as [number, number]);
  }

  /**
   * Initialer Aufbau der SVG, Skalen, Gruppen und Zoom-Behavior
   */
  function render(): void {
    if (!svg.value || !props.nodes.length) return;

    // SVG auswählen und leeren
    const svgSel = d3.select(svg.value);
    svgSel.selectAll('*').remove();

    // Dimensionen und Margins definieren
    const width = svg.value.clientWidth || 600;
    const height = svg.value.clientHeight || 100;
    const margin = { top: 10, right: 20, bottom: 20, left: 20 };

    // Min/Max Jahr aus Daten extrahieren
    const years = props.nodes.map((d) => d.year);
    [minYear, maxYear] = d3.extent(years) as [number, number];

    // Fallback für ungültige Jahre
    if (minYear === undefined || maxYear === undefined) {
      minYear = new Date().getFullYear() - 10;
      maxYear = new Date().getFullYear();
    }

    // Kategorien extrahieren und Farbskala erstellen
    categories = Array.from(new Set(props.nodes.map((d) => d.category)));
    color = d3
      .scaleOrdinal<string>()
      .domain(categories)
      .range(d3.schemeCategory10);

    // X-Skala (Zeitachse) definieren
    x = d3
      .scaleLinear()
      .domain([minYear, maxYear + 1]) // +1 um Randknoten vollständig anzuzeigen
      .range([margin.left, width - margin.right]);

    // Y-Skala (vereinfacht für vertikale Zentrierung)
    y = d3
      .scaleLinear()
      .domain([-1, 1]) // Beliebige Domain für Zentrierung
      .range([height - margin.bottom, margin.top]);

    // SVG Gruppen erstellen
    nodesGroup = svgSel.append('g').attr('class', 'nodes');
    axisGroup = svgSel
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height - margin.bottom})`);

    // Zoom-Behavior konfigurieren
    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15]) // Min/Max Zoom-Level
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      // Zoom Event Handler
      .on('zoom', (ev) => {
        zoomScale.value = ev.transform.k;
        draw(ev.transform);
      })
      // Zoom End Event Handler
      .on('end', (ev) => {
        const finalXScale = ev.transform.rescaleX(x);
        emit('rangeChangeEnd', finalXScale.domain() as [number, number]);
      });

    // Zoom-Behavior an SVG binden
    svgSel.call(zoomBehavior as any);

    // Initiales Zeichnen
    draw();
  }

  /**
   * Zoomt programmatisch in die Timeline hinein
   */
  function zoomIn(): void {
    if (svg.value && zoomBehavior) {
      zoomBehavior.scaleBy(d3.select(svg.value), 1.2);
    }
  }

  /**
   * Zoomt programmatisch aus der Timeline heraus
   */
  function zoomOut(): void {
    if (svg.value && zoomBehavior) {
      zoomBehavior.scaleBy(d3.select(svg.value), 1 / 1.2);
    }
  }

  /**
   * Exposed-Methode, um von außen auf einen bestimmten Zoom zu wechseln
   * @param scale - Gewünschter Zoom-Level
   */
  function applyZoom(scale: number): void {
    if (svg.value && zoomBehavior) {
      d3.select(svg.value).call(zoomBehavior.scaleTo as any, scale);
    }
  }

  // Methoden für Parent-Komponente verfügbar machen
  defineExpose({ applyZoom, zoomScale });

  // Lifecycle Hooks
  onMounted(render);

  // Reaktive Überwachung der Props
  watch(
    () => props.nodes,
    async () => {
      render();
      await nextTick();
    },
    { deep: true },
  );
</script>

<style scoped>
  .timeline-container {
    position: relative;
  }

  .timeline-svg {
    width: 100%;
    height: 100px;
    cursor: grab;
  }

  .zoom-controls {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    display: flex;
    flex-direction: column;
  }

  .zoom-controls button {
    width: 1.5rem;
    height: 1.5rem;
    margin-bottom: 0.25rem;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
  }
</style>
