<template>
  <div class="timeline-container">
    <svg ref="svg" class="timeline-svg" aria-label="Zeitstrahl" />
  </div>
</template>

<script setup lang="ts">
  // Vue Composition API Imports
  import { onMounted, watch, ref, nextTick } from 'vue';
  import type { PropType } from 'vue';

  // D3.js Import für Datenvisualisierung
  import * as d3 from 'd3';
  import type { Node } from '@/types/concept';

  // Interface for items displayed on the timeline (can be original nodes or clusters)
  interface TimelineDisplayItem extends Partial<Node> {
    // Use Partial<Node> to allow overriding/adding properties
    id: string; // Required: Can be original node ID or generated cluster ID
    year: number; // Required: Original year or representative year for the cluster
    category: string; // Required: Original category or representative/generic category for cluster
    isCluster: boolean;
    count?: number; // Number of original nodes it represents (1 if not a cluster)
    childNodes?: Node[]; // Array of original nodes if it's a cluster
    name?: string; // Optional: Cluster name or original node name
    description?: string; // Optional: Cluster description or original node description
    categoriesInCluster?: string[]; // For decade clusters
    categoryColorsInCluster?: string[]; // For decade clusters
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
      type: Object as PropType<[number, number] | null>,
      default: null,
    },
    /**
     * The current zoom level of the main KiStammbaum view (1-4).
     * This is used to synchronize clustering behavior between the tree and the timeline.
     * Level 1: Century Block (Tree) -> Decade (Timeline)
     * Level 2: Century (Tree) -> Decade (Timeline)
     * Level 3: Decade and Category (Tree) -> Year and Category (Timeline)
     * Level 4: Individual Nodes (Tree) -> Individual Nodes (Timeline)
     */
    kiStammbaumZoomLevel: {
      type: Number,
      required: true,
    },
  });

  watch(
    () => props.highlightNodeId,
    (newNodeId, oldNodeId) => {
      console.log(
        `Timeline props.highlightNodeId changed:
        old: ${oldNodeId}
        new: ${newNodeId}`,
      );
    },
  );

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
  // let minYear = 0; // Will be determined dynamically or from props if needed
  // let maxYear = 0; // Will be determined dynamically
  let x: d3.ScaleLinear<number, number> | null = null;
  let y: d3.ScaleLinear<number, number> | null = null;
  let color: d3.ScaleOrdinal<string, string> | null = null;
  // categories array can be local to render if only used to build color scale domain initially

  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
  let nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  let axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>;


  /**
   * Zeichnet Knoten und Achse unter gegebenem Zoom-Transform
   * @param transform - D3 Zoom Transform Objekt
   */
  function draw(transform: d3.ZoomTransform = d3.zoomIdentity): void {
    if (!svg.value || !props.nodes || !x || !y || !color) return; // Ensure scales are initialized

    // Angepasste X-Skala basierend auf Zoom-Transform
    const zx = transform.rescaleX(x);

    const currentDisplayItems = computedDisplayableTimelineItems.value;

    // Konstante für Balken-Dimensionen
    const barWidth = 5;
    const barHeight = 10;

    // Knoten mit D3 Data Join Pattern zeichnen
    nodesGroup
      .selectAll('rect')
      .data(currentDisplayItems, (d: any) => d.id) // Eindeutige ID als Schlüssel
      .join(
        // Enter: Neue Knoten hinzufügen
        (enter) =>
          enter
            .append('rect')
            .attr('x', (d: TimelineDisplayItem) => zx(d.year) - barWidth / 2)
            .attr('y', y!(0) - barHeight / 2) // Use y scale
            .attr('width', barWidth)
            .attr('height', barHeight)
            .style('opacity', 0) // Startet transparent
            .attr('fill', (d: TimelineDisplayItem) => {
              if (d.isCluster) {
                if (
                  d.category === 'timeline_decade_cluster' &&
                  d.categoryColorsInCluster &&
                  d.categoryColorsInCluster.length > 0
                ) {
                  return d.categoryColorsInCluster[0]; // Use first color for decade cluster
                }
                return (
                  d3.color(color!(d.category))?.darker(0.5).toString() ?? '#555' // Use color scale
                ); // Darker for other clusters
              }
              return color!(d.category); // Use color scale
            })
            .attr('stroke', (d: TimelineDisplayItem) =>
              d.id === props.highlightNodeId ? 'black' : color!(d.category), // Use color scale
            )
            .attr('stroke-width', (d: TimelineDisplayItem) =>
              d.id === props.highlightNodeId ? 2 : 1,
            )
            .attr('data-id', (d: TimelineDisplayItem) => d.id) // Added data-id
            .attr(
              'data-highlighted',
              (d: TimelineDisplayItem) => d.id === props.highlightNodeId,
            ) // Added data-highlighted
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
                    d.categoryColorsInCluster.length > 0
                  ) {
                    return d.categoryColorsInCluster[0];
                  }
                  return (
                    d3.color(color!(d.category))?.darker(0.5).toString() ?? // Use color scale
                    '#555'
                  );
                }
                return color!(d.category); // Use color scale
              })
              .attr('stroke', (d: TimelineDisplayItem) =>
                d.id === props.highlightNodeId ? 'black' : color!(d.category), // Use color scale
              )
              .attr('stroke-width', (d: TimelineDisplayItem) =>
                d.id === props.highlightNodeId ? 2 : 1,
              )
              // Update data-highlighted attribute as well
              .attr(
                'data-highlighted',
                (d: TimelineDisplayItem) => d.id === props.highlightNodeId,
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
    const svgSel = d3.select(svg.value as SVGSVGElement);
    svgSel.selectAll('*').remove();

    // Dimensionen und Margins definieren
    const width = svg.value.clientWidth || 600;
    const height = svg.value.clientHeight || 100;
    const margin = { top: 10, right: 20, bottom: 20, left: 20 };

    // Min/Max Jahr aus Daten extrahieren for x scale domain
    const years = props.nodes.map(d => d.year);
    let newMinYear = d3.min(years);
    let newMaxYear = d3.max(years);

    // Fallback für ungültige Jahre
    newMinYear = newMinYear === undefined ? new Date().getFullYear() - 10 : newMinYear;
    newMaxYear = newMaxYear === undefined ? new Date().getFullYear() : newMaxYear;

    // Update color scale
    const uniqueCategories = Array.from(new Set(props.nodes.map(d => d.category).filter(Boolean))) as string[];
    if (!color || JSON.stringify(color.domain()) !== JSON.stringify(uniqueCategories)) {
        console.log('[Timeline Perf] Creating/updating color scale.');
        color = d3.scaleOrdinal<string>(uniqueCategories).range(d3.schemeCategory10);
    }

    // Update x scale
    const currentXRange: [number, number] = [margin.left, width - margin.right];
    if (!x || x.domain()[0] !== newMinYear || x.domain()[1] !== (newMaxYear + 1) || x.range()[0] !== currentXRange[0] || x.range()[1] !== currentXRange[1]) {
        console.log('[Timeline Perf] Creating/updating x scale.');
        x = d3.scaleLinear().domain([newMinYear, newMaxYear + 1]).range(currentXRange);
    }

    // Update y scale
    const currentYRange: [number, number] = [height - margin.bottom, margin.top];
    if (!y || y.range()[0] !== currentYRange[0] || y.range()[1] !== currentYRange[1]) { // Domain is fixed [-1,1]
        console.log('[Timeline Perf] Creating/updating y scale.');
        y = d3.scaleLinear().domain([-1, 1]).range(currentYRange);
    }

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
        // If this 'end' event was triggered by a programmatic zoom (via externalRange watcher),
        // we only need to reset the flag. The source of truth for the range is external,
        // so we don't emit 'rangeChangeEnd' to avoid potential loops.
        if (isProgrammaticZoom) {
          isProgrammaticZoom = false;
          return; // Do not emit 'rangeChangeEnd'
        }
        // If the zoom was user-initiated directly on the timeline, then emit the final range.
        if (x) { // Ensure x is initialized
            const finalXScale = ev.transform.rescaleX(x);
            emit('rangeChangeEnd', finalXScale.domain() as [number, number]);
        }
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
      zoomBehavior.scaleBy(d3.select(svg.value as SVGSVGElement), 1.2);
    }
  }

  /**
   * Zoomt programmatisch aus der Timeline heraus
   */
  function zoomOut(): void {
    if (svg.value && zoomBehavior) {
      zoomBehavior.scaleBy(d3.select(svg.value as SVGSVGElement), 1 / 1.2);
    }
  }

  /**
   * Exposed-Methode, um von außen auf einen bestimmten Zoom zu wechseln
   * @param scale - Gewünschter Zoom-Level
   */
  function applyZoom(scale: number): void {
    if (svg.value && zoomBehavior) {
      d3.select(svg.value as SVGSVGElement).call(
        zoomBehavior.scaleTo as any,
        scale,
      );
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
      // When nodes change, re-render. Clustering will be re-evaluated based on current kiStammbaumZoomLevel.
      render();
      await nextTick();
    },
    { deep: true },
  );

  watch(() => props.kiStammbaumZoomLevel, async () => {
    // When kiStammbaumZoomLevel changes, re-render to apply new clustering.
    // Need to ensure x scale and other D3 elements are initialized.
    if (svg.value && x && nodesGroup && axisGroup && zoomBehavior) {
        // We are not changing the underlying data (props.nodes) here,
        // nor the zoom transform of the timeline itself directly.
        // We just need to redraw the existing view with new clustering rules.
        // The current D3 transform is preserved.
        draw(d3.zoomTransform(svg.value as SVGSVGElement));
    } else {
        // If D3 setup is not complete, render will handle it.
        // This might happen on initial load if kiStammbaumZoomLevel is set very early.
        render();
    }
    await nextTick();
  });

  /**
   * Watches for changes in the `externalRange` prop.
   * When `externalRange` is updated (e.g., by the main KiStammbaum view),
   * this watcher adjusts the timeline's zoom and pan to match the new visible year range.
   */
  watch(() => props.externalRange, (newRange) => {
    // Ensure all necessary D3 objects and the new range are valid.
    if (newRange && newRange.length === 2 && svg.value && zoomBehavior && x && x.range && x.domain && y) { // Added y check
      const [minExt, maxExt] = newRange;

      // Ignore invalid ranges where min year is greater than or equal to max year.
      // Also, if the range is too small (e.g. difference is less than a small fraction of a year),
      // it might lead to extreme zoom levels or instability.
      // We allow minExt === maxExt for "zooming into a single year" type behavior.
      if (minExt > maxExt) { // Only strictly greater, allowing minExt === maxExt
        console.warn(`Timeline externalRange: Invalid range provided [${minExt}, ${maxExt}]. Min > Max.`);
        return;
      }

      // Get the current visible domain of the timeline based on its own D3 zoom transform.
      // This is NOT used for optimization anymore, as per requirements, externalRange is the source of truth.
      // const currentTransform = d3.zoomTransform(svg.value);
      // const currentVisibleDomain = currentTransform.rescaleX(x).domain();

      // Set the flag to indicate that the upcoming zoom event is programmatic.
      // This prevents the 'zoom' event handler from emitting 'rangeChanged' or 'rangeChangeEnd' (for this specific zoom),
      // avoiding a feedback loop.
      isProgrammaticZoom = true;

      // Get the pixel range of the x-axis (drawing area for the timeline).
      const [rangeStart, rangeEnd] = x.range(); // This is the output range in pixels
      const effectiveWidth = rangeEnd - rangeStart; // The actual width available for rendering the domain.

      if (effectiveWidth <= 0) {
        console.warn('Timeline externalRange: effectiveWidth is zero or negative. Cannot apply range.');
        isProgrammaticZoom = false; // Reset flag as we are aborting
        return;
      }

      // Calculate the new scale factor (k) required to fit the externalRange into the effectiveWidth.
      // The domain of x is in years. x(year) gives pixel position in original, unzoomed scale.
      // targetDomainSpanInPixels is how wide the externalRange (maxExt - minExt years) would be
      // in pixels if drawn with the original, unzoomed x-scale.
      const targetDomainSpanInPixels = x(maxExt) - x(minExt);

      let newScale;
      const [minZoom, maxZoom] = zoomBehavior.scaleExtent();

      if (minExt === maxExt) { // Special case: Zooming to a single point in time (e.g. a single year)
        // We want to "zoom in" as much as reasonably possible, centered on this year.
        // Set scale to maxZoom. The translation will center it.
        newScale = maxZoom;
      } else if (targetDomainSpanInPixels > 0) {
         newScale = effectiveWidth / targetDomainSpanInPixels;
      } else {
        // This case (targetDomainSpanInPixels <= 0 but minExt !== maxExt) implies an issue with the x scale's domain or input,
        // or minExt > maxExt (which should be caught above).
        // Fallback to a default scale or current scale, and log a warning.
        console.warn(`Timeline externalRange: targetDomainSpanInPixels is ${targetDomainSpanInPixels} with range [${minExt}, ${maxExt}]. Defaulting scale.`);
        const currentTransform = d3.zoomTransform(svg.value);
        newScale = currentTransform.k || 1; // Default to current scale or 1
      }

      // Ensure the calculated scale is within the allowed min/max zoom levels.
      const clampedScale = Math.max(minZoom, Math.min(maxZoom, newScale));

      // Calculate the translation (tx) required for the x-axis.
      // The D3 zoom transform is: x_transformed = x_original * k + tx.
      // We want the `minExt` year to appear at `rangeStart` (left edge of drawing area).
      // So, x(minExt) * clampedScale + targetTranslateX = rangeStart.
      // Therefore, targetTranslateX = rangeStart - (x(minExt) * clampedScale).
      // If minExt === maxExt, we want to center the view on that year.
      let targetTranslateX;
      if (minExt === maxExt) {
        // Center the view on x(minExt)
        targetTranslateX = effectiveWidth / 2 - (x(minExt) * clampedScale);
      } else {
        targetTranslateX = rangeStart - (x(minExt) * clampedScale);
      }


      // Construct the new D3 zoom transform.
      // Note: D3's transform order is translate then scale.
      // So, if we use d3.zoomIdentity.translate(tx, ty).scale(k),
      // the final transformation applied to a point p is (p * k) + t.
      const newTransform = d3.zoomIdentity.translate(targetTranslateX, 0).scale(clampedScale);

      // Apply the new transform to the SVG element, triggering a D3 zoom event.
      // A short transition is used for smoothness.
      d3.select(svg.value)
        .transition()
        .duration(250) // Use a short duration for programmatic zoom.
        .call(zoomBehavior.transform as any, newTransform)
        .on('end', () => {
          // This 'end' event is for the transition initiated by the watcher.
          // The main isProgrammaticZoom flag is reset by the zoomBehavior's 'end' handler.
          // We can add specific logic here if needed after this particular transition finishes.
        });
      // The `isProgrammaticZoom` flag will be reset in the 'end' event of the main zoomBehavior.
    }
  }, { deep: true });

  const computedDisplayableTimelineItems = computed<TimelineDisplayItem[]>(() => {
    if (!props.nodes || props.nodes.length === 0 || !color) { // Check color scale readiness
      console.log('[Timeline Perf] computedDisplayableTimelineItems: No nodes or color scale not ready.');
      return [];
    }
    console.log('[Timeline Perf] Recalculating computedDisplayableTimelineItems. Zoom Level:', props.kiStammbaumZoomLevel);

    let items: TimelineDisplayItem[] = [];
    const localColor = color; // Use the script-level cached scale

    if (props.kiStammbaumZoomLevel <= 2) { // Decade clustering
      const decadeBuckets = d3.group(props.nodes, d => Math.floor(d.year / 10) * 10);
      decadeBuckets.forEach((childNodes, decade) => {
        const categoriesInCluster = Array.from(new Set(childNodes.map(n => n.category).filter(Boolean))) as string[];
        const categoryColorsInCluster = categoriesInCluster.map(cat => localColor(cat));
        items.push({
          id: `timeline-decade-cluster-${decade}`,
          year: decade,
          category: 'timeline_decade_cluster',
          isCluster: true,
          count: childNodes.length,
          childNodes: childNodes,
          name: `${childNodes.length} items (${decade}s)`,
          description: `Cluster for ${decade}s containing ${childNodes.length} items. Categories: ${categoriesInCluster.join(', ')}`,
          categoriesInCluster,
          categoryColorsInCluster,
        });
      });
    } else if (props.kiStammbaumZoomLevel === 3) { // Year & Category clustering
       const yearCategoryBuckets = d3.group(props.nodes, d => d.year, d => d.category);
       yearCategoryBuckets.forEach((categoriesInYear, year) => {
         categoriesInYear.forEach((childNodes, category) => {
           if (childNodes.length > 1) {
             items.push({
               id: `timeline-year-cat-cluster-${year}-${category}`,
               year: year,
               category: category || '',
               isCluster: true,
               count: childNodes.length,
               childNodes: childNodes,
               name: `${childNodes.length} ${category} (${year})`,
               description: `Cluster of ${childNodes.length} ${category} items for ${year}`,
             });
           } else {
             childNodes.forEach(node => {
               items.push({ ...node, category: node.category || '', isCluster: false, count: 1 });
             });
           }
         });
       });
    } else { // Individual nodes
      props.nodes.forEach(node => {
        items.push({ ...node, category: node.category || '', isCluster: false, count: 1 });
      });
    }
    return items;
  });
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
