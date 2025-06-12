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

/** Aktueller Zoomfaktor der Timeline */
const zoomScale = ref(1);

let minYear = 0;
let maxYear = 0;
let x: d3.ScaleLinear<number, number>;
let y: d3.ScaleLinear<number, number>;
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
let barsGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
let axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
let data: any[] = [];
let currentBinSize = 1;
let categories: string[] = [];
let color: d3.ScaleOrdinal<string, string>;
let stackData: d3.Series<any, string>[];

function binSizeForScale(scale: number): number {
  if (scale < 1.5) return 10; // Jahrzehnt
  if (scale < 3) return 5;   // Fünf-Jahres-Intervall
  return 1;                   // Einzelnes Jahr
}

function binnedData(binSize: number): any[] {
  const categories = Array.from(new Set(props.nodes.map(n => n.category)));
  const rolled = d3.rollups(
    props.nodes,
    v => v.length,
    d => Math.floor(d.year / binSize) * binSize,
    d => d.category
  );
  const map = new Map<number, Map<string, number>>();
  rolled.forEach(([year, catCounts]) => {
    map.set(year, new Map(catCounts));
  });
  const start = Math.floor(minYear / binSize) * binSize;
  const end = Math.ceil((maxYear + 1) / binSize) * binSize - 1;
  const result: any[] = [];
  for (let yv = start; yv <= end; yv += binSize) {
    const entry: Record<string, number> = { year: yv };
    categories.forEach(c => { entry[c] = map.get(yv)?.get(c) ?? 0; });
    result.push(entry);
  }
  return result;
}

function draw(transform: d3.ZoomTransform = d3.zoomIdentity): void {
  if (!svg.value) return;

  const zx = transform.rescaleX(x);
  const barWidth = Math.max(1, zx(minYear + currentBinSize) - zx(minYear));

  const rects = barsGroup
    .selectAll('g')
    .data(stackData)
    .join('g')
    .attr('fill', (d: any) => color(d.key))
    .selectAll('rect')
    .data(d => d)
    .join('rect')
    .attr('x', d => zx(d.data.year + currentBinSize / 2) - barWidth / 2)
    .attr('width', barWidth)
    .attr('y', d => y(d[1]))
    .attr('height', d => y(d[0]) - y(d[1]))
    .on('click', (_, d) => emit('yearSelected', d.data.year));

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

  categories = Array.from(new Set(props.nodes.map(d => d.category)));
  color = d3.scaleOrdinal<string>()
    .domain(categories)
    .range(d3.schemeCategory10);

  x = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([margin.left, width - margin.right]);

  currentBinSize = binSizeForScale(zoomScale.value);
  data = binnedData(currentBinSize);
  stackData = d3.stack().keys(categories)(data);

  y = d3.scaleLinear()
    .domain([0, d3.max(stackData, series => d3.max(series, d => d[1])) ?? 1])
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
        stackData = d3.stack().keys(categories)(data);
        y.domain([0, d3.max(stackData, series => d3.max(series, d => d[1])) ?? 1]);
        barsGroup.selectAll('*').remove();
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

onMounted(render);
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
