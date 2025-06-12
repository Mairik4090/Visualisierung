<template>
  <div class="stammbaum-page">
    <h1>KI-Stammbaum</h1>

    <FilterControls @filters-applied="onFilters" />
    <Legend :categories="legendCategories" />

    <Timeline
      v-if="allGraphDataForTimeline.nodes.length"
      :nodes="allGraphDataForTimeline.nodes" // Use all nodes for timeline context
      @range-changed="updateCurrentYearRange"
      @year-selected="onYearSelected"
    />

    <div v-if="pending">Daten werden geladen...</div>
    <div v-else-if="error">Fehler beim Laden: {{ error.message }}</div>
    <KiStammbaum
      v-else
      :nodes="stammbaumGraph.nodes"
      :links="stammbaumGraph.links"
      :current-year-range="currentYearRange"
      @concept-selected="selectConcept"
      @center-on-year="handleCenterOnYear"
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

/** Aktueller sichtbarer Zeitraum aus der Timeline, als Prop für KiStammbaum */
// Initialize with a default range, e.g., 1950-2025 or derive from all nodes
const currentYearRange = ref<[number, number]>([1950, 2025]);

  /** Legenden-Daten: Kategorien mit Farben aus D3-Scheme */
  const legendCategories = computed(() => {
    if (!data.value) return [];
    const cats = Array.from(
      new Set(data.value.nodes.map((n: any) => n.category)),
    );
    const colorScale = d3
      .scaleOrdinal<string>()
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
  // This might influence `allNodesForStammbaum` if filters are applied globally
}

/** Empfang des neuen Jahresbereichs von der Timeline */
function updateCurrentYearRange(range: [number, number]) {
  currentYearRange.value = range;
}

/** Klick auf einen Balken in der Timeline */
function onYearSelected(year: number) {
  // This could set the range to a single year or a small window around it
  currentYearRange.value = [year - 1, year + 1]; // Example: 3-year window
  // Potentially select a concept if only one matches, though KiStammbaum might be better for this
}

const yearFocusWindowSpan = 10; // Define the span of years to show, e.g., 10 years for centering

function handleCenterOnYear(year: number) {
  const newMin = Math.round(year - yearFocusWindowSpan / 2);
  const newMax = Math.round(year + yearFocusWindowSpan / 2);
  currentYearRange.value = [newMin, newMax];
  // This change to currentYearRange will be picked up by KiStammbaum's xScale.
  // Timeline.vue currently sets this value via its rangeChanged event, but doesn't consume it to set its own view.
}

// Data to be used by the timeline (could be all nodes, or filtered by other means if necessary)
const allGraphDataForTimeline = computed(() => {
  if (!data.value) return { nodes: [], links: [] };
  // For the timeline, we usually want all nodes to show the full context
  return transformToGraph(data.value.nodes);
});

// Graph data for KiStammbaum - should include ALL nodes it needs to potentially render.
// Filtering by year range is handled *inside* KiStammbaum via xScale.
const stammbaumGraph = computed(() => {
  if (!data.value) return { nodes: [], links: [] };
  // Pass all nodes to KiStammbaum.
  // transformToGraph might initialize positions or other properties needed by KiStammbaum
  return transformToGraph(data.value.nodes);
});

// Initialize currentYearRange once all data is available
watch(allGraphDataForTimeline, (newGraphData) => {
  if (newGraphData.nodes.length > 0) {
    const years = newGraphData.nodes.map((n: any) => n.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    // Set initial range to encompass all years, or a sensible default if that's too wide
    currentYearRange.value = [minYear, maxYear];
  }
}, { immediate: true });
</script>

<style scoped>
  .stammbaum-page {
    padding: 1rem;
  }
</style>
