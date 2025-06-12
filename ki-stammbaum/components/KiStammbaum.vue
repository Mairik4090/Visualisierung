<template>
  <div ref="container" class="ki-stammbaum-container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg
      ref="svg"
      class="ki-stammbaum-svg"
      aria-label="KI-Stammbaum Visualisierung"
      role="img"
    >
      <title>KI-Stammbaum Visualisierung</title>
      <!-- Fallback-Anzeige während des Ladens -->
      <text
        v-if="!nodes || nodes.length === 0"
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
      >
        Visualisierung lädt...
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref, watch, withDefaults, type PropType } from 'vue';
  import * as d3 from 'd3';
  import type { Node, Link } from '@/types/concept';

  interface GraphNode extends Node {
    name?: string;
    x?: number; // Current x position
    y?: number; // Current y position
    fx?: number | null; // Fixed x position (for physics)
    fy?: number | null; // Fixed y position (for physics)
    isCluster?: boolean;  // True if this node represents a cluster
    count?: number;       // Number of original nodes it represents (1 if not a cluster)
    childNodes?: Node[];  // Array of original nodes if it's a cluster
  }

  const props = defineProps({
    nodes: { type: Array as PropType<Node[] | undefined> },
    links: { type: Array as PropType<Link[] | undefined> },
    usePhysics: { type: Boolean, default: true },
    currentYearRange: { type: Array as PropType<[number, number]>, required: true },
    highlightNodeId: { type: String as PropType<string | null>, default: null } // New prop
  });

  const emit = defineEmits<{
    conceptSelected: [node: GraphNode];
    centerOnYear: [year: number]; // New event for x-axis navigation
    nodeHovered: [nodeId: string | null]; // New emit for hover events
  }>();

  /**
   * SVG-Referenz für alle D3-Manipulationen
   * Wird verwendet, um das DOM-Element direkt mit D3.js zu steuern
   */
  const svg = ref<SVGSVGElement | null>(null);
  const container = ref<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | null = null;

  /** Aktuelle D3-Simulation zur späteren Bereinigung */
  let simulation: d3.Simulation<GraphNode, Link> | null = null; // Updated Link type
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let lastTransform: d3.ZoomTransform = d3.zoomIdentity;

  const userPositionedNodes = ref<Map<string, { fy: number }>>(new Map());

  // Declare scales at a higher scope
  let xScale: d3.ScaleLinear<number, number> | null = null;
  let yScale: d3.ScalePoint<string> | null = null;

  function render(): void {
    if (!svg.value || !props.nodes || props.nodes.length === 0) return;
    simulation?.stop();

    const svgSel = d3.select(svg.value);
    svgSel.selectAll('*').remove();

    const width = svg.value.clientWidth || 600;
    const height = svg.value.clientHeight || 400;

    svgSel
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Add a background rectangle for capturing clicks on empty space
    // Insert it as the first child so it's behind other elements
    svgSel.insert('rect', ':first-child')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent') // Make it invisible
      .on('click', function(event: PointerEvent) {
        // event.target will be this rect if the click was on it (empty space)
        if (!xScale) return;
        // 'this' is the DOM element (the rect). d3.pointer needs the event and the target DOM element.
        const clickedX = d3.pointer(event, this)[0];
        const targetYear = xScale.invert(clickedX);
        emit('centerOnYear', Math.round(targetYear));
      });

    // X-Skala nach Jahr - NOW USES currentYearRange
    // --- START NODE FILTERING ---
    let filteredNodes: Node[] = [];
    if (props.nodes && props.nodes.length > 0) {
      filteredNodes = props.nodes.filter(node =>
        node.year >= props.currentYearRange[0] && node.year <= props.currentYearRange[1]
      );
    }
    // --- END NODE FILTERING ---

    // --- START CLUSTERING LOGIC ---
    const displayNodes: GraphNode[] = [];
    if (filteredNodes.length > 0) { // Use filteredNodes here
        const groupedByYearAndCategory = d3.group(filteredNodes, d => d.year, d => d.category); // Use filteredNodes here

        groupedByYearAndCategory.forEach((categoriesInYear, yearVal) => {
            categoriesInYear.forEach((originalNodesInGroup, categoryVal) => {
                const year = Number(yearVal);
                const category = String(categoryVal);

                if (originalNodesInGroup.length > 1) { // Create a cluster node
                    const clusterId = `cluster-${year}-${category}`;
                    const userSetClusterFy = userPositionedNodes.value.get(clusterId)?.fy;
                    displayNodes.push({
                        id: clusterId,
                        year: year,
                        category: category,
                        description: `Cluster of ${originalNodesInGroup.length} items in ${category} for ${year}`,
                        dependencies: [], // TODO: Aggregate dependencies? For now, empty.
                        name: `${originalNodesInGroup.length} ${category}`,
                        isCluster: true,
                        count: originalNodesInGroup.length,
                        childNodes: originalNodesInGroup,
                        fx: null,
                        fy: userSetClusterFy ?? null,
                    });
                } else { // Single node, add as is but typed as GraphNode
                    const originalNode = originalNodesInGroup[0];
                    const userSetFy = userPositionedNodes.value.get(originalNode.id)?.fy;
                    const graphNodeVersion: GraphNode = {
                       ...originalNode,
                       isCluster: false,
                       count: 1,
                       fx: null,
                       fy: userSetFy ?? null,
                    };
                    displayNodes.push(graphNodeVersion);
                }
            });
        });
    }
    // --- END CLUSTERING LOGIC ---

    // Assign to higher-scoped variable
    xScale = d3
      .scaleLinear()
      .domain(props.currentYearRange) // Use the prop for domain
      .range([40, width - 40]);

    // Kategorien und Y-Skala - Use categories from displayNodes
    const categoriesForScale = Array.from(new Set(displayNodes.map((d: GraphNode) => d.category)));
    yScale = d3
      .scalePoint<string>()
      .domain(categoriesForScale)
      .range([40, height - 40]);

    // Initialize node positions for displayNodes
    displayNodes.forEach((n: GraphNode) => {
      if (xScale && yScale && typeof n.year === 'number' && typeof n.category === 'string') {
        n.x = xScale(n.year);
        n.y = yScale(n.category);
      } else {
        // Default position if year/category is missing (should not happen for valid nodes)
        n.x = width / 2;
        n.y = height / 2;
      }
      // fx/fy already initialized during displayNodes creation
    });

    if (props.usePhysics) {
      displayNodes.forEach((n: GraphNode) => {
        if (xScale && typeof n.year === 'number') {
          n.fx = xScale(n.year);
          // Ensure fy is not unintentionally reset if it has a value.
          // If n.fy is null, it means it hasn't been vertically positioned by a drag yet,
          // so the Y force or initial Y position will take effect.
          // If n.fy has a value (e.g., from a previous drag operation that didn't involve this specific link change),
          // it should be preserved. The current structure where fx/fy are initialized to null
          // and only set by drag or this new logic means fy will persist if previously set by a drag.
        }
      });
    }

    // Farbskala pro Kategorie - Use categories from displayNodes for consistency
    const color = d3
      .scaleOrdinal<string>()
      .domain(categoriesForScale)
      .range(d3.schemeCategory10);

    // Hauptgruppe für alle grafischen Elemente
    const g = svgSel.append('g'); // Main group for elements that will be transformed

    if (!zoomBehavior) { // Initialize zoomBehavior only if it's null
        zoomBehavior = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 5])
            .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                // Note: event.transform is the new transform.
                g.attr('transform', event.transform.toString());
                lastTransform = event.transform; // Update lastTransform with the latest
            });
    }

    // Always attach the zoom behavior to the SVG element.
    svgSel.call(zoomBehavior as any);

    // Restore the last known transform.
    // This call will also trigger the 'zoom' event, ensuring 'g' is transformed
    // and 'lastTransform' is correctly set by the 'on.zoom' handler.
    if (lastTransform && zoomBehavior) { // lastTransform should always exist due to initialization with d3.zoomIdentity
        (zoomBehavior as d3.ZoomBehavior<SVGSVGElement, unknown>).transform(svgSel as any, lastTransform);
    }

    // --- LINK RE-MAPPING ---
    function findVisualNodeRepresenting(originalId: string, nodesToSearch: GraphNode[]): GraphNode | undefined {
        let found = nodesToSearch.find(n => !n.isCluster && n.id === originalId);
        if (found) return found;
        // If not found as a direct node, check if it's part of a cluster
        found = nodesToSearch.find(n => n.isCluster && n.childNodes?.some(child => child.id === originalId));
        return found;
    }

    const visualLinks: d3.SimulationLinkDatum<GraphNode>[] = [];
    if (props.links) {
        props.links.forEach(originalLink => {
            const sourceVisual = findVisualNodeRepresenting(originalLink.source, displayNodes);
            const targetVisual = findVisualNodeRepresenting(originalLink.target, displayNodes);

            if (sourceVisual && targetVisual && sourceVisual.id !== targetVisual.id) {
                visualLinks.push({ source: sourceVisual, target: targetVisual });
            }
        });
    }
    // --- END LINK RE-MAPPING ---

    const transitionDuration = 300;

    // Links zeichnen (append to g, use visualLinks)
    const linkSelection = g
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(visualLinks, (d: any) => `${d.source.id}-${d.target.id}`); // Key function for links

    linkSelection.exit()
      .transition().duration(transitionDuration)
      .attr('stroke-opacity', 0)
      .remove();

    const linkEnter = linkSelection.enter().append('line')
      .attr('stroke-opacity', 0)
      .attr('stroke-width', 1.5);

    const linkUpdateAndEnter = linkEnter.merge(linkSelection);
    // Specific attributes for links will be set in the if/else for props.usePhysics


    // Knoten zeichnen (use displayNodes)
    const nodeSelection = g
      .append('g')
      .selectAll('circle')
      .data(displayNodes, (d: GraphNode) => d.id);

    nodeSelection.exit()
      .transition().duration(transitionDuration)
      .attr('r', 0)
      .style('opacity', 0)
      .remove();

    const nodeEnter = nodeSelection.enter().append('circle')
      .attr('r', 0)
      .style('opacity', 0)
      .attr('fill', (d: GraphNode) => {
          const baseColor = color(d.category)!;
          return d.isCluster ? d3.color(baseColor)?.darker(0.5).toString() ?? '#555' : baseColor;
      })
      .style('cursor', 'pointer')
      .on('click', (_e, d) => emit('conceptSelected', d as GraphNode))
      .on('mouseover', (_e, d) => emit('nodeHovered', d.id))
      .on('mouseout', (_e, _d) => emit('nodeHovered', null));

    const nodeUpdateAndEnter = nodeEnter.merge(nodeSelection);
    // Specific attributes for nodes will be set in the if/else for props.usePhysics

    // Apply drag to all nodes (new and updating)
    nodeUpdateAndEnter.call(
      d3
        .drag<SVGCircleElement, GraphNode>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded),
    );

    // Labels hinzufügen (use displayNodes)
    const labelSelection = g
      .append('g')
      .selectAll('text')
      .data(displayNodes, (d: GraphNode) => d.id);

    labelSelection.exit()
      .transition().duration(transitionDuration)
      .style('opacity', 0)
      .remove();

    const labelEnter = labelSelection.enter().append('text')
      .style('opacity', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#333')
      .text((d: GraphNode) => d.name ?? d.id);

    const labelUpdateAndEnter = labelEnter.merge(labelSelection);
    // Specific attributes for labels will be set in the if/else for props.usePhysics


    if (props.usePhysics) {
      // For physics, update positions in the tick function
      nodeUpdateAndEnter // Apply to all nodes
        .attr('r', (d: GraphNode) => d.isCluster ? 10 : 6) // Set radius immediately for physics
        .style('opacity', 1) // Set opacity immediately
        .attr('stroke', (d: GraphNode) => d.id === props.highlightNodeId ? 'orange' : '#fff')
        .attr('stroke-width', (d: GraphNode) => d.id === props.highlightNodeId ? 3 : 1.5);
        // cx, cy will be set by simulation

      labelUpdateAndEnter.style('opacity', 1); // text and other attributes already set on enter
        // x, y will be set by simulation in ticked function

      linkUpdateAndEnter.attr('stroke-opacity', 0.6); // stroke-width already set on enter
        // x1,y1,x2,y2 will be set by simulation

      simulation = d3
        .forceSimulation(displayNodes) // Use displayNodes
        .force(
          'link',
          d3 // Use visualLinks
            .forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(visualLinks)
            .id((d: GraphNode) => d.id) // d is GraphNode from displayNodes
            .distance(60),
        )
        .force('charge', d3.forceManyBody().strength(-120))
        .force('x', d3.forceX<GraphNode>((d) => d.x!).strength(0.3)) // d is GraphNode
        .force('y', d3.forceY<GraphNode>((d) => d.y!).strength(0.05)) // d is GraphNode
        .on('tick', ticked);
    } else {
      // Render nodes directly using calculated/dragged positions from displayNodes
      // Apply transitions for non-physics updates
      nodeUpdateAndEnter
        .transition().duration(transitionDuration)
        .attr('cx', (d: GraphNode) => d.x!)
        .attr('cy', (d: GraphNode) => d.y!)
        .attr('r', (d: GraphNode) => d.isCluster ? 10 : 6)
        .style('opacity', 1)
        .attr('stroke', (d: GraphNode) => d.id === props.highlightNodeId ? 'orange' : '#fff')
        .attr('stroke-width', (d: GraphNode) => d.id === props.highlightNodeId ? 3 : 1.5);

      labelUpdateAndEnter
        .transition().duration(transitionDuration)
        .attr('x', (d: GraphNode) => d.x!)
        .attr('y', (d: GraphNode) => (d.y ?? 0) - 12) // Ensure y is defined for calculation
        .style('opacity', 1);

      linkUpdateAndEnter // Using visualLinks, source/target are GraphNode from displayNodes
        .transition().duration(transitionDuration)
        .attr('x1', (d: any) => (d.source as GraphNode).x!)
        .attr('y1', (d: any) => (d.source as GraphNode).y!)
        .attr('x2', (d: any) => (d.target as GraphNode).x!)
        .attr('y2', (d: any) => (d.target as GraphNode).y!)
        .attr('stroke-opacity', 0.6);
    }

    // Ticked function updates positions for displayNodes and visualLinks
    function ticked() {
      linkUpdateAndEnter // visualLinks (use the merged selection)
        .attr('x1', (d: any) => (d.source as GraphNode).x!)
        .attr('y1', (d: any) => (d.source as GraphNode).y!)
        .attr('x2', (d: any) => (d.target as GraphNode).x!)
        .attr('y2', (d: any) => (d.target as GraphNode).y!);
      nodeUpdateAndEnter // (use the merged selection)
        .attr('cx', (d: any) => (d as GraphNode).x!)
        .attr('cy', (d: any) => (d as GraphNode).y!);
      labelUpdateAndEnter // (use the merged selection)
        .attr('x', (d: any) => (d as GraphNode).x!)
        .attr('y', (d: any) => ((d as GraphNode).y ?? 0) - 12);
    }

    function dragStarted(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
    ) {
      event.sourceEvent?.stopPropagation();
      const subjectNode = event.subject as GraphNode;
      if (!event.active && props.usePhysics) {
        simulation?.alphaTarget(0.3).restart();
      }
      // Use current node position for fx, fy, not event.x/event.y initially
      subjectNode.fx = subjectNode.x ?? 0;
      subjectNode.fy = subjectNode.y ?? 0;
    }

    function dragged(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
    ) {
      event.sourceEvent?.stopPropagation();
      const subjectNode = event.subject as GraphNode;

      if (props.usePhysics) {
        subjectNode.fx = event.x;
        subjectNode.fy = event.y;
      } else {
        subjectNode.x = event.x;
        subjectNode.y = event.y;

        // Manually update position of circle and label
        d3.select(event.sourceEvent.target as SVGCircleElement)
          .attr('cx', subjectNode.x)
          .attr('cy', subjectNode.y);

        // Update corresponding label position
        // Need to select the specific label for this node
        svgSel.selectAll('text') // svgSel is d3.select(svg.value)
          .filter((d: unknown) => (d as GraphNode).id === subjectNode.id)
          .attr('x', subjectNode.x)
          .attr('y', (subjectNode.y ?? 0) - 12);

        // Update links connected to this node
        link
          .filter((l: any) => l.source.id === subjectNode.id || l.target.id === subjectNode.id)
          .attr('x1', (d: any) => (d.source as GraphNode).x!)
          .attr('y1', (d: any) => (d.source as GraphNode).y!)
          .attr('x2', (d: any) => (d.target as GraphNode).x!)
          .attr('y2', (d: any) => (d.target as GraphNode).y!);
      }
    }

    function dragEnded(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
    ) {
      event.sourceEvent?.stopPropagation();
      if (!xScale) return; // xScale might not be initialized

      const subjectNode = event.subject as GraphNode;
      const targetX = xScale(subjectNode.year); // Snap x to its year

      if (props.usePhysics) {
        if (!event.active) {
          simulation?.alphaTarget(0);
        }
        subjectNode.fx = targetX; // Snap to year-based x
        subjectNode.fy = event.y; // Keep current y (or subjectNode.y if event.y is problematic)
      } else {
        subjectNode.x = targetX;
        subjectNode.y = event.y; // Keep current y

        // Manually update visual elements
        d3.select(event.sourceEvent.target as SVGCircleElement)
          .attr('cx', subjectNode.x)
          .attr('cy', subjectNode.y);

        svgSel.selectAll('text')
          .filter((d: unknown) => (d as GraphNode).id === subjectNode.id)
          .attr('x', subjectNode.x)
          .attr('y', (subjectNode.y ?? 0) - 12);

        // Update links connected to this node
        link
          .filter((l: any) => l.source.id === subjectNode.id || l.target.id === subjectNode.id)
          .attr('x1', (d: any) => (d.source as GraphNode).x!)
          .attr('y1', (d: any) => (d.source as GraphNode).y!)
          .attr('x2', (d: any) => (d.target as GraphNode).x!)
          .attr('y2', (d: any) => (d.target as GraphNode).y!);
      }

      // Store the user-set fy value
      if (props.usePhysics) {
        if (subjectNode.fy !== null && subjectNode.fy !== undefined) {
          userPositionedNodes.value.set(subjectNode.id, { fy: subjectNode.fy });
        }
      } else {
        if (subjectNode.y !== null && subjectNode.y !== undefined) {
          userPositionedNodes.value.set(subjectNode.id, { fy: subjectNode.y });
        }
      }
    }
  }

  // Komponente nach dem Mounting rendern

  onMounted(() => {
    render();
    resizeObserver = new ResizeObserver(() => render());
    if (container.value) resizeObserver.observe(container.value);
  });

  // Simulation und ResizeObserver beim Unmount stoppen, um Speicherlecks zu vermeiden
  onBeforeUnmount(() => {
    simulation?.stop();
    resizeObserver?.disconnect();
  });

  watch(() => [props.nodes, props.links], render, { deep: true });

  watch(
    () => props.usePhysics,
    () => {
      if (!props.usePhysics) simulation?.stop();
      render();
    },
  );

  // Watch for changes in currentYearRange to re-render
  watch(() => props.currentYearRange, render, { deep: true });
</script>

<style scoped>
  .ki-stammbaum-container {
    width: auto;
    margin-left: 20px;
    margin-right: 20px;
    height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  }

  .ki-stammbaum-container h2 {
    margin-bottom: 20px;
    color: #333;
    font-size: 1.5rem;
  }

  /* SVG-Element für die D3.js-Visualisierung */
  .ki-stammbaum-svg {
    width: 100%;
    height: 100%;
    border: 1px solid #ccc; /* Visueller Platzhalter während der Entwicklung */
    border-radius: 4px;
    background-color: #fafafa; /* Leichter Hintergrund für bessere Sichtbarkeit */
    cursor: grab;
  }

  .ki-stammbaum-svg text {
    font-family: 'Arial', sans-serif;
    fill: #666;
  }
</style>
