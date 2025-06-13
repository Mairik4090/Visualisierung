<template>
  <div ref="container" class="ki-stammbaum-container">
    <svg
      ref="svg"
      class="ki-stammbaum-svg"
      aria-label="KI-Stammbaum Visualisierung"
      role="img"
    >
      <title>KI-Stammbaum Visualisierung</title>
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
    <div
      ref="tooltip"
      class="tooltip"
      style="opacity: 0; position: absolute"
    ></div>
  </div>
</template>

<script setup lang="ts">
  import {
    onMounted,
    onBeforeUnmount,
    ref,
    watch,
    withDefaults,
    type PropType,
  } from 'vue';
  import * as d3 from 'd3';
  import type { Node, Link } from '@/types/concept';

  const ZOOM_SCALE_THRESHOLD = 0.05; // Threshold for zoom scale change
  const YEAR_RANGE_THRESHOLD = 1; // Threshold for year range change (in years)
  let previousZoomScale: number | null = null;
  let previousVisibleYearRange: [number, number] | null = null;

  // New zoom thresholds
  const GLOBAL_CLUSTER_THRESHOLD = 0.5;
  const CATEGORY_DECADE_CLUSTER_THRESHOLD = 1.0;
  const CATEGORY_YEAR_CLUSTER_THRESHOLD = 1.8;

  interface GraphNode extends Node {
    name?: string;
    x?: number; // Current x position
    y?: number; // Current y position
    fx?: number | null; // Fixed x position (for physics)
    fy?: number | null; // Fixed y position (for physics)
    isCluster?: boolean; // True if this node represents a cluster
    count?: number; // Number of original nodes it represents (1 if not a cluster)
    childNodes?: Node[]; // Array of original nodes if it's a cluster
    categoriesInCluster?: string[]; // For global clusters
    categoryColorsInCluster?: string[]; // For global clusters
  }

  const props = defineProps({
    nodes: { type: Array as PropType<Node[] | undefined> },
    links: { type: Array as PropType<Link[] | undefined> },
    usePhysics: { type: Boolean, default: true },
    currentYearRange: {
      type: Array as PropType<[number, number]>,
      required: true,
    },
    highlightNodeId: { type: String as PropType<string | null>, default: null }, // ID of node to highlight on hover
    selectedNodeId: { type: String as PropType<string | null>, default: null }, // ID of node currently selected for detailed view / interaction highlighting
  });

  const emit = defineEmits<{
    conceptSelected: [node: GraphNode];
    centerOnYear: [year: number]; // New event for x-axis navigation
    nodeHovered: [nodeId: string | null]; // New emit for hover events
    mainViewRangeChanged: [range: [number, number]]; // New emit
  }>();

  /**
   * SVG-Referenz für alle D3-Manipulationen
   * Wird verwendet, um das DOM-Element direkt mit D3.js zu steuern
   */
  const svg = ref<SVGSVGElement | null>(null);
  const container = ref<HTMLElement | null>(null);
  const tooltip = ref<HTMLElement | null>(null); // Tooltip element reference
  let resizeObserver: ResizeObserver | null = null;
  let lastRenderedYearRange: [number, number] | null = null;

  /** Aktuelle D3-Simulation zur späteren Bereinigung */
  let simulation: d3.Simulation<GraphNode, Link> | null = null; // Updated Link type
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let lastTransform: d3.ZoomTransform = d3.zoomIdentity;

  const userPositionedNodes = ref<Map<string, { fy: number }>>(new Map());

  // Declare scales at a higher scope
  let xScale: d3.ScaleLinear<number, number> | null = null;
  let yScale: d3.ScalePoint<string> | null = null;

  /**
   * Debounce utility function.
   * Limits the rate at which a function can fire.
   * @param func The function to debounce.
   * @param waitFor The time in milliseconds to wait before calling the function.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function debounce<F extends (...args: any[]) => any>(
    func: F,
    waitFor: number,
  ) {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
      new Promise((resolve) => {
        if (timeout) {
          clearTimeout(timeout);
        }

        timeout = setTimeout(() => resolve(func(...args)), waitFor);
      });
  }

  /**
   * Contains the logic to be executed after zoom/pan, specifically:
   * - Emitting the new visible year range for timeline synchronization.
   * - Re-rendering the graph (which includes re-clustering and D3 updates).
   * This function is debounced to prevent excessive calculations during rapid zoom/pan.
   */
  function processZoomLogic() {
    if (xScale && svg.value && lastTransform) {
      const currentWidth = svg.value.clientWidth;
      const minVisibleDataX = lastTransform.invertX(0);
      const maxVisibleDataX = lastTransform.invertX(currentWidth);

      if (typeof xScale.invert !== 'function') {
        return;
      }
      const minVisibleYear = xScale.invert(minVisibleDataX);
      const maxVisibleYear = xScale.invert(maxVisibleDataX);
      const currentZoomScale = lastTransform.k;

      let shouldRender = false;

      if (previousZoomScale === null) {
        shouldRender = true;
      } else if (
        Math.abs(currentZoomScale - previousZoomScale) > ZOOM_SCALE_THRESHOLD
      ) {
        shouldRender = true;
      }

      const roundedMinVisibleYear = Math.round(minVisibleYear);
      const roundedMaxVisibleYear = Math.round(maxVisibleYear);

      if (previousVisibleYearRange === null) {
        shouldRender = true;
      } else if (
        Math.abs(roundedMinVisibleYear - previousVisibleYearRange[0]) >=
          YEAR_RANGE_THRESHOLD ||
        Math.abs(roundedMaxVisibleYear - previousVisibleYearRange[1]) >=
          YEAR_RANGE_THRESHOLD
      ) {
        shouldRender = true;
      }

      if (roundedMinVisibleYear > roundedMaxVisibleYear) {
        if (
          previousVisibleYearRange !== null &&
          previousVisibleYearRange[0] <= previousVisibleYearRange[1]
        ) {
          shouldRender = true;
        } else if (previousVisibleYearRange === null) {
          shouldRender = true;
        }
      }

      if (shouldRender) {
        previousZoomScale = currentZoomScale;
        previousVisibleYearRange = [
          roundedMinVisibleYear,
          roundedMaxVisibleYear,
        ];
        render();
      }
    }
  }

  // Create a debounced version of processZoomLogic.
  // This means processZoomLogic will only be called 250ms after the last zoom event.
  const debouncedProcessZoom = debounce(processZoomLogic, 250);

  function render(): void {
    if (!svg.value || !props.nodes || props.nodes.length === 0) return;
    simulation?.stop(); // Stop any ongoing simulation before re-rendering

    const svgSel = d3.select(svg.value);
    svgSel.selectAll('*').remove(); // Clear previous SVG content before re-rendering

    const width = svg.value.clientWidth || 600; // Get current dimensions
    const height = svg.value.clientHeight || 400;

    svgSel
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet'); // Ensure responsive scaling

    // Define SVG markers for link arrowheads
    // This <defs> section contains reusable graphical elements.
    svgSel
      .append('defs')
      .append('marker') // Define a marker element
      .attr('id', 'arrowhead') // Unique ID for referencing
      .attr('viewBox', '-0 -5 10 10') // The viewport of the marker
      .attr('refX', 19) // Marker position along the path (adjusted for node radius and marker size)
      .attr('refY', 0) // Vertical alignment
      .attr('orient', 'auto') // Rotates the marker to follow the line's angle
      .attr('markerWidth', 6) // Display width of the marker
      .attr('markerHeight', 6) // Display height of the marker
      .attr('xoverflow', 'visible') // Ensures marker is not clipped
      .append('svg:path') // Define the arrowhead shape
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5') // Path data for a triangle
      .attr('fill', '#999') // Arrowhead color
      .style('stroke', 'none'); // No stroke for the arrowhead itself

    // Add a background rectangle for capturing clicks on empty SVG space
    // This allows emitting 'centerOnYear' when user clicks the background.
    svgSel
      .insert('rect', ':first-child') // Insert before other elements to be in the background
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent') // Make it invisible
      .on('click', function (event: PointerEvent) {
        // Only if the click is on the rect itself (empty space), not on a node/link.
        if (!xScale) return;
        // 'this' is the DOM element (the rect). d3.pointer provides coordinates relative to this element.
        const clickedX = d3.pointer(event, this)[0];
        const targetYear = xScale.invert(clickedX); // Convert SVG x-coordinate back to year
        emit('centerOnYear', Math.round(targetYear)); // Emit event to parent
      });

    // Filter nodes based on the currentYearRange prop from the timeline.
    // This determines which nodes are within the visible horizontal span of the SVG.
    let filteredNodes: Node[] = [];
    if (props.nodes && props.nodes.length > 0) {
      filteredNodes = props.nodes.filter(
        (node) =>
          node.year >= props.currentYearRange[0] &&
          node.year <= props.currentYearRange[1],
      );
    }

    // --- START CLUSTERING LOGIC ---
    // Determines which nodes (individual or clustered) are displayed based on the current zoom level.
    const displayNodes: GraphNode[] = [];
    const currentZoomScale = lastTransform.k; // Current zoom factor

    // Define color scale here so it can be used by clustering logic
    const allNodeCategories = Array.from(
      new Set(filteredNodes.map((n) => n.category)),
    );
    const color = d3
      .scaleOrdinal<string>()
      .domain(allNodeCategories)
      .range(d3.schemeCategory10);

    if (filteredNodes.length > 0) {
      // Most Zoomed Out: Global Clusters by 50-year buckets
      if (currentZoomScale < GLOBAL_CLUSTER_THRESHOLD) {
        const yearBucketSize = 50; // Define bucket size (e.g., 50 years)
        const groupedByGlobalBuckets = d3.group(
          filteredNodes,
          (d) => Math.floor(d.year / yearBucketSize) * yearBucketSize,
        );

        groupedByGlobalBuckets.forEach((nodesInBucket, bucketYear) => {
          const representativeYear = bucketYear + yearBucketSize / 2; // Center of the bucket
          const clusterId = `global-cluster-${bucketYear}`;
          const childNodes = [...nodesInBucket];
          const categoriesInCluster = Array.from(
            new Set(childNodes.map((n) => n.category)),
          );
          const categoryColorsInCluster = categoriesInCluster.map((cat) =>
            color(cat),
          );

          displayNodes.push({
            id: clusterId,
            year: representativeYear,
            category: 'global_cluster', // Assign a generic category
            name: `${childNodes.length} items (ca. ${bucketYear} - ${bucketYear + yearBucketSize - 1})`,
            description: `Global cluster of ${childNodes.length} concepts from ${bucketYear} to ${bucketYear + yearBucketSize - 1}. Categories: ${categoriesInCluster.join(', ')}`,
            dependencies: [],
            isCluster: true,
            count: childNodes.length,
            childNodes: childNodes,
            categoriesInCluster: categoriesInCluster,
            categoryColorsInCluster: categoryColorsInCluster,
            fx: null,
            fy: userPositionedNodes.value.get(clusterId)?.fy ?? null,
          });
        });
        // Category-Decade Clusters
      } else if (currentZoomScale < CATEGORY_DECADE_CLUSTER_THRESHOLD) {
        const groupedByDecadeAndCategory = d3.group(
          filteredNodes,
          (d) => Math.floor(d.year / 10) * 10, // Group by decade
          (d) => d.category, // Then by category
        );

        groupedByDecadeAndCategory.forEach((categoriesInDecade, decade) => {
          categoriesInDecade.forEach((childNodesInGroup, category) => {
            const representativeYear = decade + 5; // Mid-point of the decade
            const clusterId = `cat-decade-cluster-${decade}-${category}`;
            displayNodes.push({
              id: clusterId,
              year: representativeYear,
              category: category,
              name: `${childNodesInGroup.length} ${category} (${decade}s)`,
              description: `Cluster of ${childNodesInGroup.length} ${category} concepts from the ${decade}s`,
              dependencies: [],
              isCluster: true,
              count: childNodesInGroup.length,
              childNodes: childNodesInGroup,
              fx: null,
              fy: userPositionedNodes.value.get(clusterId)?.fy ?? null,
            });
          });
        });
        // Category-Year Clusters
      } else if (currentZoomScale < CATEGORY_YEAR_CLUSTER_THRESHOLD) {
        const groupedByYearAndCategory = d3.group(
          filteredNodes,
          (d) => d.year,
          (d) => d.category,
        );

        groupedByYearAndCategory.forEach((categoriesInYear, yearVal) => {
          categoriesInYear.forEach((originalNodesInGroup, categoryVal) => {
            const year = Number(yearVal);
            const category = String(categoryVal);

            if (originalNodesInGroup.length > 1) {
              // Create cluster if more than one node
              const clusterId = `cat-year-cluster-${year}-${category}`;
              displayNodes.push({
                id: clusterId,
                year: year,
                category: category,
                name: `${originalNodesInGroup.length} ${category} (${year})`,
                description: `Cluster of ${originalNodesInGroup.length} ${category} items for ${year}`,
                dependencies: [],
                isCluster: true,
                count: originalNodesInGroup.length,
                childNodes: originalNodesInGroup,
                fx: null,
                fy: userPositionedNodes.value.get(clusterId)?.fy ?? null,
              });
            } else {
              // Single node in this group, push individually
              originalNodesInGroup.forEach((originalNode) => {
                const userSetFy = userPositionedNodes.value.get(
                  originalNode.id,
                )?.fy;
                displayNodes.push({
                  ...originalNode,
                  isCluster: false,
                  count: 1,
                  fx: null,
                  fy: userSetFy ?? null,
                });
              });
            }
          });
        });
        // Highest Zoom: Show individual nodes
      } else {
        filteredNodes.forEach((originalNode) => {
          const userSetFy = userPositionedNodes.value.get(originalNode.id)?.fy;
          displayNodes.push({
            ...originalNode,
            isCluster: false,
            count: 1,
            fx: null, // fx will be set by physics if enabled
            fy: userSetFy ?? null,
          });
        });
      }
    }
    // --- END CLUSTERING LOGIC ---

    // X-axis scale: maps years to horizontal positions.
    xScale = d3
      .scaleLinear()
      .domain(props.currentYearRange) // Domain is the visible year range.
      .range([40, width - 40]); // Range is the pixel space available.

    // Y-axis scale: maps categories to vertical positions.
    // Using a point scale for discrete categories.
    const categoriesForScale = Array.from(
      new Set(displayNodes.map((d: GraphNode) => d.category)),
    );
    yScale = d3
      .scalePoint<string>()
      .domain(categoriesForScale)
      .range([40, height - 40]); // Padding from top/bottom edges.

    // Initialize node positions (x, y) based on their year and category.
    // These positions are used for rendering, especially if physics is off,
    // or as initial positions for the physics simulation.
    displayNodes.forEach((n: GraphNode) => {
      if (
        xScale &&
        yScale &&
        typeof n.year === 'number' &&
        typeof n.category === 'string'
      ) {
        n.x = xScale(n.year); // Calculate x from year.
        // For global clusters, assign a generic y position or handle differently if needed
        n.y = n.category === 'global_cluster' ? height / 2 : yScale(n.category);
      } else {
        // Fallback position if year/category is missing (should ideally not happen for valid data).
        n.x = width / 2;
        n.y = height / 2;
      }
      // fx/fy (fixed positions for physics) are already initialized or preserved from user drags.
    });

    // If physics is enabled, set fixed x-positions (fx) for all nodes to their year-based x.
    // This keeps them aligned horizontally by year while allowing vertical movement by forces/drag.
    if (props.usePhysics) {
      displayNodes.forEach((n: GraphNode) => {
        if (xScale && typeof n.year === 'number') {
          n.fx = xScale(n.year);
          // n.fy is preserved if already set by user dragging.
          // Otherwise, it's null, and the Y-force or initial Y position will determine it.
        }
      });
    }

    // Main <g> element to hold all visual elements (nodes, links, labels).
    // Zoom transformations will be applied to this group.
    const g = svgSel.append('g');

    // Initialize D3 zoom behavior if it hasn't been already.
    // This is done once and reused across re-renders.
    if (!zoomBehavior) {
      zoomBehavior = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 5]) // Min/max zoom levels.
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          // Apply the transform immediately for responsiveness
          if (g) {
            // Ensure g is initialized
            g.attr('transform', event.transform.toString());
          }
          lastTransform = event.transform; // Store the latest transform state

          // Debounce the more expensive operations
          debouncedProcessZoom();
        });
    }

    // Attach the zoom behavior to the SVG element.
    svgSel.call(zoomBehavior as any);

    // Restore the last known zoom/pan transform.
    // This is important for maintaining the view state across re-renders (e.g., data updates).
    if (lastTransform && zoomBehavior) {
      (zoomBehavior as d3.ZoomBehavior<SVGSVGElement, unknown>).transform(
        svgSel as any, // Apply to the SVG selection
        lastTransform, // Using the stored transform
      );
    }

    // --- LINK RE-MAPPING ---
    function findVisualNodeRepresenting(
      originalId: string,
      nodesToSearch: GraphNode[],
    ): GraphNode | undefined {
      let found = nodesToSearch.find(
        (n) => !n.isCluster && n.id === originalId,
      );
      if (found) return found;
      // If not found as a direct node, check if it's part of a cluster
      found = nodesToSearch.find(
        (n) =>
          n.isCluster && n.childNodes?.some((child) => child.id === originalId),
      );
      return found;
    }

    const allVisualLinks: d3.SimulationLinkDatum<GraphNode>[] = [];
    if (props.links) {
      props.links.forEach((originalLink) => {
        const sourceVisual = findVisualNodeRepresenting(
          originalLink.source,
          displayNodes, // Use unculled displayNodes for correct mapping
        );
        const targetVisual = findVisualNodeRepresenting(
          originalLink.target,
          displayNodes, // Use unculled displayNodes for correct mapping
        );

        if (
          sourceVisual &&
          targetVisual &&
          sourceVisual.id !== targetVisual.id
        ) {
          allVisualLinks.push({ source: sourceVisual, target: targetVisual });
        }
      });
    }
    // --- END LINK RE-MAPPING ---

    // --- START VIEWPORT CULLING ---
    // Filters nodes and links to only those currently visible or near the viewport,
    // significantly improving rendering performance for large graphs.
    let culledDisplayNodes = displayNodes;
    let culledVisualLinks = allVisualLinks;
    const cullingBuffer = 100; // Buffer in pixels to include elements slightly outside the strict viewport.

    // Ensure necessary elements are available and transform is valid (k > 0).
    if (svg.value && xScale && yScale && lastTransform && lastTransform.k > 0) {
      // Calculate the viewport boundaries in the original, unzoomed data coordinate system.
      // lastTransform.invert() converts screen coordinates (SVG pixels) back to the base data coordinates.
      const [viewportMinDataX, viewportMinDataY] = lastTransform.invert([0, 0]); // Top-left of SVG
      const [viewportMaxDataX, viewportMaxDataY] = lastTransform.invert([
        width,
        height,
      ]); // Bottom-right of SVG

      // Filter displayNodes: Keep only nodes whose calculated positions fall within the
      // viewport boundaries (plus buffer). Node positions (node.x, node.y) are pre-calculated
      // based on the unzoomed xScale and yScale.
      culledDisplayNodes = displayNodes.filter((node) => {
        // Node's original x position based on its year.
        const nodeX = xScale!(node.year);
        // Node's original y position based on its category. Fallback if category not in scale (e.g. for some cluster types)
        const nodeY = yScale.domain().includes(node.category)
          ? yScale!(node.category)!
          : height / 2;

        return (
          nodeX >= viewportMinDataX - cullingBuffer &&
          nodeX <= viewportMaxDataX + cullingBuffer &&
          nodeY >= viewportMinDataY - cullingBuffer &&
          nodeY <= viewportMaxDataY + cullingBuffer
        );
      });

      // Create a set of IDs of the culled nodes for efficient link filtering.
      const culledNodeIds = new Set(culledDisplayNodes.map((n) => n.id));
      // Filter allVisualLinks: Keep only links where both source and target nodes are in culledDisplayNodes.
      culledVisualLinks = allVisualLinks.filter((link) => {
        const sourceNode = link.source as GraphNode; // Cast because they are GraphNode after re-mapping
        const targetNode = link.target as GraphNode;
        return (
          culledNodeIds.has(sourceNode.id) && culledNodeIds.has(targetNode.id)
        );
      });
    }
    // --- END VIEWPORT CULLING ---

    const transitionDuration = 300;

    // D3 Data Join for Links:
    // Select all existing 'line' elements, bind them to `culledVisualLinks` data.
    const linkSelection = g
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(culledVisualLinks, (d: any) => `${d.source.id}-${d.target.id}`);

    linkSelection
      .exit()
      .transition()
      .duration(transitionDuration)
      .attr('stroke-opacity', 0)
      .remove();

    const linkEnter = linkSelection
      .enter()
      .append('line')
      .attr('stroke-opacity', 0) // Start transparent for enter transition
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)'); // Apply arrowhead to new links

    // Merge enter and update selections for links.
    // Attributes common to new and existing links will be set on this selection.
    const linkUpdateAndEnter = linkEnter.merge(linkSelection);

    // D3 Data Join for Nodes:
    // Select all 'circle' elements, bind to `culledDisplayNodes` data.
    const nodeSelection = g
      .append('g')
      .selectAll('circle')
      .data(culledDisplayNodes, (d: GraphNode) => d.id);

    nodeSelection
      .exit()
      .transition()
      .duration(transitionDuration)
      .attr('r', 0)
      .style('opacity', 0)
      .remove();

    const nodeEnter = nodeSelection
      .enter()
      .append('circle')
      .attr('r', 0)
      .style('opacity', 0)
      .attr('fill', (d: GraphNode) => {
        if (d.isCluster) {
          if (d.category === 'global_cluster') {
            return d.categoryColorsInCluster &&
              d.categoryColorsInCluster.length > 0
              ? d.categoryColorsInCluster[0]
              : '#888'; // Use first color or fallback grey
          }
          const baseColor = color(d.category)!;
          return d3.color(baseColor)?.darker(0.5).toString() ?? '#555';
        }
        return color(d.category)!;
      })
      .style('cursor', 'pointer') // Indicate nodes are interactive.
      // Click handler for nodes.
      .on('click', (_e, d: GraphNode) => {
        // Check if the clicked node is a cluster and has child nodes.
        if (d.isCluster && d.childNodes && d.childNodes.length > 0) {
          // Always treat as a selection, regardless of zoom or cluster type for now.
          emit('conceptSelected', d);
        } else {
          // If it's not a cluster or has no children, emit conceptSelected event.
          emit('conceptSelected', d);
        }
      })
      // Mouseover event handler for showing tooltip.
      .on('mouseover', function (event: MouseEvent, d: GraphNode) {
        // Use 'function' to access 'this' if needed by D3, though not used here.
        emit('nodeHovered', d.id); // Emit hover event for parent component.
        if (tooltip.value) {
          // Check if tooltip DOM element is available.
          let tooltipContent = '';
          if (d.isCluster) {
            if (d.category === 'global_cluster') {
              tooltipContent = `
                <strong>Cluster: ${d.name ?? 'N/A'}</strong><br>
                Time Span: Approx. ${d.year ? d.year - 25 + ' - ' + (d.year + 24) : 'N/A'}<br>
                Total Items: ${d.count ?? 'N/A'}<br>
                Categories: ${d.categoriesInCluster ? d.categoriesInCluster.join(', ') : 'N/A'}
              `;
            } else if (d.id.startsWith('cat-decade-cluster-')) {
              tooltipContent = `
                <strong>Decade Cluster: ${d.name ?? 'N/A'}</strong><br>
                Category: ${d.category ?? 'N/A'}<br>
                Total Items: ${d.count ?? 'N/A'}<br>
                Description: ${d.description || 'No short description available.'}
              `;
            } else if (d.id.startsWith('cat-year-cluster-')) {
              tooltipContent = `
                <strong>Year Cluster: ${d.name ?? 'N/A'}</strong><br>
                Category: ${d.category ?? 'N/A'}<br>
                Year: ${d.year ?? 'N/A'}<br>
                Total Items: ${d.count ?? 'N/A'}<br>
                Description: ${d.description || 'No short description available.'}
              `;
            } else {
              // Generic cluster (though should be covered by above)
              tooltipContent = `
                <strong>Cluster: ${d.name ?? 'N/A'}</strong><br>
                Total Items: ${d.count ?? 'N/A'}<br>
                Description: ${d.description || 'No short description available.'}
              `;
            }
          } else {
            // Individual node
            tooltipContent = `
              <strong>${d.name ?? 'N/A'}</strong><br>
              Year of Origin: ${d.year ?? 'N/A'}<br>
              Category: ${d.category ?? 'N/A'}<br>
              Short Description: ${d.description || 'No short description available.'}
            `;
          }
          tooltip.value.innerHTML = tooltipContent;
          tooltip.value.style.opacity = '0.9'; // Make tooltip visible.
          // Position tooltip near the mouse cursor.
          tooltip.value.style.left = `${event.pageX + 15}px`;
          tooltip.value.style.top = `${event.pageY - 10}px`;
        }
      })
      // Mouseout event handler for hiding tooltip.
      .on('mouseout', function () {
        emit('nodeHovered', null); // Clear hover state in parent.
        if (tooltip.value) {
          tooltip.value.style.opacity = '0'; // Make tooltip invisible.
          // Optionally reset position to avoid brief flashes of old content at old positions.
          tooltip.value.style.left = `0px`;
          tooltip.value.style.top = `0px`;
        }
      });

    // Merge enter and update selections for nodes.
    const nodeUpdateAndEnter = nodeEnter.merge(nodeSelection);

    // Apply D3 drag behavior to all nodes (both new and existing).
    // This allows users to manually reposition nodes.
    nodeUpdateAndEnter.call(
      d3
        .drag<SVGCircleElement, GraphNode>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded),
    );

    // Labels hinzufügen (use culledDisplayNodes)
    const labelSelection = g
      .append('g')
      .selectAll('text')
      .data(culledDisplayNodes, (d: GraphNode) => d.id);

    labelSelection
      .exit()
      .transition()
      .duration(transitionDuration)
      .style('opacity', 0)
      .remove();

    const labelEnter = labelSelection
      .enter()
      .append('text')
      .style('opacity', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#333')
      .text((d: GraphNode) => d.name ?? d.id);

    const labelUpdateAndEnter = labelEnter.merge(labelSelection);
    // Attributes and styles for labels are set based on whether physics is used or not.

    // --- Physics vs. Static Positioning ---
    if (props.usePhysics) {
      // Physics-based layout: D3 simulation will update positions.
      nodeUpdateAndEnter // Apply to all nodes (new and existing).
        .attr('r', (d: GraphNode) =>
          d.isCluster ? (d.count && d.count > 10 ? 14 : 10) : 6,
        )
        .style('opacity', 1) // Make nodes visible.
        // Highlight stroke for nodes matching `highlightNodeId` (hover effect).
        .attr('stroke', (d: GraphNode) =>
          d.id === props.highlightNodeId ? 'orange' : '#fff',
        )
        .attr(
          'stroke-width',
          (d: GraphNode) => (d.id === props.highlightNodeId ? 3 : 1.5), // Thicker stroke for highlighted.
        );
      // Node cx, cy (center positions) will be set by the simulation's tick function.

      labelUpdateAndEnter.style('opacity', 1); // Make labels visible.
      // Label x, y positions will also be set by the tick function.

      linkUpdateAndEnter.attr('stroke-opacity', 0.6); // Make links visible.
      // Link x1, y1, x2, y2 attributes will be set by the tick function.

      // Initialize or restart the D3 force simulation.
      simulation = d3
        .forceSimulation(displayNodes) // Use unculled displayNodes for simulation stability
        .force(
          // Add a "link" force to position nodes based on links.
          'link',
          d3
            .forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(
              allVisualLinks, // Use unculled links for simulation
            )
            .id((d: GraphNode) => d.id) // Accessor for node ID.
            .distance(60), // Preferred distance between linked nodes.
        )
        // Add a "charge" force (many-body force) to make nodes repel each other.
        .force('charge', d3.forceManyBody().strength(-120))
        // Add an "x" force to pull nodes towards their year-based x-position.
        .force('x', d3.forceX<GraphNode>((d) => d.x!).strength(0.3))
        // Add a "y" force to pull nodes towards their category-based y-position (weaker).
        .force('y', d3.forceY<GraphNode>((d) => d.y!).strength(0.05))
        .on('tick', ticked); // Register the 'ticked' function to run on each simulation step.
    } else {
      // Static layout: Positions are set directly based on scales, no simulation.
      // Apply transitions for smoother visual updates when not using physics.
      nodeUpdateAndEnter
        .transition()
        .duration(transitionDuration)
        .attr('cx', (d: GraphNode) => d.x!) // Set x center from pre-calculated position.
        .attr('cy', (d: GraphNode) => d.y!) // Set y center.
        .attr('r', (d: GraphNode) =>
          d.isCluster ? (d.count && d.count > 10 ? 14 : 10) : 6,
        )
        .style('opacity', 1)
        .attr('stroke', (d: GraphNode) =>
          d.id === props.highlightNodeId ? 'orange' : '#fff',
        )
        .attr('stroke-width', (d: GraphNode) =>
          d.id === props.highlightNodeId ? 3 : 1.5,
        );

      labelUpdateAndEnter
        .transition()
        .duration(transitionDuration)
        .attr('x', (d: GraphNode) => d.x!) // Set label x position.
        .attr('y', (d: GraphNode) => (d.y ?? 0) - 12) // Position label above the node.
        .style('opacity', 1);

      linkUpdateAndEnter
        .transition()
        .duration(transitionDuration)
        .attr('x1', (d: any) => (d.source as GraphNode).x!) // Link start x.
        .attr('y1', (d: any) => (d.source as GraphNode).y!) // Link start y.
        .attr('x2', (d: any) => (d.target as GraphNode).x!) // Link end x.
        .attr('y2', (d: any) => (d.target as GraphNode).y!) // Link end y.
        .attr('stroke-opacity', 0.6);
    }

    // `ticked` function: Called on each step of the physics simulation.
    // Updates the positions of nodes, links, and labels.
    function ticked() {
      linkUpdateAndEnter // Update link endpoints.
        .attr('x1', (d: any) => (d.source as GraphNode).x!)
        .attr('y1', (d: any) => (d.source as GraphNode).y!)
        .attr('x2', (d: any) => (d.target as GraphNode).x!)
        .attr('y2', (d: any) => (d.target as GraphNode).y!);
      nodeUpdateAndEnter // Update node center positions.
        .attr('cx', (d: any) => (d as GraphNode).x!)
        .attr('cy', (d: any) => (d as GraphNode).y!);
      labelUpdateAndEnter // Update label positions.
        .attr('x', (d: any) => (d as GraphNode).x!)
        .attr('y', (d: any) => ((d as GraphNode).y ?? 0) - 12); // Keep label above node.
    }

    // --- D3 Drag Event Handlers ---
    function dragStarted(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
    ) {
      event.sourceEvent?.stopPropagation(); // Prevent zoom/pan during node drag.
      const subjectNode = event.subject as GraphNode;
      if (!event.active && props.usePhysics) {
        // "Reheat" the simulation if it has cooled down and physics is active.
        simulation?.alphaTarget(0.3).restart();
      }
      // Set fixed positions (fx, fy) to current node positions at drag start.
      // This allows the node to be dragged from its current spot.
      subjectNode.fx = subjectNode.x ?? 0;
      subjectNode.fy = subjectNode.y ?? 0;
    }

    function dragged(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
    ) {
      event.sourceEvent?.stopPropagation();
      const subjectNode = event.subject as GraphNode;

      if (props.usePhysics) {
        // If physics is on, update the fixed positions (fx, fy) to the drag event's coordinates.
        // The simulation will then pull other nodes accordingly.
        subjectNode.fx = event.x;
        subjectNode.fy = event.y;
      } else {
        // If physics is off, directly update the node's x, y data attributes.
        subjectNode.x = event.x;
        subjectNode.y = event.y;

        // Manually update the visual attributes of the dragged circle and its label.
        d3.select(event.sourceEvent.target as SVGCircleElement)
          .attr('cx', subjectNode.x)
          .attr('cy', subjectNode.y);

        svgSel // Find the corresponding label and update its position.
          .selectAll('text')
          .filter((d: unknown) => (d as GraphNode).id === subjectNode.id)
          .attr('x', subjectNode.x)
          .attr('y', (subjectNode.y ?? 0) - 12);

        // Manually update positions of links connected to the dragged node.
        linkUpdateAndEnter // Use the existing D3 selection of links.
          .filter(
            // Filter for links connected to the current subjectNode.
            (
              l: any, // l.source and l.target are GraphNode objects here due to visualLinks.
            ) =>
              (l.source as GraphNode).id === subjectNode.id ||
              (l.target as GraphNode).id === subjectNode.id,
          )
          // Update link endpoints based on new source/target positions.
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
      if (!xScale) return;

      const subjectNode = event.subject as GraphNode;
      const targetX = xScale(subjectNode.year); // Calculate the "correct" x based on year.

      if (props.usePhysics) {
        if (!event.active) {
          // Cool down the simulation if no other drag/simulation activity is active.
          simulation?.alphaTarget(0);
        }
        subjectNode.fx = targetX; // Snap x-position back to its year-defined column.
        subjectNode.fy = event.y; // Keep the y-position where the user dragged it.
      } else {
        // If no physics, update node's x,y data and visual attributes.
        subjectNode.x = targetX; // Snap x.
        subjectNode.y = event.y; // Keep dragged y.

        // Manually update visuals to reflect snapped position.
        d3.select(event.sourceEvent.target as SVGCircleElement)
          .transition()
          .duration(150) // Smooth transition to snapped position.
          .attr('cx', subjectNode.x)
          .attr('cy', subjectNode.y);

        svgSel
          .selectAll('text')
          .filter((d: unknown) => (d as GraphNode).id === subjectNode.id)
          .transition()
          .duration(150)
          .attr('x', subjectNode.x)
          .attr('y', (subjectNode.y ?? 0) - 12);

        // Update connected links to the new snapped position of the node.
        linkUpdateAndEnter
          .filter(
            (l: any) =>
              (l.source as GraphNode).id === subjectNode.id ||
              (l.target as GraphNode).id === subjectNode.id,
          )
          .transition()
          .duration(150)
          .attr('x1', (d: any) => (d.source as GraphNode).x!)
          .attr('y1', (d: any) => (d.source as GraphNode).y!)
          .attr('x2', (d: any) => (d.target as GraphNode).x!)
          .attr('y2', (d: any) => (d.target as GraphNode).y!);
      }

      // Store the user-set y-position (fy for physics, y for static)
      // This ensures that user's vertical arrangement is preserved across re-renders.
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

  // Initial render on mount.
onMounted(() => {
  // Der direkte render()-Aufruf wird entfernt, um doppelte Renderings zu vermeiden.
  // Der Watcher unten kümmert sich um das initiale Rendering.
  resizeObserver = new ResizeObserver(() => render());
  if (container.value) resizeObserver.observe(container.value);
});

// Cleanup on unmount.
onBeforeUnmount(() => {
  simulation?.stop(); // Stoppt die D3-Simulation.
  resizeObserver?.disconnect(); // Trennt den Resize Observer.
});

// Debounced render to avoid double/triple renders from multiple triggers
const debouncedRender = debounce(render, 10);

/**
 * Zoomt und schwenkt die Ansicht, um sie an die Grenzen der Kind-Knoten eines gegebenen Clusters anzupassen.
 * @param clusterNode Der Cluster-Knoten, in den hineingezoomt werden soll.
 */
function zoomToClusterBounds(clusterNode: GraphNode) {
  if (
    !svg.value ||
    !zoomBehavior ||
    !xScale ||
    !yScale ||
    !clusterNode.childNodes ||
    clusterNode.childNodes.length === 0
  )
    return;

  const childNodes = clusterNode.childNodes;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  // Berechnet die Bounding Box der Kind-Knoten in Datenkoordinaten (Jahr, Kategoriewert).
  childNodes.forEach((node) => {
    const nodeX = xScale!(node.year); // Holt die x-Koordinate vom Jahr.
    const nodeY = yScale!(node.category) ?? svg.value!.clientHeight / 2; // Holt die y-Koordinate von der Kategorie, Fallback zur Mitte.
    minX = Math.min(minX, nodeX);
    maxX = Math.max(maxX, nodeX);
    minY = Math.min(minY, nodeY);
    maxY = Math.max(maxY, nodeY);
  });
  
  // (Hier würde die restliche Logik der Funktion folgen, um den Zoom tatsächlich anzuwenden)
}


// Speichert vorherige Werte für den Vergleich
let prevNodes: Node[] | undefined = undefined;
let prevLinks: Link[] | undefined = undefined;
let prevYearRange: [number, number] | undefined = undefined;
let prevUsePhysics: boolean | undefined = undefined;

function shallowEqualArray(a: any[] | undefined, b: any[] | undefined) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Dieser einzelne Watcher ist effizienter als mehrere separate Watcher.
// Er beobachtet alle relevanten Props und rendert nur neu, wenn sich
// tatsächlich etwas geändert hat.
watch(
  () => [props.nodes, props.links, props.usePhysics, props.currentYearRange],
  () => {
    let shouldRender = false;
    
    // Vergleicht Nodes nur anhand der ID (flach, schnell)
    const nodeIds = props.nodes?.map((n) => n.id) || [];
    const prevNodeIds = prevNodes?.map((n) => n.id) || [];
    if (!shallowEqualArray(nodeIds, prevNodeIds)) {
      shouldRender = true;
      prevNodes = props.nodes ? [...props.nodes] : undefined;
    }

    // Vergleicht Links anhand der Source-Target-ID
    const linkIds = props.links?.map((l) => `${l.source}-${l.target}`) || [];
    const prevLinkIds =
      prevLinks?.map((l) => `${l.source}-${l.target}`) || [];
    if (!shallowEqualArray(linkIds, prevLinkIds)) {
      shouldRender = true;
      prevLinks = props.links ? [...props.links] : undefined;
    }

    // Vergleicht den Jahresbereich
    if (
      !prevYearRange ||
      props.currentYearRange[0] !== prevYearRange[0] ||
      props.currentYearRange[1] !== prevYearRange[1]
    ) {
      shouldRender = true;
      prevYearRange = [...props.currentYearRange];
    }

    // Vergleicht usePhysics
    if (prevUsePhysics !== props.usePhysics) {
      shouldRender = true;
      prevUsePhysics = props.usePhysics;
    }

    if (shouldRender) {
      if (!props.usePhysics) simulation?.stop();
      debouncedRender();
    }
  },
  { deep: false }, // Wichtig: deep: false, da wir einen manuellen, flachen Vergleich durchführen.
);
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

  .tooltip {
    background-color: white;
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    pointer-events: none; /* So it doesn't interfere with mouse events on the SVG */
    z-index: 10;
    min-width: 150px;
    max-width: 300px;
  }
</style>
