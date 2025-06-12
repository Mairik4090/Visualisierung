<template>
  <div class="stammbaum-page">
    <h1>KI-Stammbaum</h1>

    <FilterControls @filtersApplied="onFilters" />

    <div v-if="pending">Daten werden geladen...</div>
    <div v-else-if="error">Fehler beim Laden: {{ error.message }}</div>
    <KiStammbaum
      v-else
      :data="graphData"
      @conceptSelected="selectConcept"
    />

    <ConceptDetail :concept="selected" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import KiStammbaum from '@/components/KiStammbaum.vue';
import FilterControls from '@/components/FilterControls.vue';
import ConceptDetail from '@/components/ConceptDetail.vue';
import { useStammbaumData } from '@/composables/useStammbaumData';

const { data, pending, error } = useStammbaumData();
const selected = ref(null);

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
