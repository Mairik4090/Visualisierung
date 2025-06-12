<template>
  <div class="stammbaum-page">
    <h1>KI-Stammbaum</h1>

    <FilterControls @filters-applied="onFilters" />
    <Legend :categories="legendCategories" />

    <Timeline
      v-if="allGraphDataForTimeline.nodes.length"
      :nodes="allGraphDataForTimeline.nodes"
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

  import { computed, ref, watch } from 'vue';
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
  }

  /** Empfang des neuen Jahresbereichs von der Timeline */
  function updateCurrentYearRange(range: [number, number]) {
    currentYearRange.value = range;
  }

  /** Klick auf einen Balken in der Timeline */
  function onYearSelected(year: number) {
    currentYearRange.value = [year - 1, year + 1];
  }

  const yearFocusWindowSpan = 10;

  /** Zentrieren auf ein bestimmtes Jahr */
  function handleCenterOnYear(year: number) {
    const newMin = Math.round(year - yearFocusWindowSpan / 2);
    const newMax = Math.round(year + yearFocusWindowSpan / 2);
    currentYearRange.value = [newMin, newMax];
  }

  /** Daten für die Timeline (alle Knoten) */
  const allGraphDataForTimeline = computed(() => {
    if (!data.value) return { nodes: [], links: [] };
    return transformToGraph(data.value.nodes);
  });

  /** Daten für KiStammbaum */
  const stammbaumGraph = computed(() => {
    if (!data.value) return { nodes: [], links: [] };
    return transformToGraph(data.value.nodes);
  });

  /** Initiales Setzen des Zeitbereichs basierend auf den Daten */
  watch(
    allGraphDataForTimeline,
    (newGraphData) => {
      if (newGraphData.nodes.length > 0) {
        const years = newGraphData.nodes.map((n: any) => n.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        currentYearRange.value = [minYear, maxYear];
      }
    },
    { immediate: true },
  );
</script>

<style scoped>
  .stammbaum-page {
    padding: 1rem;
  }
</style>
