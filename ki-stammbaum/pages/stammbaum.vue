<template>
  <div class="stammbaum-page">
    <h1>KI-Stammbaum</h1>

    <Timeline
      v-if="allGraphDataForTimeline.nodes.length"
      :nodes="allGraphDataForTimeline.nodes"
      @range-change-end="updateCurrentYearRange"
      @year-selected="onYearSelected"
      @node-clicked-in-timeline="handleNodeClickedInTimeline"
      @node-hovered-in-timeline="handleNodeHoveredInTimeline"
      :highlight-node-id="overallHoveredNodeId"
      :external-range="mainViewVisibleRange"
      :ki-stammbaum-zoom-level="pageCurrentZoomLevel"
    />

    <div
      v-if="hoveredNodeInTimeline && hoverPreviewPosition"
      class="timeline-hover-preview"
      :style="{
        left: hoverPreviewPosition.x + 'px',
        top: hoverPreviewPosition.y + 'px',
      }"
    >
      <div>
        <strong>{{ hoveredNodeInTimeline.name }}</strong>
      </div>
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
      @node-hovered="handleNodeHoveredInTree"
      :highlight-node-id="overallHoveredNodeId"
      :selected-node-id="selected?.id"
      @main-view-range-changed="handleMainViewRangeChange"
      :target-zoom-level="pageCurrentZoomLevel"
    />

    <ConceptDetail :concept="selectedToConcept" @close="selected = null" />
    <Legend :categories="legendCategories" />
    <FilterControls @filters-applied="onFilters" />
    <ZoomControls
      :current-level="pageCurrentZoomLevel"
      @update:current-level="pageCurrentZoomLevel = $event"
    />
  </div>
</template>

<script setup lang="ts">
  definePageMeta({ layout: 'default' });

  import { computed, ref, watch, watchEffect } from 'vue';
  import * as d3 from 'd3';
  import KiStammbaum from '@/components/KiStammbaum.vue';
  import FilterControls from '@/components/FilterControls.vue';
  import ConceptDetail from '@/components/ConceptDetail.vue';
  import Legend from '@/components/Legend.vue';
  import Timeline from '@/components/Timeline.vue';
  import ZoomControls from '@/components/ZoomControls.vue'; // Import ZoomControls
  import { useStammbaumData } from '@/composables/useStammbaumData';
  import { transformToGraph } from '@/utils/graph-transform';
  import type { Node, Concept, Graph } from '@/types/concept'; // Import Graph and Concept from types

  // Cache variables
  let previousFiltersSignature: string | null = null;
  let cachedStammbaumGraph: Graph | null = null;

  /** Datenabruf */
  const { data, pending, error } = useStammbaumData();

  watch(pending, (newVal, oldVal) => {
    console.log(
      '[StammbaumPage Pending Watch] Pending state changed from',
      oldVal,
      'to',
      newVal,
    );
  });

  watch(error, (newErr) => {
    if (newErr)
      console.error('[StammbaumPage Error Watch] Error detected:', newErr);
  });

  watch(
    data,
    (newData) => {
      if (newData)
        console.log('[StammbaumPage Data Watch] Data received:', newData);
    },
    { deep: false },
  );

  watchEffect(() => {
    if (!pending.value && !error.value && data.value) {
      console.log(
        '[StammbaumPage] Conditions met to render KiStammbaum. Data available.',
      );
    } else if (pending.value) {
      console.log(
        '[StammbaumPage] Conditions NOT met to render KiStammbaum: Data is pending.',
      );
    } else if (error.value) {
      console.error(
        '[StammbaumPage] Conditions NOT met to render KiStammbaum: Error loading data.',
      );
    }
  });

  /** Momentan ausgewähltes Konzept */
  const selected = ref<Node | null>(null); // Holds the currently selected concept node, or null if no node is selected.

  /**
   * Stores the currently applied filter values from FilterControls.vue.
   * - `startYear`: Filters nodes to be on or after this year. Null means no start year filter.
   * - `endYear`: Filters nodes to be on or before this year. Null means no end year filter.
   * - `type`: Filters nodes by category (e.g., 'algorithm', 'concept'). Empty string means all types.
   */
  const activeFilters = ref<{
    startYear: number | null;
    endYear: number | null;
    type: string;
  }>({ startYear: null, endYear: null, type: '' });

  /** Aktueller sichtbarer Zeitraum aus der Timeline (als Tuple getypt) */
  const currentYearRange = ref([1950, 2025] as [number, number]);

  /** For Hover Preview in Timeline */
  const hoveredNodeInTimeline = ref<Node | null>(null);
  const hoverPreviewPosition = ref<{ x: number; y: number } | null>(null);

  /** Shared hover state for cross-component highlighting */
  const overallHoveredNodeId = ref<string | null>(null);
  const mainViewVisibleRange = ref<[number, number] | null>(null);

  watch(overallHoveredNodeId, (newNodeId, oldNodeId) => {
    console.log(
      `overallHoveredNodeId changed:
        old: ${oldNodeId}
        new: ${newNodeId}`,
    );
  });
  /**
   * The current zoom level of the page/main KiStammbaum component.
   * Ranges from 1 (most zoomed out) to 4 (most zoomed in).
   * This ref is passed to ZoomControls to indicate the active level,
   * and updated by ZoomControls when the user selects a new level.
   * It's also passed as `targetZoomLevel` to KiStammbaum to command its zoom state.
   */
  const pageCurrentZoomLevel = ref(1);

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
  function selectConcept(concept: Node | any) {
    // Can be Node from KiStammbaum or any for now
    selected.value = concept as Node; // Cast to Node, assuming the emitted object is a valid Node.
  }

  /**
   * Callback function triggered when filters are applied in FilterControls.vue.
   * Updates the `activeFilters` ref with the new filter values.
   * @param filters - An object containing `startYear`, `endYear`, and `type` filter values.
   */
  function onFilters(filters: {
    startYear: number | null;
    endYear: number | null;
    type: string;
  }) {
    activeFilters.value = filters; // Update the reactive ref, triggering re-computation of stammbaumGraph.
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
  function handleNodeClickedInTimeline(node: any) {
    // Accept TimelineDisplayItem, which may have name as string | undefined
    handleCenterOnYear(node.year);
  }

  /** Handler for node hover events from Timeline.vue */
  function handleNodeHoveredInTimeline(
    payload: { node: any; event: MouseEvent } | null,
  ) {
    if (payload) {
      hoveredNodeInTimeline.value = payload.node; // Accept TimelineDisplayItem
      overallHoveredNodeId.value = payload.node.id;
      hoverPreviewPosition.value = {
        x: payload.event.clientX + 10,
        y: payload.event.clientY + 10,
      };
    } else {
      hoveredNodeInTimeline.value = null;
      overallHoveredNodeId.value = null;
      hoverPreviewPosition.value = null;
    }
  }

  /** Handler for node hover events from KiStammbaum.vue */
  function handleNodeHoveredInTree(nodeId: string | null) {
    overallHoveredNodeId.value = nodeId;
  }

  function handleMainViewRangeChange(range: [number, number]) {
    mainViewVisibleRange.value = range;
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

  /**
   * Computed property that prepares the graph data (nodes and links) for KiStammbaum.
   * It first filters the raw data based on `activeFilters` and then transforms it
   * into a graph structure suitable for D3 rendering.
   */
  const stammbaumGraph = computed(() => {
    if (!data.value) return { nodes: [], links: [] }; // Return empty graph if no data.

    let nodesToProcess = data.value.nodes;

    // Apply start year filter, if set.
    if (activeFilters.value.startYear !== null) {
      nodesToProcess = nodesToProcess.filter(
        (node: Node) => node.year >= activeFilters.value.startYear!,
      );
    }
    // Apply end year filter, if set.
    if (activeFilters.value.endYear !== null) {
      nodesToProcess = nodesToProcess.filter(
        (node: Node) => node.year <= activeFilters.value.endYear!,
      );
    }

    // Apply type (category) filter, if a type is selected.
    if (activeFilters.value.type && activeFilters.value.type !== '') {
      nodesToProcess = nodesToProcess.filter(
        (node: Node) => node.category === activeFilters.value.type,
      );
    }

    // Generate current filters signature
    const currentFiltersSignature =
      JSON.stringify(activeFilters.value) +
      ':' +
      nodesToProcess
        .map((n) => n.id)
        .sort()
        .join(',');

    // Check cache
    if (
      currentFiltersSignature === previousFiltersSignature &&
      cachedStammbaumGraph
    ) {
      return cachedStammbaumGraph;
    }

    // Transform the (potentially filtered) list of nodes into a graph structure.
    // transformToGraph also generates the corresponding links based on dependencies.
    const newGraph = transformToGraph(nodesToProcess);

    // Update cache
    previousFiltersSignature = currentFiltersSignature;
    cachedStammbaumGraph = newGraph;

    return newGraph;
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

  // Add computed to convert Node to Concept for ConceptDetail
  const selectedToConcept = computed<Concept | null>(() => {
    if (!selected.value) return null;
    // Ensure all required Concept fields are present, fallback to empty array for dependencies
    return {
      id: selected.value.id,
      name: selected.value.name,
      year: selected.value.year,
      description: selected.value.description || '',
      category: selected.value.category || '',
      dependencies: (selected.value as any).dependencies || [],
      contributions: (selected.value as any).contributions,
      references: (selected.value as any).references,
      influenced: (selected.value as any).influenced,
      tags: (selected.value as any).tags,
      year_of_origin: (selected.value as any).year_of_origin,
      short_description: (selected.value as any).short_description,
    };
  });
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
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    white-space: nowrap; /* Prevent long names from wrapping awkwardly */
    /* Transitions for smoother appearance/disappearance (optional) */
    /* transition: opacity 0.1s ease-in-out; */
  }
</style>
