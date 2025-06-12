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
  import { onMounted, onBeforeUnmount, ref, watch, withDefaults } from 'vue';
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

  const props = withDefaults(
    defineProps<{
      nodes?: Node[]; // Changed from GraphNode[] to Node[] as props.nodes are raw
      links?: Link[];
      usePhysics?: boolean;
      currentYearRange: [number, number];
    }>(),
    { usePhysics: true },
  );

  const emit = defineEmits<{
    conceptSelected: [node: GraphNode];
    centerOnYear: [year: number]; // New event for x-axis navigation
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
    // --- START CLUSTERING LOGIC ---
    const displayNodes: GraphNode[] = [];
    if (props.nodes && props.nodes.length > 0) {
        const groupedByYearAndCategory = d3.group(props.nodes, d => d.year, d => d.category);

        groupedByYearAndCategory.forEach((categoriesInYear, yearVal) => {
            categoriesInYear.forEach((originalNodesInGroup, categoryVal) => {
                const year = Number(yearVal);
                const category = String(categoryVal);

                if (originalNodesInGroup.length > 1) { // Create a cluster node
                    const clusterId = `cluster-${year}-${category}`;
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
                        fy: null,
                    });
                } else { // Single node, add as is but typed as GraphNode
                    const originalNode = originalNodesInGroup[0];
                    const graphNodeVersion: GraphNode = {
                       ...originalNode,
                       isCluster: false,
                       count: 1,
                       fx: null,
                       fy: null,
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

    // Farbskala pro Kategorie - Use categories from displayNodes for consistency
    const color = d3
      .scaleOrdinal<string>()
      .domain(categoriesForScale)
      .range(d3.schemeCategory10);

    // Hauptgruppe für alle grafischen Elemente
    const g = svgSel.append('g');

    // Zoom- und Pan-Interaktion auf das gesamte SVG anwenden
    // This should be called on svgSel, and the background rect will be part of svgSel.
    // Zoom events should still work. Clicks on nodes will be handled by node click handlers.
    // Clicks on the background rect will be handled by its handler.
    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (ev) => {
        // Apply zoom transform to the main group 'g'
        g.attr('transform', ev.transform.toString());
      });
    svgSel.call(zoomBehavior as any);

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

    // Links zeichnen (append to g, use visualLinks)
    const link = g
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(visualLinks) // Use visualLinks
      .join('line')
      .attr('stroke-width', 1.5);

    // Knoten zeichnen (use displayNodes)
    const node = g
      .append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(displayNodes, (d: GraphNode) => d.id) // Use displayNodes and GraphNode type for key func
      .join('circle')
      .attr('r', (d: GraphNode) => d.isCluster ? 10 : 6) // Larger radius for clusters
      .attr('fill', (d: GraphNode) => { // Darker color for clusters
          const baseColor = color(d.category)!;
          return d.isCluster ? d3.color(baseColor)?.darker(0.5).toString() ?? '#555' : baseColor;
      })
      .style('cursor', 'pointer')
      .on('click', (_e, d) => emit('conceptSelected', d as GraphNode)); // d is now from displayNodes

    // Labels hinzufügen (use displayNodes)
    const labels = g
      .append('g')
      .selectAll('text')
      .data(displayNodes, (d: GraphNode) => d.id) // Use displayNodes and GraphNode type for key func
      .join('text')
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#333')
      .text((d: GraphNode) => d.name ?? d.id); // Cluster name or original name

    node.call(
      d3
        .drag<SVGCircleElement, GraphNode>() // d is GraphNode from displayNodes
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded),
    );

    if (props.usePhysics) {
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
      node
        .attr('cx', (d: GraphNode) => d.x!)
        .attr('cy', (d: GraphNode) => d.y!);
      labels
        .attr('x', (d: GraphNode) => d.x!)
        .attr('y', (d: GraphNode) => (d.y ?? 0) - 12);
      link // Using visualLinks, source/target are GraphNode from displayNodes
        .attr('x1', (d: any) => (d.source as GraphNode).x!)
        .attr('y1', (d: any) => (d.source as GraphNode).y!)
        .attr('x2', (d: any) => (d.target as GraphNode).x!)
        .attr('y2', (d: any) => (d.target as GraphNode).y!);
    }

    // Ticked function updates positions for displayNodes and visualLinks
    function ticked() {
      link // visualLinks
        .attr('x1', (d: any) => (d.source as GraphNode).x!)
        .attr('y1', (d: any) => (d.source as GraphNode).y!)
        .attr('x2', (d: any) => (d.target as GraphNode).x!)
        .attr('y2', (d: any) => (d.target as GraphNode).y!);
      node
        .attr('cx', (d: any) => (d as GraphNode).x!)
        .attr('cy', (d: any) => (d as GraphNode).y!);
      labels
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
    width: 100%;
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
