<template>
  <div class="stammbaum-page">
    <h1>KI-Stammbaum</h1>

    <FilterControls @filters-applied="onFilters" />
    <Legend :categories="legendCategories" />

    <Timeline
      v-if="graph.nodes.length"
      :nodes="graph.nodes"
      @range-changed="updateRange"
      @year-selected="onYearSelected"
    />

    <div v-if="pending">Daten werden geladen...</div>
    <div v-else-if="error">Fehler beim Laden: {{ error.message }}</div>
    <KiStammbaum
      v-else
      :nodes="graph.nodes"
      :links="graph.links"
      @concept-selected="selectConcept"
    />

    <ConceptDetail :concept="selected" @close="selected = null" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });

import { computed, ref } from 'vue';
import * as d3 from 'd3';
import KiStammbaum from '@/components/KiStammbaum.vue';
import FilterControls from '@/components/FilterControls.vue';
import ConceptDetail from '@/components/ConceptDetail.vue';
import Legend from '@/components/Legend.vue';
import Timeline from '@/components/Timeline.vue';
import { useStammbaumData } from '@/composables/useStammbaumData';
import { transformToGraph } from '@/utils/graph-transform';

/** Datenabruf */
const { data, pending, error } = useStammbaumData();

/** Momentan ausgewähltes Konzept */
const selected = ref(null);

/** Aktueller sichtbarer Zeitraum aus der Timeline */
const timelineRange = ref<[number, number] | null>(null);

/** Legenden-Daten: Kategorien mit Farben aus D3-Scheme */
const legendCategories = computed(() => {
  if (!data.value) return [];
  const cats = Array.from(new Set(data.value.nodes.map((n: any) => n.category)));
  const colorScale = d3.scaleOrdinal<string>()
    .domain(cats)
    .range(d3.schemeCategory10);
  return cats.map((c) => ({ name: c, color: colorScale(c) }));
});

/** Auswahl eines Konzepts im Stammbaum */
function selectConcept(concept: any) {
  selected.value = concept;
}

/** Platzhalter für Filter-Logik */
function onFilters(filters: any) {
  // TODO: Filter anwenden
}

/** Empfang des neuen Jahresbereichs von der Timeline */
function updateRange(range: [number, number]) {
  timelineRange.value = range;
}

/** Klick auf einen Balken in der Timeline */
function onYearSelected(year: number) {
  timelineRange.value = [year, year];
  const nodes = filteredNodes.value;
  if (nodes.length === 1) {
    selectConcept(nodes[0]);
  }
}

/** Gefilterte Knoten basierend auf timelineRange */
const filteredNodes = computed(() => {
  if (!data.value) return [];
  if (!timelineRange.value) return data.value.nodes;
  const [min, max] = timelineRange.value;
  return data.value.nodes.filter((n: any) => n.year >= min && n.year <= max);
});

/** Graph-Daten (Knoten & Links) für KiStammbaum */
const graph = computed(() =>
  data.value
    ? transformToGraph(filteredNodes.value)
    : { nodes: [], links: [] }
);
</script>

<style scoped>
.stammbaum-page {
  padding: 1rem;
}
</style>
