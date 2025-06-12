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
  import { onMounted, watch, ref, nextTick, defineExpose, type PropType } from 'vue';
  import * as d3 from 'd3';
  import type { Node } from '@/types/concept';

  /**
   * Timeline-Komponente: gestapelte Balken pro Kategorie, Zoom/Pan auf X-Achse.
   * Emits:
   *  - 'rangeChanged' mit [minJahr, maxJahr]
   *  - 'yearSelected' mit dem ausgewählten Jahr
   */
  const props = defineProps({
    nodes: { type: Array as PropType<Node[]>, required: true },
    highlightNodeId: { type: String as PropType<string | null>, default: null }
  });
  const emit = defineEmits<{
    (e: 'rangeChanged', range: [number, number]): void;
    (e: 'nodeClickedInTimeline', node: Node): void;
    (e: 'nodeHoveredInTimeline', payload: { node: Node; event: MouseEvent } | null): void;
    (e: 'rangeChangeEnd', range: [number, number]): void; // Add this line
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

    // const barWidth = Math.max(1, zx(minYear + currentBinSize) - zx(minYear)); // Removed barWidth

    const barWidth = 5;
    const barHeight = 10;

    // nodesGroup.selectAll('*').remove(); // Clear previous nodes before redrawing - simple approach

    const rects = nodesGroup
      .selectAll('rect')
      .data(props.nodes, (d: any) => d.id); // Use node id as key

    rects.exit()
      .transition().duration(500)
      .style('opacity', 0)
      .remove();

    rects.enter()
      .append('rect')
      .attr('x', (d: Node) => zx(d.year) - barWidth / 2)
      .attr('y', y(0) - barHeight / 2)
      .attr('width', barWidth)
      .attr('height', barHeight)
      .attr('fill', (d: Node) => color(d.category))
      .attr('stroke', (d: Node) => d.id === props.highlightNodeId ? 'black' : color(d.category))
      .attr('stroke-width', (d: Node) => d.id === props.highlightNodeId ? 2 : 1)
      .style('cursor', 'pointer')
      .style('opacity', 0)
      .on('click', (event: MouseEvent, d: Node) => {
        emit('nodeClickedInTimeline', d);
      })
      .on('mouseover', (event: MouseEvent, d: Node) => {
        emit('nodeHoveredInTimeline', { node: d, event });
      })
      .on('mouseout', () => {
        emit('nodeHoveredInTimeline', null);
      })
      .transition().duration(500)
      .style('opacity', 1);

    rects.transition().duration(300)
      .attr('x', (d: Node) => zx(d.year) - barWidth / 2)
      .attr('y', y(0) - barHeight / 2) // y position doesn't change on zoom, but x does
      .attr('fill', (d: Node) => color(d.category)) // Color could change if categories are dynamic
      .attr('stroke', (d: Node) => d.id === props.highlightNodeId ? 'black' : color(d.category))
      .attr('stroke-width', (d: Node) => d.id === props.highlightNodeId ? 2 : 1);

    // The following part handles existing elements (update selection from .join)
    // No, the above rects.transition().duration(300) is the update selection.
    // The .join('rect') syntax is more modern and handles enter/update/exit.
    // Let's re-do this part using the .join() syntax for clarity and correctness.

    // --- Re-doing the join logic ---
    nodesGroup
      .selectAll('rect')
      .data(props.nodes, (d: any) => d.id) // Use node id as key
      .join(
        enter => enter.append('rect')
          .attr('x', (d: Node) => zx(d.year) - barWidth / 2)
          .attr('y', y(0) - barHeight / 2)
          .attr('width', barWidth)
          .attr('height', barHeight)
          .style('opacity', 0)
          .attr('fill', (d: Node) => color(d.category))
          .attr('stroke', (d: Node) => d.id === props.highlightNodeId ? 'black' : color(d.category))
          .attr('stroke-width', (d: Node) => d.id === props.highlightNodeId ? 2 : 1)
          .style('cursor', 'pointer')
          .on('click', (event: MouseEvent, d: Node) => {
            emit('nodeClickedInTimeline', d);
          })
          .on('mouseover', (event: MouseEvent, d: Node) => {
            emit('nodeHoveredInTimeline', { node: d, event });
          })
          .on('mouseout', () => {
            emit('nodeHoveredInTimeline', null);
          })
          .call(enter => enter.transition().duration(500).style('opacity', 1)),
        update => update
          .call(update => update.transition().duration(300)
            .attr('x', (d: Node) => zx(d.year) - barWidth / 2)
            // y, width, height don't change on typical updates unless barHeight/barWidth become dynamic
            .attr('fill', (d: Node) => color(d.category)) // Potentially update color
            .attr('stroke', (d: Node) => d.id === props.highlightNodeId ? 'black' : color(d.category))
            .attr('stroke-width', (d: Node) => d.id === props.highlightNodeId ? 2 : 1)
          ),
        exit => exit
          .call(exit => exit.transition().duration(500).style('opacity', 0).remove())
      );
    // Ensure event handlers are on the selection that includes new and updated elements.
    // The .on() calls are correctly placed within the .join() 'enter' selection.
    // For 'update' selection, if event handlers could change or need to be re-bound,
    // they might need to be specified there too, but typically they persist.

    /* This is the old circle code, for reference during refactoring
      .selectAll('circle')
      .data(props.nodes, (d: any) => d.id) // Use node id as key
      .join('circle')
      .attr('cx', (d: Node) => zx(d.year))
      .attr('cy', y(0)) // Simple vertical centering for now (y(0) will be middle)
      .attr('r', (d: Node) => d.id === props.highlightNodeId ? 6 : 4) // Adjust radius
      .attr('fill', (d: Node) => color(d.category))
      .attr('stroke', (d: Node) => d.id === props.highlightNodeId ? 'black' : 'none') // Add stroke
      .attr('stroke-width', (d: Node) => d.id === props.highlightNodeId ? 2 : 0) // Add stroke width
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
      })
      .on('end', (ev) => { // Add this 'end' event handler
        // ev.transform.rescaleX(x) should give the final scale
        const finalXScale = ev.transform.rescaleX(x);
        emit('rangeChangeEnd', finalXScale.domain() as [number, number]);
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
