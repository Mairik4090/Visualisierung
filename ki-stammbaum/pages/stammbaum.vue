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
      @node-clicked-in-timeline="handleNodeClickedInTimeline"
      @node-hovered-in-timeline="handleNodeHoveredInTimeline"
    />

    <div
      v-if="hoveredNodeInTimeline && hoverPreviewPosition"
      class="timeline-hover-preview"
      :style="{
        left: hoverPreviewPosition.x + 'px',
        top: hoverPreviewPosition.y + 'px',
      }"
    >
      <div><strong>{{ hoveredNodeInTimeline.name }}</strong></div>
      <div>Year: {{ hoveredNodeInTimeline.year }}</div>
      <div>Category: {{ hoveredNodeInTimeline.category }}</div>
    </div>

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
  import type { Node } from '@/types/concept'; // Added Node type import

  /** Datenabruf */
  const { data, pending, error } = useStammbaumData();

  /** Momentan ausgewähltes Konzept */
  const selected = ref<Node | null>(null); // Added type for selected

  /** Aktueller sichtbarer Zeitraum aus der Timeline (als Tuple getypt) */
  const currentYearRange = ref([1950, 2025] as [number, number]);

  /** For Hover Preview in Timeline */
  const hoveredNodeInTimeline = ref<Node | null>(null);
  const hoverPreviewPosition = ref<{ x: number; y: number } | null>(null);

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
  function selectConcept(concept: Node | any) { // Can be Node from KiStammbaum or any for now
    selected.value = concept as Node; // Assuming it's a Node
  }

  /** Platzhalter für Filter-Logik */
  function onFilters(filters: any) {
    // TODO: Filter anwenden
  }

  /** Empfang des neuen Jahresbereichs von der Timeline */
  function updateCurrentYearRange(range: [number, number]) {
    currentYearRange.value = range;
  }

  /** Klick auf einen Balken in der Timeline - might be deprecated by direct node click */
  function onYearSelected(year: number) {
    // This function might be deprecated by direct node clicking,
    // but keep for now if still wired up to old timeline bar clicks.
    currentYearRange.value = [year - 1, year + 1] as [number, number];
  }

  /** Handler for node click events from Timeline.vue */
  function handleNodeClickedInTimeline(node: Node) {
    selected.value = node;
    // Optional: Adjust currentYearRange or trigger other focus effects
    // For example, center the main graph view on this year if desired
    // handleCenterOnYear(node.year);
  }

  /** Handler for node hover events from Timeline.vue */
  function handleNodeHoveredInTimeline(
    payload: { node: Node; event: MouseEvent } | null,
  ) {
    if (payload) {
      hoveredNodeInTimeline.value = payload.node;
      // Position tooltip slightly offset from cursor
      hoverPreviewPosition.value = { x: payload.event.clientX + 10, y: payload.event.clientY + 10 };
    } else {
      hoveredNodeInTimeline.value = null;
      hoverPreviewPosition.value = null;
    }
  }

  const yearFocusWindowSpan = 10;

  /** Zentrieren auf ein bestimmtes Jahr */
  function handleCenterOnYear(year: number) {
    const newMin = Math.round(year - yearFocusWindowSpan / 2);
    const newMax = Math.round(year + yearFocusWindowSpan / 2);
    currentYearRange.value = [newMin, newMax] as [number, number];
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
        currentYearRange.value = [minYear, maxYear] as [number, number];
      }
    },
    { immediate: true },
  );
</script>

<style scoped>
  .stammbaum-page {
    padding: 1rem;
    /* position: relative; Consider if preview is 'absolute' instead of 'fixed'
      and needs to be relative to this page container.
      For 'fixed', this is not strictly necessary but doesn't harm. */
  }

  .timeline-hover-preview {
    position: fixed; /* Use fixed to position relative to viewport */
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 8px;
    font-size: 0.85rem;
    z-index: 1000; /* Ensure it's above other elements */
    pointer-events: none; /* Prevent tooltip from capturing mouse events */
    box-shadow: 0 2px 5px rgba(0,0,0,0.15);
    white-space: nowrap; /* Prevent long names from wrapping awkwardly */
    /* Transitions for smoother appearance/disappearance (optional) */
    /* transition: opacity 0.1s ease-in-out; */
  }
</style>