<template>
  <div class="stammbaum-page">
    <h1>KI-Stammbaum</h1>

    <FilterControls @filtersApplied="onFilters" />
    <Legend :categories="legendCategories" />

    <Timeline
      v-if="graph.nodes.length"
      :nodes="graph.nodes"
      @rangeChanged="updateRange"
    />

    <div v-if="pending">Daten werden geladen...</div>
    <div v-else-if="error">Fehler beim Laden: {{ error.message }}</div>
    <KiStammbaum
      v-else
      :nodes="graph.nodes"
      :links="graph.links"
      @conceptSelected="selectConcept"
    />

    <ConceptDetail :concept="selected" @close="selected = null" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });

import { computed, ref } from 'vue';
import KiStammbaum from '@/components/KiStammbaum.vue';
import FilterControls from '@/components/FilterControls.vue';
import ConceptDetail from '@/components/ConceptDetail.vue';
import Legend from '@/components/Legend.vue';
import Timeline from '@/components/Timeline.vue';
import { useStammbaumData } from '@/composables/useStammbaumData';
import { transformToGraph } from '@/utils/graph-transform';

const { data, pending, error } = useStammbaumData();
const selected = ref(null);

// Speichert den aktuell sichtbaren Zeitbereich aus der Timeline
const timelineRange = ref<[number, number] | null>(null);

const legendCategories = [
  { name: 'Algorithmus',   color: '#1f77b4' },
  { name: 'Konzept',       color: '#2ca02c' },
  { name: 'Technologie',   color: '#ff7f0e' },
];

// Auswahl eines Konzepts im Stammbaum
function selectConcept(concept: any) {
  selected.value = concept;
}

// Platzhalter für spätere Filter-Logik
function onFilters(filters: any) {
  console.log('angewandte Filter', filters);
}

// Empfang des neuen Jahresbereichs von der Timeline
function updateRange(range: [number, number]) {
  timelineRange.value = range;
}

// Filtert die Rohdaten nach dem aktuellen Timeline-Bereich
const filteredNodes = computed(() => {
  if (!data.value) return [];
  if (!timelineRange.value) return data.value.nodes;
  const [min, max] = timelineRange.value;
  return data.value.nodes.filter((n: any) => n.year >= min && n.year <= max);
});

// Wandelt die (ggf. gefilterten) Knoten in das Graph-Format um
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
