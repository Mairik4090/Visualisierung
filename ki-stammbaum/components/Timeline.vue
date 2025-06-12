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
  import { onMounted, watch, ref, nextTick, defineExpose } from 'vue';
  import * as d3 from 'd3';
  import type { Node } from '@/types/concept';

  /**
   * Timeline-Komponente: gestapelte Balken pro Kategorie, Zoom/Pan auf X-Achse.
   * Emits:
   *  - 'rangeChanged' mit [minJahr, maxJahr]
   *  - 'yearSelected' mit dem ausgewählten Jahr
   */
  const props = defineProps<{ nodes: Node[] }>();
  const emit = defineEmits<{
    (e: 'rangeChanged', range: [number, number]): void;
    (e: 'nodeClickedInTimeline', node: Node): void;
    (e: 'nodeHoveredInTimeline', payload: { node: Node; event: MouseEvent } | null): void;
  }>();

  const svg = ref<SVGSVGElement | null>(null);
  const zoomScale = ref(1); // Still useful for controlling zoom level if needed elsewhere or for debugging

  let minYear = 0;
  let maxYear = 0;
  let x: d3.ScaleLinear<number, number>;
  let y: d3.ScaleLinear<number, number>; // Will be simplified
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
  let nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>; // Renamed from barsGroup
  let axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  let categories: string[] = [];
  let color: d3.ScaleOrdinal<string, string>;

  // Removed binSizeForScale and binnedData functions as they are no longer needed

  /** Zeichnet Knoten und Achse unter gegebenem Zoom-Transform */
  function draw(transform: d3.ZoomTransform = d3.zoomIdentity): void {
    if (!svg.value || !props.nodes) return; // Check props.nodes as well
    const zx = transform.rescaleX(x);
    // const barWidth = Math.max(1, zx(minYear + currentBinSize) - zx(minYear)); // Removed barWidth

    // Logic for drawing circles instead of bars will go here
    // For now, just update axis and emit range
    nodesGroup.selectAll('*').remove(); // Clear previous nodes before redrawing - simple approach

    nodesGroup
      .selectAll('circle')
      .data(props.nodes, (d: any) => d.id) // Use node id as key
      .join('circle')
      .attr('cx', (d: Node) => zx(d.year))
      .attr('cy', y(0)) // Simple vertical centering for now (y(0) will be middle)
      .attr('r', 4) // Fixed radius
      .attr('fill', (d: Node) => color(d.category))
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d: Node) => {
        emit('nodeClickedInTimeline', d);
      })
      .on('mouseover', (event: MouseEvent, d: Node) => {
        emit('nodeHoveredInTimeline', { node: d, event });
      })
      .on('mouseout', () => {
        emit('nodeHoveredInTimeline', null);
      });

    axisGroup.call(d3.axisBottom(zx).ticks(5).tickFormat(d3.format('d')));
    emit('rangeChanged', zx.domain() as [number, number]);
  }

  /** Initialer Aufbau der SVG, Skalen, Gruppen und Zoom-Behavior */
  function render(): void {
    if (!svg.value || !props.nodes.length) return;

    const svgSel = d3.select(svg.value);
    svgSel.selectAll('*').remove();

    const width = svg.value.clientWidth || 600;
    const height = svg.value.clientHeight || 100;
    const margin = { top: 10, right: 20, bottom: 20, left: 20 };

    const years = props.nodes.map((d) => d.year);
    [minYear, maxYear] = d3.extent(years) as [number, number];
    if (minYear === undefined || maxYear === undefined) {
        // Handle case with no valid years, perhaps set a default range or return
        minYear = new Date().getFullYear() - 10;
        maxYear = new Date().getFullYear();
    }


    categories = Array.from(new Set(props.nodes.map((d) => d.category)));
    color = d3
      .scaleOrdinal<string>()
      .domain(categories)
      .range(d3.schemeCategory10);

    x = d3
      .scaleLinear()
      .domain([minYear, maxYear + 1]) // Add +1 to maxYear to ensure last year's nodes are not cut off at the edge
      .range([margin.left, width - margin.right]);

    // currentBinSize = binSizeForScale(zoomScale.value); // Removed
    // data = binnedData(currentBinSize); // Removed
    // stackData = d3.stack().keys(categories)(data); // Removed

    // Simplified Y scale - centers all nodes vertically
    y = d3
      .scaleLinear()
      .domain([-1, 1]) // Arbitrary domain for centering, 0 will be the middle
      .range([height - margin.bottom, margin.top]); // y(0) will be vertical center

    nodesGroup = svgSel.append('g').attr('class', 'nodes'); // Renamed from barsGroup
    axisGroup = svgSel
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height - margin.bottom})`);

    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15]) // Increased max zoom slightly
      .translateExtent([
        [0, 0], // Allow panning to full extent of data with some margin
        [width, height],
      ])
      .on('zoom', (ev) => {
        zoomScale.value = ev.transform.k;
        // const newSize = binSizeForScale(zoomScale.value); // Removed
        // if (newSize !== currentBinSize) { // Removed block
        //   currentBinSize = newSize;
        //   data = binnedData(currentBinSize);
        //   stackData = d3.stack().keys(categories)(data);
        //   y.domain([0, d3.max(stackData, (s) => d3.max(s, (d) => d[1])) ?? 1]); // y domain is now fixed
        //   nodesGroup.selectAll('*').remove(); // Will be handled in draw
        // }
        draw(ev.transform);
      });

    svgSel.call(zoomBehavior as any);
    draw();
  }

  /** Zoomt programmatisch in die Timeline hinein */
  function zoomIn(): void {
    if (svg.value && zoomBehavior) {
      zoomBehavior.scaleBy(d3.select(svg.value), 1.2);
    }
  }

  /** Zoomt programmatisch aus der Timeline heraus */
  function zoomOut(): void {
    if (svg.value && zoomBehavior) {
      zoomBehavior.scaleBy(d3.select(svg.value), 1 / 1.2);
    }
  }

  /** Exposed-Methode, um von außen auf einen bestimmten Zoom zu wechseln */
  function applyZoom(scale: number): void {
    if (svg.value && zoomBehavior) {
      d3.select(svg.value).call(zoomBehavior.scaleTo as any, scale);
    }
  }

  defineExpose({ applyZoom, zoomScale });

  onMounted(render);
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
