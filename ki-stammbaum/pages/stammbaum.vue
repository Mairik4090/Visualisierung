<template>
  <div class="stammbaum-page">
    <h1>KI-Stammbaum</h1>

    <FilterControls @filtersApplied="onFilters" />
    <Legend :categories="legendCategories" />

    <div v-if="pending">Daten werden geladen...</div>
    <div v-else-if="error">Fehler beim Laden: {{ error.message }}</div>
    <KiStammbaum
      v-else
      :data="graphData"
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
import { useStammbaumData } from '@/composables/useStammbaumData';

const { data, pending, error } = useStammbaumData();
const selected = ref(null);
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

const graphData = computed(() => data.value?.nodes || []);
</script>

<style scoped>
.stammbaum-page {
  padding: 1rem;
}
</style>
