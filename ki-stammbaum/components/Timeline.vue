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
  (e: 'yearSelected', year: number): void;
}>();

const svg = ref<SVGSVGElement | null>(null);
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

/** Bestimmt die Bin-Größe basierend auf dem Zoom-Faktor */
function binSizeForScale(scale: number): number {
  if (scale < 1.5) return 10;
  if (scale < 3) return 5;
  return 1;
}

/** Erstellt die gruppierten Daten pro Jahr und Kategorie */
function binnedData(binSize: number): any[] {
  const cats = Array.from(new Set(props.nodes.map(n => n.category)));
  const rolled = d3.rollups(
    props.nodes,
    v => v.length,
    d => Math.floor(d.year / binSize) * binSize,
    d => d.category
  );
  const map = new Map<number, Map<string, number>>();
  rolled.forEach(([yr, catCounts]) => map.set(yr, new Map(catCounts)));

  const start = Math.floor(minYear / binSize) * binSize;
  const end = Math.ceil((maxYear + 1) / binSize) * binSize - 1;
  const result: any[] = [];
  for (let yv = start; yv <= end; yv += binSize) {
    const entry: Record<string, number> = { year: yv };
    cats.forEach(c => entry[c] = map.get(yv)?.get(c) ?? 0);
    result.push(entry);
  }
  return result;
}

/** Zeichnet Balken und Achse unter gegebenem Zoom-Transform */
function draw(transform: d3.ZoomTransform = d3.zoomIdentity): void {
  if (!svg.value) return;
  const zx = transform.rescaleX(x);
  const barWidth = Math.max(1, zx(minYear + currentBinSize) - zx(minYear));

  const series = barsGroup.selectAll('g')
    .data(stackData, (d: any) => d.key)
    .join('g')
    .attr('fill', (d: any) => color(d.key));

  series.selectAll('rect')
    .data((d: any) => d)
    .join('rect')
    .attr('x', (d: any) => zx(d.data.year + currentBinSize / 2) - barWidth / 2)
    .attr('width', barWidth)
    .attr('y', (d: any) => y(d[1]))
    .attr('height', (d: any) => y(d[0]) - y(d[1]))
    .style('cursor', 'pointer')
    .on('click', (_e, d: any) => emit('yearSelected', d.data.year));

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
    .domain([0, d3.max(stackData, s => d3.max(s, d => d[1])) ?? 1])
    .range([height - margin.bottom, margin.top]);

  barsGroup = svgSel.append('g').attr('class', 'bars');
  axisGroup = svgSel.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height - margin.bottom})`);

  zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 8])
    .translateExtent([[margin.left, 0], [width - margin.right, height]])
    .on('zoom', ev => {
      zoomScale.value = ev.transform.k;
      const newSize = binSizeForScale(zoomScale.value);
      if (newSize !== currentBinSize) {
        currentBinSize = newSize;
        data = binnedData(currentBinSize);
        stackData = d3.stack().keys(categories)(data);
        y.domain([0, d3.max(stackData, s => d3.max(s, d => d[1])) ?? 1]);
        barsGroup.selectAll('*').remove();
      }
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
