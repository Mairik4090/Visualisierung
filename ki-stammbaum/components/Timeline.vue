<template>
  <svg ref="svg" class="timeline-svg" aria-label="Zeitstrahl" />
</template>

<script setup lang="ts">
import { onMounted, watch, ref } from 'vue';
import * as d3 from 'd3';
import type { Node } from '@/types/concept';

/**
 * Timeline component visualizing the distribution of nodes over the years.
 * Allows zooming and panning on the x-axis.
 */
const props = defineProps<{ nodes: Node[] }>();
const emit = defineEmits<{
  (e: 'rangeChanged', range: [number, number]): void;
  (e: 'yearSelected', year: number): void;
}>();

const svg = ref<SVGSVGElement | null>(null);

function render(): void {
  if (!svg.value || !props.nodes || props.nodes.length === 0) return;

  const svgSel = d3.select(svg.value);
  svgSel.selectAll('*').remove();

  const width = svg.value.clientWidth || 600;
  const height = svg.value.clientHeight || 100;
  const margin = { top: 10, right: 20, bottom: 20, left: 20 };

  const years = props.nodes.map((d) => d.year);
  const [minYear, maxYear] = d3.extent(years) as [number, number];
  const counts = d3.rollups(props.nodes, (v) => v.length, (d) => d.year);
  const countMap = new Map(counts);

  const data = d3.range(minYear, maxYear + 1).map((y) => ({
    year: y,
    count: countMap.get(y) ?? 0,
  }));

  const x = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.count) ?? 1])
    .range([height - margin.bottom, margin.top]);

  const g = svgSel.append('g');
  const barWidth = Math.max(1, (width - margin.left - margin.right) / data.length);

  const bars = g.append('g')
    .attr('class', 'bars')
    .selectAll('rect')
    .data(data)
    .join('rect')
      .attr('x', (d) => x(d.year) - barWidth / 2)
      .attr('y', (d) => y(d.count))
      .attr('width', barWidth)
      .attr('height', (d) => height - margin.bottom - y(d.count))
      .attr('fill', '#69b3a2')
      .on('click', (_, d) => emit('yearSelected', d.year));

  const axis = g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));

  // Initialer Emit des vollen Bereichs
  emit('rangeChanged', [minYear, maxYear]);

  // Zoom- und Pan-Interaktion
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 8])
    .translateExtent([
      [margin.left, 0],
      [width - margin.right, height],
    ])
    .on('zoom', (ev) => {
      const zx = ev.transform.rescaleX(x);

      bars
        .attr('x', (d) => zx(d.year) - barWidth / 2)
        .attr('width', Math.max(1, zx(data[1].year) - zx(data[0].year)));

      axis.call(d3.axisBottom(zx).ticks(5).tickFormat(d3.format('d')));

      // Emit bei jedem Zoom-Event
      emit('rangeChanged', zx.domain() as [number, number]);
    });

  svgSel.call(zoom as any);
}

onMounted(render);
watch(
  () => props.nodes,
  () => render(),
  { deep: true }
);
</script>

<style scoped>
.timeline-svg {
  width: 100%;
  height: 100px;
  cursor: grab;
}
</style>
