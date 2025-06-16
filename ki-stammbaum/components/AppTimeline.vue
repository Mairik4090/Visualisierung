<template>
  <div class="timeline-container">
    <svg ref="svg" class="timeline-svg" aria-label="Zeitstrahl" />
    <div class="zoom-controls">
      <button type="button" class="zoom-in" @click="zoomIn">+</button>
      <button type="button" class="zoom-out" @click="zoomOut">−</button>
    </div>
  </div>
</template>

<script setup lang="ts">
  // Vue Composition API Imports
  import { onMounted, watch, ref, nextTick } from 'vue';
  import type { PropType } from 'vue';

  // D3.js Import für Datenvisualisierung
  import * as d3 from 'd3';
  import type { Node } from '../../types/concept';

  // Timeline-specific zoom thresholds
  const TIMELINE_CLUSTER_THRESHOLD_DECADE = 1.2; // Below this, cluster by decade
  const TIMELINE_CLUSTER_THRESHOLD_YEAR = 2.0; // Below this (and above DECADE), cluster by year and category

  // Interface for items displayed on the timeline (can be original nodes or clusters)
  interface TimelineDisplayItem extends Partial<Node> {
    // Use Partial<Node> to allow overriding/adding properties
    id: string; // Required: Can be original node ID or generated cluster ID
    year: number; // Required: Original year or representative year for the cluster
    category?: string; // Required: Original category or representative/generic category for cluster
    isCluster: boolean;
    count?: number; // Number of original nodes it represents (1 if not a cluster)
    childNodes?: Node[]; // Array of original nodes if it's a cluster
    name?: string; // Optional: Cluster name or original node name
    description?: string; // Optional: Cluster description or original node description
    categoriesInCluster?: (string | undefined)[]; // For decade clusters
    categoryColorsInCluster?: (string | undefined)[]; // For decade clusters
    // Add any other properties from Node that are needed, or specific cluster properties
  }

  /**
   * Timeline-Komponente: gestapelte Balken pro Kategorie, Zoom/Pan auf X-Achse.
   * Emits:
   *  - 'rangeChanged' mit [minJahr, maxJahr]
   *  - 'nodeClickedInTimeline' mit dem angeklickten Knoten
   *  - 'nodeHoveredInTimeline' mit Hover-Informationen
   *  - 'rangeChangeEnd' mit finaler Bereichsänderung
   */

  // Props Definition
  const props = defineProps({
    nodes: { type: Array as PropType<Node[]>, required: true },
    highlightNodeId: { type: String as PropType<string | null>, default: null },
    /**
     * An external year range [minYear, maxYear] that the timeline should synchronize its view to.
     * Typically received from the main KiStammbaum view's zoom/pan events.
     */
    externalRange: {
      type: Array as PropType<[number, number] | null>,
      default: null,
    },
  });

  // Events Definition
  const emit = defineEmits<{
    (e: 'rangeChanged', range: [number, number]): void;
    (e: 'nodeClickedInTimeline', node: TimelineDisplayItem): void; // Updated to TimelineDisplayItem
    (
      e: 'nodeHoveredInTimeline',
      payload: { node: TimelineDisplayItem; event: MouseEvent } | null, // Updated to TimelineDisplayItem
    ): void;
    (e: 'rangeChangeEnd', range: [number, number]): void;
  }>();

  // Reactive References
  const svg = ref<SVGSVGElement | null>(null);
  const zoomScale = ref(1); // Zoom-Level für Debugging und externe Kontrolle
  /**
   * Flag to indicate if a zoom event was triggered programmatically (e.g., by the externalRange watcher).
   * This helps prevent feedback loops where a programmatic zoom change would emit 'rangeChanged',
   * which might then cause the parent to update externalRange again.
   */
  let isProgrammaticZoom = false;

  // D3 Skalen und Variablen
  let minYear = 0;
  let maxYear = 0;
  let x: d3.ScaleLinear<number, number>;
  let y: d3.ScaleLinear<number, number>;
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
  let nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  let axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  let categories: string[] = [];
  let color: d3.ScaleOrdinal<string, string>;

  /**
   * Zeichnet Knoten und Achse unter gegebenem Zoom-Transform
   * @param transform - D3 Zoom Transform Objekt
   */
  function draw(transform: d3.ZoomTransform = d3.zoomIdentity): void {
    if (!svg.value || !props.nodes) return;

    // Angepasste X-Skala basierend auf Zoom-Transform
    const zx = transform.rescaleX(x);
    const currentZoomLevel = transform.k;

    let displayableTimelineItems: TimelineDisplayItem[] = [];

    // --- START TIMELINE CLUSTERING LOGIC ---
    if (props.nodes && props.nodes.length > 0) {
      if (currentZoomLevel < TIMELINE_CLUSTER_THRESHOLD_DECADE) {
        // Cluster by Decade
        const decadeBuckets = d3.group(
          props.nodes,
          (d) => Math.floor(d.year / 10) * 10,
        );
        decadeBuckets.forEach((childNodes, decade) => {
          const categoriesInCluster = Array.from(
            new Set(childNodes.map((n) => n.category)),
          );
          const categoryColorsInCluster = categoriesInCluster
            .filter((cat): cat is string => typeof cat === 'string') // Filter out undefined
            .map((cat) => color(cat)); // Now cat is definitely a string
          displayableTimelineItems.push({
            id: `timeline-decade-cluster-${decade}`,
            year: decade, // Representative year (start of decade)
            category: 'timeline_decade_cluster', // Generic category for these clusters
            isCluster: true,
            count: childNodes.length,
            childNodes: childNodes,
            name: `${childNodes.length} items (${decade}s)`,
            description: `Cluster for ${decade}s containing ${childNodes.length} items. Categories: ${categoriesInCluster.join(', ')}`,
            categoriesInCluster,
            categoryColorsInCluster,
          });
        });
      } else if (currentZoomLevel < TIMELINE_CLUSTER_THRESHOLD_YEAR) {
        // Cluster by Year and Category
        const yearCategoryBuckets = d3.group(
          props.nodes,
          (d) => d.year,
          (d) => d.category,
        );
        yearCategoryBuckets.forEach((categoriesInYear, year) => {
          categoriesInYear.forEach((childNodes, category) => {
            if (childNodes.length > 1) {
              // Only cluster if more than one item
              displayableTimelineItems.push({
                id: `timeline-year-cat-cluster-${year}-${category}`,
                year: year,
                category: category,
                isCluster: true,
                count: childNodes.length,
                childNodes: childNodes,
                name: `${childNodes.length} ${category} (${year})`,
                description: `Cluster of ${childNodes.length} ${category} items for ${year}`,
              });
            } else {
              // Push single nodes as individual items
              childNodes.forEach((node) => {
                displayableTimelineItems.push({
                  ...node,
                  isCluster: false,
                  count: 1,
                });
              });
            }
          });
        });
      } else {
        // Show Individual Nodes (highest zoom level)
        props.nodes.forEach((node) => {
          displayableTimelineItems.push({
            ...node,
            isCluster: false,
            count: 1,
          });
        });
      }
    }
    // --- END TIMELINE CLUSTERING LOGIC ---

    // Konstante für Balken-Dimensionen
    const barWidth = 5;
    const barHeight = 10;

    // Knoten mit D3 Data Join Pattern zeichnen
    nodesGroup
      .selectAll('rect')
      .data(displayableTimelineItems, (d: any) => d.id) // Eindeutige ID als Schlüssel
      .join(
        // Enter: Neue Knoten hinzufügen
        (enter) =>
          enter
            .append('rect')
            .attr('x', (d: TimelineDisplayItem) => zx(d.year) - barWidth / 2)
            .attr('y', y(0) - barHeight / 2)
            .attr('width', barWidth)
            .attr('height', barHeight)
            .style('opacity', 0) // Startet transparent
            .attr('fill', (d: TimelineDisplayItem) => {
              if (d.isCluster) {
                if (
                  d.category === 'timeline_decade_cluster' &&
                  d.categoryColorsInCluster &&
                  d.categoryColorsInCluster.length > 0 &&
                  d.categoryColorsInCluster[0]
                ) {
                  return d.categoryColorsInCluster[0]; // Use first color for decade cluster
                }
                // Darker for other clusters, with fallback for undefined category
                return d.category
                  ? (d3.color(color(d.category))?.darker(0.5).toString() ??
                      '#555')
                  : '#555';
              }
              return d.category ? color(d.category) : '#ccc'; // Default color for nodes with undefined category
            })
            .attr('stroke', (d: TimelineDisplayItem) =>
              d.id === props.highlightNodeId
                ? 'black'
                : d.category
                  ? color(d.category)
                  : '#ccc',
            )
            .attr('stroke-width', (d: TimelineDisplayItem) =>
              d.id === props.highlightNodeId ? 2 : 1,
            )
            .style('cursor', 'pointer')
            // Event Handler für Interaktionen
            .on('click', (event: MouseEvent, d: TimelineDisplayItem) => {
              // d is now TimelineDisplayItem
              emit('nodeClickedInTimeline', d);
            })
            .on('mouseover', (event: MouseEvent, d: TimelineDisplayItem) => {
              // d is now TimelineDisplayItem
              emit('nodeHoveredInTimeline', { node: d, event });
            })
            .on('mouseout', () => {
              emit('nodeHoveredInTimeline', null);
            })
            // Einblend-Animation
            .call((enter) =>
              enter.transition().duration(500).style('opacity', 1),
            ),

        // Update: Bestehende Knoten aktualisieren
        (update) =>
          update.call((update) =>
            update
              .transition()
              .duration(300)
              .attr('x', (d: TimelineDisplayItem) => zx(d.year) - barWidth / 2)
              .attr('fill', (d: TimelineDisplayItem) => {
                if (d.isCluster) {
                  if (
                    d.category === 'timeline_decade_cluster' &&
                    d.categoryColorsInCluster &&
                    d.categoryColorsInCluster.length > 0 &&
                    d.categoryColorsInCluster[0]
                  ) {
                    return d.categoryColorsInCluster[0];
                  }
                  // Darker for other clusters, with fallback for undefined category
                  return d.category
                    ? (d3.color(color(d.category))?.darker(0.5).toString() ??
                        '#555')
                    : '#555';
                }
                return d.category ? color(d.category) : '#ccc'; // Default color for nodes with undefined category
              })
              .attr('stroke', (d: TimelineDisplayItem) =>
                d.id === props.highlightNodeId
                  ? 'black'
                  : d.category
                    ? color(d.category)
                    : '#ccc',
              )
              .attr('stroke-width', (d: TimelineDisplayItem) =>
                d.id === props.highlightNodeId ? 2 : 1,
              ),
          ),

        // Exit: Entfernte Knoten ausblenden
        (exit) =>
          exit.call((exit) =>
            exit.transition().duration(500).style('opacity', 0).remove(),
          ),
      );

    // X-Achse aktualisieren
    axisGroup.call(d3.axisBottom(zx).ticks(5).tickFormat(d3.format('d')));

    // Bereichsänderung emit
    if (!isProgrammaticZoom) {
      // Only emit if not caused by externalRange sync
      emit('rangeChanged', zx.domain() as [number, number]);
    }
  }

  /**
   * Initialer Aufbau der SVG, Skalen, Gruppen und Zoom-Behavior
   */
  function render(): void {
    if (!svg.value || !props.nodes.length) return;

    // SVG auswählen und leeren
    const svgSel = d3.select(svg.value);
    svgSel.selectAll('*').remove();

    // Dimensionen und Margins definieren
    const width = svg.value.clientWidth || 600;
    const height = svg.value.clientHeight || 100;
    const margin = { top: 10, right: 20, bottom: 20, left: 20 };

    // Min/Max Jahr aus Daten extrahieren
    const years = props.nodes.map((d) => d.year);
    [minYear, maxYear] = d3.extent(years) as [number, number];

    // Fallback für ungültige Jahre
    if (minYear === undefined || maxYear === undefined) {
      minYear = new Date().getFullYear() - 10;
      maxYear = new Date().getFullYear();
    }

    // Kategorien extrahieren und Farbskala erstellen
    categories = Array.from(new Set(props.nodes.map((d) => d.category)));
    color = d3
      .scaleOrdinal<string>()
      .domain(categories)
      .range(d3.schemeCategory10);

    // X-Skala (Zeitachse) definieren
    x = d3
      .scaleLinear()
      .domain([minYear, maxYear + 1]) // +1 um Randknoten vollständig anzuzeigen
      .range([margin.left, width - margin.right]);

    // Y-Skala (vereinfacht für vertikale Zentrierung)
    y = d3
      .scaleLinear()
      .domain([-1, 1]) // Beliebige Domain für Zentrierung
      .range([height - margin.bottom, margin.top]);

    // SVG Gruppen erstellen
    nodesGroup = svgSel.append('g').attr('class', 'nodes');
    axisGroup = svgSel
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height - margin.bottom})`);

    // Zoom-Behavior konfigurieren
    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15]) // Min/Max Zoom-Level
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      // Zoom Event Handler
      .on('zoom', (ev) => {
        zoomScale.value = ev.transform.k;
        draw(ev.transform); // This already emits 'rangeChanged'
        // If zoom was user-initiated on timeline, clear externalRange to allow independent control again (optional)
        // For now, let's assume externalRange takes precedence if provided.
      })
      // Zoom End Event Handler
      .on('end', (ev) => {
        if (isProgrammaticZoom) {
          isProgrammaticZoom = false; // Reset flag
          // Potentially emit final range only if it was a user drag on timeline itself
          const finalXScale = ev.transform.rescaleX(x);
          emit('rangeChangeEnd', finalXScale.domain() as [number, number]);
          return;
        }
        const finalXScale = ev.transform.rescaleX(x);
        emit('rangeChangeEnd', finalXScale.domain() as [number, number]);
      });

    // Zoom-Behavior an SVG binden
    svgSel.call(zoomBehavior as any);

    // Initiales Zeichnen
    draw();
  }

  /**
   * Zoomt programmatisch in die Timeline hinein
   */
  function zoomIn(): void {
    if (svg.value && zoomBehavior) {
      zoomBehavior.scaleBy(d3.select(svg.value), 1.2);
    }
  }

  /**
   * Zoomt programmatisch aus der Timeline heraus
   */
  function zoomOut(): void {
    if (svg.value && zoomBehavior) {
      zoomBehavior.scaleBy(d3.select(svg.value), 1 / 1.2);
    }
  }

  /**
   * Exposed-Methode, um von außen auf einen bestimmten Zoom zu wechseln
   * @param scale - Gewünschter Zoom-Level
   */
  function applyZoom(scale: number): void {
    if (svg.value && zoomBehavior) {
      d3.select(svg.value).call(zoomBehavior.scaleTo as any, scale);
    }
  }

  // Methoden für Parent-Komponente verfügbar machen
  defineExpose({ applyZoom, zoomScale });

  // Lifecycle Hooks
  onMounted(render);

  // Reaktive Überwachung der Props
  watch(
    () => props.nodes,
    async () => {
      render();
      await nextTick();
    },
    { deep: true },
  );

  /**
   * Watches for changes in the `externalRange` prop.
   * When `externalRange` is updated (e.g., by the main KiStammbaum view),
   * this watcher adjusts the timeline's zoom and pan to match the new visible year range.
   */
  // watch(() => props.externalRange, (newRange) => {
  //   // Ensure all necessary D3 objects and the new range are valid.
  //   if (newRange && newRange.length === 2 && svg.value && zoomBehavior && x) {
  //     const [minExt, maxExt] = newRange;
  //
  //     // Get the current visible domain of the timeline based on its own D3 zoom transform.
  //     const currentTransform = d3.zoomTransform(svg.value);
  //     const currentVisibleDomain = currentTransform.rescaleX(x).domain();
  //
  //     // Optimization: If the new external range is already very close to the current visible range,
  //     // skip the update to prevent minor oscillations or redundant calculations.
  //     if (Math.abs(currentVisibleDomain[0] - minExt) < 1 && Math.abs(currentVisibleDomain[1] - maxExt) < 1 && currentVisibleDomain[0] <= currentVisibleDomain[1]) {
  //       return;
  //     }
  //     // Ignore invalid ranges where min year is greater than or equal to max year.
  //     if (minExt >= maxExt) {
  //       return;
  //     }
  //
  //     // Set the flag to indicate that the upcoming zoom event is programmatic.
  //     // This prevents the 'zoom' event handler from emitting 'rangeChanged', avoiding a feedback loop.
  //     isProgrammaticZoom = true;
  //
  //     // Get the pixel range of the x-axis (drawing area for the timeline).
  //     const [rangeStart, rangeEnd] = x.range();
  //     const effectiveWidth = rangeEnd - rangeStart; // The actual width available for rendering the domain.
  //
  //     // Calculate the new scale factor (k) required to fit the externalRange into the effectiveWidth.
  //     // targetDomainSpanInPixels is how wide the externalRange (maxExt - minExt years) would be
  //     // in pixels if drawn with the original, unzoomed x-scale.
  //     const targetDomainSpanInPixels = x(maxExt) - x(minExt);
  //
  //     let newScale = currentTransform.k; // Default to current scale if calculation is problematic.
  //     if (targetDomainSpanInPixels > 0 && effectiveWidth > 0) {
  //        newScale = effectiveWidth / targetDomainSpanInPixels;
  //     } else if (effectiveWidth === 0 && targetDomainSpanInPixels === 0) { // Both are zero, e.g. no width and no domain
  //        newScale = currentTransform.k || 1; // Keep current or default to 1
  //     } else if (targetDomainSpanInPixels === 0) { // Trying to show a zero-width domain (e.g. single year)
  //       newScale = zoomBehavior.scaleExtent()[1]; // Use max zoom to "zoom in" maximally
  //     }
  //
  //     // Calculate the translation (tx) required for the x-axis.
  //     // The D3 zoom transform is such that: new_x_coord = original_x_coord * scale + translate.
  //     // We want the `minExt` year, when scaled, to appear at `rangeStart` (left edge of drawing area).
  //     // So, x(minExt) * newScale + targetTranslateX = rangeStart.
  //     // targetTranslateX = rangeStart - (x(minExt) * newScale).
  //     const targetTranslateX = rangeStart - (x(minExt) * newScale);
  //
  //     // Ensure the calculated scale is within the allowed min/max zoom levels.
  //     const [minZoom, maxZoom] = zoomBehavior.scaleExtent();
  //     const clampedScale = Math.max(minZoom, Math.min(maxZoom, newScale));
  //
  //     // Construct the new D3 zoom transform.
  //     const newTransform = d3.zoomIdentity.translate(targetTranslateX, 0).scale(clampedScale);
  //
  //     // Apply the new transform to the SVG element, triggering a D3 zoom event.
  //     // A short transition is used for smoothness.
  //     d3.select(svg.value)
  //       .transition()
  //       .duration(isProgrammaticZoom ? 250 : 0) // Use a short duration for programmatic zoom.
  //       .call(zoomBehavior.transform as any, newTransform);
  //       // The `isProgrammaticZoom` flag will be reset in the 'end' event of this zoom action.
  //   }
  // }, { deep: true });
</script>

<style scoped>
  .timeline-container {
    position: relative;
  }

  .timeline-svg {
    width: 100%;
    height: 100px;
    cursor: grab;
  }

  .zoom-controls {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    display: flex;
    flex-direction: column;
  }

  .zoom-controls button {
    width: 1.5rem;
    height: 1.5rem;
    margin-bottom: 0.25rem;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
  }
</style>
