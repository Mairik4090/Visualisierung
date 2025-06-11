<template>
  <div>
    <h1>KI-Stammbaum Visualisierung</h1>
    <FilterControls @filtersApplied="handleFiltersApplied" />
    <KiStammbaum :data="stammbaumData" @conceptSelected="handleConceptSelected" />
    <ConceptDetail :concept="selectedConcept" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import KiStammbaum from '../components/KiStammbaum.vue';
import FilterControls from '../components/FilterControls.vue';
import ConceptDetail from '../components/ConceptDetail.vue';

// Define a simple KiConcept type for the placeholder data
interface KiConceptPlaceholder {
  id: string;
  name: string;
  year: number;
  dependencies: string[];
  description: string;
}

const stammbaumData = ref<KiConceptPlaceholder[]>([
  { id: '1', name: 'Konzept A', year: 2020, dependencies: [], description: 'Beschreibung für Konzept A' },
  { id: '2', name: 'Konzept B', year: 2021, dependencies: ['1'], description: 'Beschreibung für Konzept B, hängt von A ab' },
  { id: '3', name: 'Konzept C', year: 2022, dependencies: [], description: 'Beschreibung für Konzept C' },
]);

const selectedConcept = ref<KiConceptPlaceholder | null>(null);

function handleConceptSelected(concept: KiConceptPlaceholder) {
  console.log('Concept selected in page:', concept);
  selectedConcept.value = concept;
}

function handleFiltersApplied(filters: any) {
  console.log('Filters applied in page:', filters);
  // Here you would typically filter stammbaumData based on the filters
  // For example:
  // stammbaumData.value = originalData.filter(item => item.year === filters.year);
}

// Components KiStammbaum, FilterControls, ConceptDetail are automatically registered when imported in <script setup>
</script>

<style scoped>
/* Add any page-specific styles here */
h1 {
  text-align: center;
  margin-bottom: 20px;
}

/* Basic layout styling */
div {
  /* Consider a more specific class for the main container if needed */
  /* display: flex; */ /* Commented out to prevent breaking layout if not intended for the root div of the page */
  /* flex-direction: column; */
  gap: 1rem; /* Adds space between direct children of this div if it were a flex container */
}
</style>
