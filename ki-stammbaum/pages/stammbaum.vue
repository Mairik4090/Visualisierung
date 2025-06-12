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
const timelineRange = ref<[number, number] | null>(null);
const legendCategories = [
  { name: 'Algorithmus', color: '#1f77b4' },
  { name: 'Konzept', color: '#2ca02c' },
  { name: 'Technologie', color: '#ff7f0e' },
];

function selectConcept(concept: any) {
  selected.value = concept;
}

function onFilters(filters: any) {
  // Filterlogik kann hier später integriert werden
  console.log('angewandte Filter', filters);
}

function updateRange(range: [number, number]) {
  timelineRange.value = range;
}

const filteredNodes = computed(() => {
  if (!data.value) return [] as any[];
  if (!timelineRange.value) return data.value.nodes;
  const [min, max] = timelineRange.value;
  return data.value.nodes.filter((n: any) => n.year >= min && n.year <= max);
});

const graph = computed(() =>
  data.value ? transformToGraph(filteredNodes.value) : { nodes: [], links: [] },
);
</script>

<style scoped>
.stammbaum-page {
  padding: 1rem;
}
</style>
