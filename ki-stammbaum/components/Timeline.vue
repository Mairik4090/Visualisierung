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
import { onMounted, onBeforeUnmount, watch, ref, nextTick, defineExpose } from 'vue';
import * as d3 from 'd3';
import type { Node } from '@/types/concept';

/**
 * Timeline component visualizing the distribution of nodes over the years.
 * Allows zooming and panning on the x-axis.
 * Emits:
 *  - 'rangeChanged' with the current visible [minYear, maxYear]
 *  - 'yearSelected' when a bar is clicked
 */
const props = defineProps<{ nodes: Node[] }>();
const emit = defineEmits<{
  (e: 'rangeChanged', range: [number, number]): void;
  (e: 'yearSelected', year: number): void;
}>();

const svg = ref<SVGSVGElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

/** Aktueller Zoomfaktor der Timeline */
const zoomScale = ref(1);

let minYear = 0;
let maxYear = 0;
let x: d3.ScaleLinear<number, number>;
let y: d3.ScaleLinear<number, number>;
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
let barsGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
let axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
let data: { year: number; count: number }[] = [];
let currentBinSize = 1;

function binSizeForScale(scale: number): number {
  if (scale < 1.5) return 10; // Jahrzehnt
  if (scale < 3) return 5;   // Fünf-Jahres-Intervall
  return 1;                   // Einzelnes Jahr
}

function binnedData(binSize: number): { year: number; count: number }[] {
  const counts = d3.rollups(
    props.nodes,
    v => v.length,
    d => Math.floor(d.year / binSize) * binSize
  );
  const countMap = new Map(counts);
  const start = Math.floor(minYear / binSize) * binSize;
  const end = Math.ceil((maxYear + 1) / binSize) * binSize - 1;
  const result: { year: number; count: number }[] = [];
  for (let yv = start; yv <= end; yv += binSize) {
    result.push({ year: yv, count: countMap.get(yv) ?? 0 });
  }
  return result;
}

function draw(transform: d3.ZoomTransform = d3.zoomIdentity): void {
  if (!svg.value) return;

  const zx = transform.rescaleX(x);
  const barWidth = Math.max(1, zx(minYear + currentBinSize) - zx(minYear));

  const rects = barsGroup
    .selectAll<SVGRectElement, { year: number; count: number }>('rect')
    .data(data, d => d.year as any);

  // Enter + Update + Exit
  rects.join('rect')
    .attr('fill', '#69b3a2')
    .on('click', (_, d) => emit('yearSelected', d.year));

  rects
    .attr('x', d => zx(d.year + currentBinSize / 2) - barWidth / 2)
    .attr('width', barWidth)
    .attr('y', d => y(d.count))
    .attr('height', d => y(0) - y(d.count));

  axisGroup.call(d3.axisBottom(zx).ticks(5).tickFormat(d3.format('d')));

  emit('rangeChanged', zx.domain() as [number, number]);
}

function render(): void {
  if (!svg.value || !props.nodes.length) return;

  const svgSel = d3.select(svg.value);
  svgSel.selectAll('*').remove();

  const width = svg.value.clientWidth || 600;
  const height = svg.value.clientHeight || 100;
  const margin = { top: 10, right: 20, bottom: 20, left: 20 };

  const years = props.nodes.map(d => d.year);
  [minYear, maxYear] = d3.extent(years) as [number, number];

  x = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([margin.left, width - margin.right]);

  currentBinSize = binSizeForScale(zoomScale.value);
  data = binnedData(currentBinSize);

  y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) ?? 1])
    .range([height - margin.bottom, margin.top]);

  barsGroup = svgSel.append('g').attr('class', 'bars');
  axisGroup = svgSel.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height - margin.bottom})`);

  // Zoom- und Pan-Interaktion
  zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 8])
    .translateExtent([
      [margin.left, 0],
      [width - margin.right, height],
    ])
    .on('zoom', ev => {
      zoomScale.value = ev.transform.k;
      const newSize = binSizeForScale(zoomScale.value);
      if (newSize !== currentBinSize) {
        currentBinSize = newSize;
        data = binnedData(currentBinSize);
        y.domain([0, d3.max(data, d => d.count) ?? 1]);
        barsGroup.selectAll('rect').remove();
      }
      draw(ev.transform);
    });

  svgSel.call(zoomBehavior as any);
  draw();
}

/** Zoomt den Zeitstrahl hinein */
function zoomIn(): void {
  if (svg.value && zoomBehavior) {
    zoomBehavior.scaleBy(d3.select(svg.value), 1.2);
  }
}

/** Zoomt den Zeitstrahl heraus */
function zoomOut(): void {
  if (svg.value && zoomBehavior) {
    zoomBehavior.scaleBy(d3.select(svg.value), 1 / 1.2);
  }
}

/** Programmatisches Setzen des Zoomfaktors */
function applyZoom(scale: number) {
  if (svg.value && zoomBehavior) {
    d3.select(svg.value).call(zoomBehavior.scaleTo as any, scale);
  }
}

defineExpose({ applyZoom, zoomScale });
onMounted(() => {
  render();
  resizeObserver = new ResizeObserver(() => render());
  if (svg.value) resizeObserver.observe(svg.value);
});

onBeforeUnmount(() => resizeObserver?.disconnect());
watch(
  () => props.nodes,
  async () => {
    render();
    await nextTick();
  },
  { deep: true }
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
