<template>
  <svg ref="svg" class="node-timeline-svg" aria-label="Jahresanzeige" />
</template>

<script setup lang="ts">
  import { onMounted, watch, ref } from 'vue';
  import * as d3 from 'd3';
  import type { Concept } from '@/types/concept';

  const props = defineProps<{ concept: Concept | null }>();
  const svg = ref<SVGSVGElement | null>(null);

  function render(): void {
    if (!svg.value || !props.concept) return;

    const year = props.concept.year;
    const range: [number, number] = [year - 5, year + 5];

    const svgSel = d3.select(svg.value);
    svgSel.selectAll('*').remove();

    const width = svg.value.clientWidth || 300;
    const height = 40;
    const margin = { top: 5, right: 10, bottom: 20, left: 10 };

    svgSel
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const x = d3
      .scaleLinear()
      .domain(range)
      .range([margin.left, width - margin.right]);

    svgSel
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));

    svgSel
      .append('line')
      .attr('x1', x(year))
      .attr('x2', x(year))
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'red')
      .attr('stroke-width', 2);
  }

  onMounted(render);
  watch(() => props.concept, render, { deep: true });
</script>

<style scoped>
  .node-timeline-svg {
    width: 100%;
    height: 40px;
  }
</style>
