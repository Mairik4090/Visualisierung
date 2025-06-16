<script setup lang="ts">
  import {
    onMounted,
    onBeforeUnmount,
    ref,
    watch,
    type PropType,
  } from 'vue';
  import * as d3 from 'd3';
  import type { Node, Link } from '@/types/concept';

  // Define fixed zoom scales and current zoom level state
  /**
   * Defines the D3 scale factor for each of the 4 fixed zoom levels.
   * Level 1 is most zoomed out, Level 4 is most zoomed in.
   */
  const ZOOM_LEVEL_SCALES = [0.3, 0.7, 1.2, 2.5];
  /**
   * Tracks the current active fixed zoom level, as an integer from 1 to 4.
   * This is the primary driver for clustering logic and zoom scale.
   */
  const currentZoomLevel = ref(1); // 1-indexed (1 to 4)

  const ZOOM_SCALE_THRESHOLD = 0.05; // Threshold for zoom scale change
  const YEAR_RANGE_THRESHOLD = 1; // Threshold for year range change (in years)
  let previousZoomScale: number | null = null;
  let previousVisibleYearRange: [number, number] | null = null;

  interface GraphNode extends Node {
    name?: string;
    x?: number; // Current x position
    y?: number; // Current y position
    fx?: number | null; // Fixed x position (for physics)
    fy?: number | null; // Fixed y position (for physics)
    previous_x?: number; // Previous x position (used for enter animations)
    previous_y?: number; // Previous y position (used for enter animations)
    isCluster?: boolean; // True if this node represents a cluster
    count?: number; // Number of original nodes it represents (1 if not a cluster)
    childNodes?: Node[]; // Array of original nodes if it's a cluster
    categoriesInCluster?: string[]; // For global clusters
    categoryColorsInCluster?: string[]; // For global clusters
    dependencies?: string[];
  }

  const props = defineProps({
    nodes: { type: Array as PropType<Node[] | undefined>, default: () => [] },
    links: { type: Array as PropType<Link[] | undefined>, default: () => [] },
    usePhysics: { type: Boolean, default: true },
    currentYearRange: {
      type: Array as PropType<[number, number]>,
      required: true,
    },
    highlightNodeId: { type: String as PropType<string | null>, default: null },
    selectedNodeId: { type: String as PropType<string | null>, default: null },
    targetZoomLevel: { type: Number, default: 1 }, // New prop for external zoom control
  });

  const emit = defineEmits<{
    conceptSelected: [node: GraphNode];
    centerOnYear: [year: number];
    nodeHovered: [nodeId: string | null];
    mainViewRangeChanged: [range: [number, number]];
  }>();

  const svg = ref<SVGSVGElement | null>(null);
  const container = ref<HTMLElement | null>(null);
  const tooltip = ref<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | null = null;
  let lastRenderedYearRange: [number, number] | null = null;

  let simulation: d3.Simulation<GraphNode, Link> | null = null;
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let lastTransform: d3.ZoomTransform = d3.zoomIdentity;
  /**
   * Stores information about clusters from the *previous* render frame.
   * Key: Cluster ID.
   * Value: Object containing { x, y, childNodeOriginalIds }.
   * This is crucial for enabling smooth "expand from parent" animations:
   * when a cluster breaks apart upon zooming in, its child nodes use the
   * previous x,y of the parent cluster as their starting point for the enter animation.
   */
  let previousFrameClusterInfo = new Map<
    string,
    { x: number; y: number; childNodeOriginalIds: string[] }
  >();

  /**
   * Stores user-defined vertical positions for nodes.
   * Key: Node ID (can be an original node ID or a cluster ID).
   * Value: Object { fy: number } representing the fixed y-coordinate.
   * This map preserves user adjustments to the y-position of nodes/clusters,
   * overriding the default y-scale positioning for those specific items
   * across re-renders, provided the node/cluster ID remains consistent.
   */
  const userPositionedNodes = ref<Map<string, { fy: number }>>(new Map());

  let xScale: d3.ScaleLinear<number, number> | null = null;
  let yScale: d3.ScalePoint<string> | null = null;

  function debounce<F extends (...args: any[]) => any>(
    func: F,
    waitFor: number,
  ) {
    console.log(`[${new Date().toISOString()}] debounce function triggered`);
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
      new Promise((resolve) => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(() => resolve(func(...args)), waitFor);
      });
  }

  function processZoomLogic() {
    console.log(
      `[${new Date().toISOString()}] processZoomLogic function triggered`,
    );
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
      if (
        previousZoomScale === null ||
        Math.abs(currentZoomScale - previousZoomScale) > ZOOM_SCALE_THRESHOLD
      ) {
        shouldRender = true;
      }

      const roundedMinVisibleYear = Math.round(minVisibleYear);
      const roundedMaxVisibleYear = Math.round(maxVisibleYear);

      if (
        previousVisibleYearRange === null ||
        Math.abs(roundedMinVisibleYear - previousVisibleYearRange[0]) >=
          YEAR_RANGE_THRESHOLD ||
        Math.abs(roundedMaxVisibleYear - previousVisibleYearRange[1]) >=
          YEAR_RANGE_THRESHOLD
      ) {
        shouldRender = true;
      }
      if (
        roundedMinVisibleYear > roundedMaxVisibleYear &&
        (previousVisibleYearRange === null ||
          previousVisibleYearRange[0] <= previousVisibleYearRange[1])
      ) {
        shouldRender = true;
      }

      if (shouldRender) {
        previousZoomScale = currentZoomScale;
        previousVisibleYearRange = [
          roundedMinVisibleYear,
          roundedMaxVisibleYear,
        ];
        emit('mainViewRangeChanged', [
          roundedMinVisibleYear,
          roundedMaxVisibleYear,
        ]);
        render();
      }
    }
  }
  const debouncedProcessZoom = debounce(processZoomLogic, 250);

  function getOriginalNodeIds(node: GraphNode): string[] {
    if (node.isCluster && node.childNodes) {
      return node.childNodes.map((cn) => cn.id);
    }
    return [node.id];
  }

  /**
   * Dynamically generates visual links based on the current zoom level and the set of displayed nodes/clusters.
   * @param displayNodes The array of nodes (GraphNode objects) currently being displayed (can be clusters or individual concepts).
   * @param originalLinks The complete list of links between original concepts.
   * @param zoomLevel The current active zoom level (1-4).
   * @returns An array of d3.SimulationLinkDatum objects ready for rendering.
   */
  function generateLinksForZoomLevel(
    displayNodes: GraphNode[],
    originalLinks: Link[],
    zoomLevel: number,
  ): d3.SimulationLinkDatum<GraphNode>[] {
    const visualLinks: d3.SimulationLinkDatum<GraphNode>[] = [];
    const createdLinks = new Set<string>();

    console.log(
      `[${new Date().toISOString()}] generateLinksForZoomLevel triggered for level ${zoomLevel}`,
    );

    // Strategy for Levels 1 & 2: Aggregate links between major clusters.
    // A link is drawn between two clusters if any original concept in cluster A
    // has a dependency on any original concept in cluster B.
    if (zoomLevel <= 2) {
      for (let i = 0; i < displayNodes.length; i++) {
        for (let j = 0; j < displayNodes.length; j++) {
          if (i === j) continue;

          const clusterA = displayNodes[i];
          const clusterB = displayNodes[j];

          if (
            !clusterA.isCluster ||
            !clusterB.isCluster ||
            !clusterA.childNodes ||
            !clusterB.childNodes
          )
            continue;

          const linkKey = `${clusterA.id}-${clusterB.id}`;
          if (createdLinks.has(linkKey)) continue;

          const originalIdsA = getOriginalNodeIds(clusterA);
          const originalIdsB = getOriginalNodeIds(clusterB);
          const setOriginalIdsA = new Set(originalIdsA);
          const setOriginalIdsB = new Set(originalIdsB);

          let connectionExists = false;
          for (const originalLink of originalLinks) {
            if (
              setOriginalIdsA.has(originalLink.source) &&
              setOriginalIdsB.has(originalLink.target)
            ) {
              connectionExists = true;
              break;
            }
          }

          if (connectionExists) {
            visualLinks.push({ source: clusterA, target: clusterB });
            createdLinks.add(linkKey);
          }
        }
      }
    } else {
      // Strategy for Levels 3 & 4: Links connect the visual representations (could be clusters or individual nodes).
      // This uses a local helper to find what a source/target ID maps to in the current displayNodes.
      const findVisualNodeRepresentingLocal = (
        originalId: string,
      ): GraphNode | undefined => {
        let found = displayNodes.find(
          (n) => !n.isCluster && n.id === originalId,
        );
        if (found) return found;
        found = displayNodes.find(
          (n) =>
            n.isCluster &&
            n.childNodes?.some((child) => child.id === originalId),
        );
        return found;
      };

      originalLinks.forEach((originalLink) => {
        const sourceVisual = findVisualNodeRepresentingLocal(
          originalLink.source,
        );
        const targetVisual = findVisualNodeRepresentingLocal(
          originalLink.target,
        );

        if (
          sourceVisual &&
          targetVisual &&
          sourceVisual.id !== targetVisual.id
        ) {
          // At Level 4, all nodes are individual. Apply year plausibility.
          if (zoomLevel === 4) {
            if (sourceVisual.year <= targetVisual.year) {
              const linkKey = `${sourceVisual.id}-${targetVisual.id}`;
              if (!createdLinks.has(linkKey)) {
                visualLinks.push({
                  source: sourceVisual,
                  target: targetVisual,
                });
                createdLinks.add(linkKey);
              }
            }
          } else {
            // Level 3 can have mixed clusters and individual nodes.
            const linkKey = `${sourceVisual.id}-${targetVisual.id}`;
            if (!createdLinks.has(linkKey)) {
              visualLinks.push({ source: sourceVisual, target: targetVisual });
              createdLinks.add(linkKey);
            }
          }
        }
      });
    }
    return visualLinks;
  }

  function render(): void {
    console.log(`[${new Date().toISOString()}] render function triggered`);
    const currentFrameClusterInfo = new Map<
      string,
      { x: number; y: number; childNodeOriginalIds: string[] }
    >();
    if (!svg.value || !props.nodes || props.nodes.length === 0) return;
    simulation?.stop();

    const svgSel = d3.select(svg.value);
    svgSel.selectAll('*').remove();

    const width = svg.value.clientWidth || 600;
    const height = svg.value.clientHeight || 400;

    svgSel
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svgSel
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 19)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    svgSel
      .insert('rect', ':first-child')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('click', function (event: PointerEvent) {
        if (!xScale) return;
        const clickedX = d3.pointer(event, this)[0];
        const targetYear = xScale.invert(clickedX);
        emit('centerOnYear', Math.round(targetYear));
      });

    let filteredNodes: Node[] = [];
    if (props.nodes && props.nodes.length > 0) {
      filteredNodes = props.nodes.filter(
        (node) =>
          node.year >= props.currentYearRange[0] &&
          node.year <= props.currentYearRange[1],
      );
    }

    // --- START CLUSTERING LOGIC ---
    // This section determines which nodes (individual concepts or clusters of concepts)
    // are displayed based on the currentZoomLevel.value. Different zoom levels
    // trigger different clustering strategies.
    const displayNodes: GraphNode[] = [];
    const DEFAULT_CATEGORY = 'unknown_category'; // Added default category

    const allNodeCategories = Array.from(
      new Set(
        filteredNodes
          .map((n) => n.category)
          .filter((c) => c !== undefined) as string[],
      ),
    );
    const color = d3
      .scaleOrdinal<string>()
      .domain(
        allNodeCategories.length > 0 ? allNodeCategories : [DEFAULT_CATEGORY],
      )
      .range(d3.schemeCategory10);

    if (filteredNodes.length > 0) {
      // Clustering logic based on currentZoomLevel.value
      switch (currentZoomLevel.value) {
        // Level 1: Most zoomed out. Aggregate concepts into broad 100-year blocks.
        case 1:
          {
            const groupedByCenturyBlock = d3.group(
              filteredNodes,
              // Group by the starting year of the 100-year block.
              (d) => Math.floor(d.year / 100) * 100,
            );
            groupedByCenturyBlock.forEach((nodesInBlock, startYear) => {
              const representativeYear = startYear + 50; // Position cluster at the mid-point of the block.
              const clusterId = `century-block-cluster-${startYear}`; // e.g., century-block-cluster-1800
              const childNodes = [...nodesInBlock]; // All original nodes within this block.
              const categoriesInCluster = Array.from(
                new Set(
                  childNodes
                    .map((n) => n.category)
                    .filter((c) => c !== undefined) as string[],
                ),
              );
              const categoryColorsInCluster = categoriesInCluster.map((cat) =>
                color(cat ?? DEFAULT_CATEGORY),
              );
              displayNodes.push({
                id: clusterId,
                year: representativeYear,
                category: 'global_cluster', // Use 'global_cluster' for consistent styling/handling.
                name: `Concepts ${startYear}-${startYear + 99}`, // e.g., "Concepts 1800-1899"
                description: `Cluster of ${childNodes.length} concepts from ${startYear} to ${startYear + 99}. Categories: ${categoriesInCluster.join(', ')}`,
                dependencies: [], // Dependencies are handled by generateLinksForZoomLevel
                isCluster: true,
                count: childNodes.length,
                childNodes: childNodes,
                categoriesInCluster: categoriesInCluster,
                categoryColorsInCluster: categoryColorsInCluster,
                fx: null,
                fy: userPositionedNodes.value.get(clusterId)?.fy ?? null,
              });
            });
          }
          break;
        // Level 2: Zoomed in slightly. Aggregate concepts by century.
        case 2:
          {
            const groupedByCentury = d3.group(
              filteredNodes,
              // Group by the starting year of the century.
              (d) => Math.floor(d.year / 100) * 100,
            );
            groupedByCentury.forEach((nodesInCentury, centuryStartYear) => {
              const representativeYear = centuryStartYear + 50; // Position at mid-century.
              const clusterId = `century-cluster-${centuryStartYear}`; // e.g., century-cluster-1900
              const childNodes = [...nodesInCentury]; // All original nodes in this century.
              const categoriesInCluster = Array.from(
                new Set(
                  childNodes
                    .map((n) => n.category)
                    .filter((c) => c !== undefined) as string[],
                ),
              );
              const categoryColorsInCluster = categoriesInCluster.map((cat) =>
                color(cat ?? DEFAULT_CATEGORY),
              );
              displayNodes.push({
                id: clusterId,
                year: representativeYear,
                category: 'century_cluster', // Specific category for century clusters.
                name: `Concepts of the ${centuryStartYear / 100 + 1}${centuryStartYear === 1800 ? 'th' : centuryStartYear === 1900 ? 'th' : 'th'} Century`, // e.g., "Concepts of the 19th Century"
                description: `Cluster of ${childNodes.length} concepts from the ${centuryStartYear / 100 + 1}${centuryStartYear === 1800 ? 'th' : centuryStartYear === 1900 ? 'th' : 'th'} century.`,
                dependencies: [], // Dependencies handled by generateLinksForZoomLevel
                isCluster: true,
                count: childNodes.length,
                childNodes: childNodes,
                categoriesInCluster: categoriesInCluster,
                categoryColorsInCluster: categoryColorsInCluster,
                fx: null,
                fy: userPositionedNodes.value.get(clusterId)?.fy ?? null,
              });
            });
          }
          break;
        // Level 3: Further zoomed in. Group concepts by decade and original category.
        case 3:
          {
            const groupedByDecadeAndCategory = d3.group(
              filteredNodes,
              // Group first by decade, then by category.
              (d) => Math.floor(d.year / 10) * 10,
              (d) => d.category,
            );
            groupedByDecadeAndCategory.forEach((categoriesInDecade, decade) => {
              categoriesInDecade.forEach((childNodesInGroup, category) => {
                const representativeYear = decade + 5; // Position at mid-decade.
                const clusterId = `decade-cat-cluster-${decade}-${category}`; // e.g., decade-cat-cluster-1950-Technology
                displayNodes.push({
                  id: clusterId,
                  year: representativeYear,
                  category: category, // Retain original category for the cluster.
                  name: `${childNodesInGroup.length} ${category} (${decade}s)`, // e.g., "5 Technology (1950s)"
                  description: `Cluster of ${childNodesInGroup.length} ${category} concepts from the ${decade}s`,
                  dependencies: [], // Dependencies handled by generateLinksForZoomLevel
                  isCluster: true,
                  count: childNodesInGroup.length,
                  childNodes: childNodesInGroup,
                  fx: null,
                  fy: userPositionedNodes.value.get(clusterId)?.fy ?? null,
                });
              });
            });
          }
          break;
        // Level 4: Most zoomed in. Show individual concept nodes. No clustering.
        case 4:
          {
            filteredNodes.forEach((originalNode) => {
              const userSetFy = userPositionedNodes.value.get(
                originalNode.id,
              )?.fy;
              // For each original node, create a corresponding graph node.
              const individualGraphNode: GraphNode = {
                ...originalNode,
                isCluster: false,
                count: 1,
                fx: null,
                fy: userSetFy ?? null,
              };
              // Assign previous positions if this node is emerging from a cluster.
              for (const prevClusterData of previousFrameClusterInfo.values()) {
                if (
                  prevClusterData.childNodeOriginalIds.includes(originalNode.id)
                ) {
                  individualGraphNode.previous_x = prevClusterData.x;
                  individualGraphNode.previous_y = prevClusterData.y;
                  break;
                }
              }
              displayNodes.push(individualGraphNode);
            });
          }
          break;
        default: // Fallback: Show individual nodes if zoom level is somehow out of bounds
          filteredNodes.forEach((originalNode) => {
            const userSetFy = userPositionedNodes.value.get(
              originalNode.id,
            )?.fy;
            const individualGraphNode: GraphNode = {
              ...originalNode,
              isCluster: false,
              count: 1,
              fx: null,
              fy: userSetFy ?? null,
            };
            for (const prevClusterData of previousFrameClusterInfo.values()) {
              if (
                prevClusterData.childNodeOriginalIds.includes(originalNode.id)
              ) {
                individualGraphNode.previous_x = prevClusterData.x;
                individualGraphNode.previous_y = prevClusterData.y;
                break;
              }
            }
            displayNodes.push(individualGraphNode);
          });
          break;
      }
    }
    // --- END CLUSTERING LOGIC ---

    xScale = d3
      .scaleLinear()
      .domain(props.currentYearRange)
      .range([40, width - 40]);

    const categoriesForScale = Array.from(
      new Set(
        filteredNodes
          .map((n) => n.category)
          .filter((c) => c !== undefined) as string[],
      ),
    );
    yScale = d3
      .scalePoint<string>()
      .domain(
        categoriesForScale.length > 0 ? categoriesForScale : [DEFAULT_CATEGORY],
      )
      .range([40, height - 40]);

    displayNodes.forEach((n: GraphNode) => {
      if (xScale && typeof n.year === 'number') {
        n.x = xScale(n.year);
      } else {
        n.x = width / 2;
      }

      if (
        yScale &&
        typeof n.category === 'string' &&
        yScale.domain().includes(n.category)
      ) {
        n.y =
          n.category === 'global_cluster' || n.category === 'century_cluster'
            ? height / 2
            : yScale(n.category);
      } else if (yScale) {
        // Category might be undefined or not in domain, use a fallback if yScale exists
        n.y = height / 2; // Fallback y position
      } else {
        // xScale or yScale is null
        n.y = height / 2;
      }
    });

    if (props.usePhysics) {
      displayNodes.forEach((n: GraphNode) => {
        if (xScale && typeof n.year === 'number') {
          n.fx = xScale(n.year);
        }
      });
    }

    const g = svgSel.append('g');

    let originalZoomHandler:
      | ((event: d3.D3ZoomEvent<SVGSVGElement, unknown>, d: unknown) => void)
      | null = null;
    if (!zoomBehavior) {
      /**
       * Handles D3 zoom events (mouse wheel, touch gestures, programmatic zoom).
       * This function implements the logic to snap to predefined fixed zoom levels.
       */
      originalZoomHandler = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const currentScale = lastTransform.k;
        if (!event.transform) {
          if (g) {
            g.attr('transform', lastTransform.toString());
          }
          debouncedProcessZoom();
          return;
        }
        const eventScale = event.transform.k;
        let targetLevel = currentZoomLevel.value;

        if (event.sourceEvent) {
          if (eventScale > currentScale) {
            targetLevel = Math.min(
              ZOOM_LEVEL_SCALES.length,
              currentZoomLevel.value + 1,
            );
          } else if (eventScale < currentScale) {
            targetLevel = Math.max(1, currentZoomLevel.value - 1);
          }
        }

        if (
          targetLevel !== currentZoomLevel.value &&
          event.sourceEvent &&
          ZOOM_LEVEL_SCALES[targetLevel - 1] !== undefined
        ) {
          const targetScale = ZOOM_LEVEL_SCALES[targetLevel - 1];
          const svgInstance = svg.value;
          if (svgInstance) {
            const [pointerX, pointerY] = event.sourceEvent
              ? d3.pointer(event.sourceEvent, svgInstance)
              : [svgInstance.clientWidth / 2, svgInstance.clientHeight / 2];
            const currentTransform = lastTransform;

            const newX =
              pointerX -
              (pointerX - currentTransform.x) *
                (targetScale / currentTransform.k);
            const newY =
              pointerY -
              (pointerY - currentTransform.y) *
                (targetScale / currentTransform.k);

            const newTransform = d3.zoomIdentity
              .translate(newX, newY)
              .scale(targetScale);

            d3.select(svgInstance)
              .transition()
              .duration(300)
              .call(zoomBehavior!.transform, newTransform)
              .on('end', () => {
                currentZoomLevel.value = targetLevel;
                lastTransform = newTransform;
                debouncedProcessZoom();
              });
          }
        } else {
          if (g) {
            g.attr('transform', event.transform.toString());
          }
          lastTransform = event.transform;
          if (
            event.transform.k !== currentScale ||
            event.transform.x !== lastTransform.x ||
            event.transform.y !== lastTransform.y
          ) {
            debouncedProcessZoom();
          }
        }
      };

      zoomBehavior = d3
        .zoom<SVGSVGElement, unknown>()
        .on('zoom', originalZoomHandler);
    }

    svgSel.call(zoomBehavior as any);

    if (zoomBehavior) {
      const targetScale = ZOOM_LEVEL_SCALES[currentZoomLevel.value - 1];
      let newTransform = lastTransform;

      if (
        lastTransform === d3.zoomIdentity ||
        Math.abs(lastTransform.k - targetScale) > 0.001
      ) {
        const svgWidth = svg.value?.clientWidth || 600; // Renamed to avoid conflict
        const svgHeight = svg.value?.clientHeight || 400; // Renamed to avoid conflict

        if (lastTransform === d3.zoomIdentity) {
          newTransform = d3.zoomIdentity
            .translate(svgWidth / 2, svgHeight / 2)
            .scale(targetScale)
            .translate(-svgWidth / 2, -svgHeight / 2);
        } else {
          const centerX = svgWidth / 2;
          const centerY = svgHeight / 2;
          const newX =
            centerX -
            (centerX - lastTransform.x) * (targetScale / lastTransform.k);
          const newY =
            centerY -
            (centerY - lastTransform.y) * (targetScale / lastTransform.k);
          newTransform = d3.zoomIdentity
            .translate(newX, newY)
            .scale(targetScale);
        }
      }

      const tempZoomHandler = zoomBehavior.on('zoom');
      zoomBehavior.on('zoom', null);

      (zoomBehavior as d3.ZoomBehavior<SVGSVGElement, unknown>).transform(
        svgSel as any,
        newTransform,
      );
      lastTransform = newTransform;

      if (tempZoomHandler) {
        zoomBehavior.on('zoom', tempZoomHandler);
      }
    }

    // --- LINK RE-MAPPING & GENERATION ---
    // The actual links to draw depend on the current zoom level and clustering.
    // This function generates the appropriate set of links.
    const visualLinks = generateLinksForZoomLevel(
      displayNodes,
      props.links || [],
      currentZoomLevel.value,
    );
    // --- END LINK RE-MAPPING & GENERATION ---

    let culledDisplayNodes = displayNodes;
    let culledVisualLinks = visualLinks;
    const cullingBuffer = 100;

    if (svg.value && xScale && yScale && lastTransform && lastTransform.k > 0) {
      const [viewportMinDataX, viewportMinDataY] = lastTransform.invert([0, 0]);
      const [viewportMaxDataX, viewportMaxDataY] = lastTransform.invert([
        width, // Use width from render() scope
        height, // Use height from render() scope
      ]);

      culledDisplayNodes = displayNodes.filter((node) => {
        const nodeX = xScale ? xScale(node.year) : width / 2; // Default if xScale is null

        const categoryForY = node.category ?? DEFAULT_CATEGORY;
        let calculatedNodeY = yScale && yScale.domain().includes(categoryForY) ? yScale(categoryForY) : undefined;
        const nodeY = calculatedNodeY === undefined ? height / 2 : calculatedNodeY; // Ensure nodeY is a number

        return (
          nodeX >= viewportMinDataX - cullingBuffer &&
          nodeX <= viewportMaxDataX + cullingBuffer &&
          nodeY >= viewportMinDataY - cullingBuffer &&
          nodeY <= viewportMaxDataY + cullingBuffer
        );
      });

      const culledNodeIds = new Set(culledDisplayNodes.map((n) => n.id));
      culledVisualLinks = visualLinks.filter((link) => {
        const sourceNode = link.source as GraphNode;
        const targetNode = link.target as GraphNode;
        return (
          culledNodeIds.has(sourceNode.id) && culledNodeIds.has(targetNode.id)
        );
      });
    }

    const transitionDuration = 300;

    const linkSelection: d3.Selection<
      SVGLineElement,
      d3.SimulationLinkDatum<GraphNode>,
      SVGGElement,
      unknown
    > = g
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll<SVGLineElement, d3.SimulationLinkDatum<GraphNode>>('line')
      .data(
        culledVisualLinks,
        (d: d3.SimulationLinkDatum<GraphNode>) =>
          `${(d.source as GraphNode).id}-${(d.target as GraphNode).id}`,
      );

    linkSelection
      .exit()
      .transition()
      .duration(transitionDuration)
      .attr('stroke-opacity', 0)
      .remove();

    const linkEnter: d3.Selection<
      SVGLineElement,
      d3.SimulationLinkDatum<GraphNode>,
      SVGGElement,
      unknown
    > = linkSelection
      .enter()
      .append('line')
      .attr('stroke-opacity', 0)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    const linkUpdateAndEnter = linkEnter.merge(linkSelection);

    const nodeSelection: d3.Selection<
      SVGCircleElement,
      GraphNode,
      SVGGElement,
      unknown
    > = g
      .append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(culledDisplayNodes, (d: GraphNode) => d.id);

    /**
     * Helper function to find the target parent cluster for an exiting node.
     * When zooming out, nodes (or smaller clusters) "collapse" into a new, larger parent cluster.
     * This function identifies that parent in the new set of displayNodes.
     * @param exitingNode The node that is exiting the display.
     * @param newDisplayNodes The array of nodes that will be visible after the transition (current `displayNodes`).
     * @returns The parent GraphNode from `newDisplayNodes` if found, otherwise `undefined`.
     */
    const findTargetParentCluster = (
      exitingNode: GraphNode,
      newDisplayNodes: GraphNode[],
    ): GraphNode | undefined => {
      // Get the original node IDs of the exiting node (could be a single ID or IDs of children if it's a cluster).
      const originalIdsToFind = getOriginalNodeIds(exitingNode);
      if (originalIdsToFind.length === 0) return undefined;

      return newDisplayNodes.find((newCluster) => {
        if (!newCluster.isCluster || !newCluster.childNodes) return false;
        const newClusterOriginalIds = new Set(
          newCluster.childNodes.map((cn) => cn.id),
        );
        return originalIdsToFind.some((idToFind) =>
          newClusterOriginalIds.has(idToFind),
        );
      });
    };

    nodeSelection
      .exit() // Select nodes that are being removed.
      .transition() // Animate their removal.
      .duration(transitionDuration)
      .attr('r', 0) // Shrink radius to 0.
      .style('opacity', 0) // Fade out.
      // Animate exiting nodes towards the position of their new parent cluster.
      .attr('cx', (d: GraphNode) => {
        // `displayNodes` (the second argument to findTargetParentCluster) refers to the nodes that *will* be displayed.
        const parentCluster = findTargetParentCluster(d, displayNodes);
        // If a parent is found, move towards it. Otherwise, use its current x (should ideally not happen if logic is correct).
        return parentCluster?.x ?? d.x ?? 0;
      })
      .attr('cy', (d: GraphNode) => {
        const parentCluster = findTargetParentCluster(d, displayNodes);
        return parentCluster?.y ?? d.y ?? 0;
      })
      .remove(); // Remove from DOM after transition.

    const nodeEnter: d3.Selection<
      SVGCircleElement,
      GraphNode,
      SVGGElement,
      unknown
    > = nodeSelection
      .enter() // Select new nodes being added.
      .append('circle')
      .attr('r', 0) // Start with radius 0 for enter animation.
      .style('opacity', 0) // Start transparent for enter animation.
      .attr('fill', (d: GraphNode) => {
        if (d.isCluster) {
          if (d.category === 'global_cluster') {
            return d.categoryColorsInCluster &&
              d.categoryColorsInCluster.length > 0
              ? d.categoryColorsInCluster[0] // Assuming categoryColorsInCluster[0] is already guarded or a string
              : '#888';
          }
          const baseColor = color(d.category ?? DEFAULT_CATEGORY); // Use default if category is undefined
          return d3.color(baseColor)?.darker(0.5).toString() ?? '#555';
        }
        return color(d.category ?? DEFAULT_CATEGORY); // Use default if category is undefined
      })
      .style('cursor', 'pointer')
      // Click handler for nodes.
      .on('click', function (_e, d: GraphNode) {
        // If a cluster node is clicked and not at the maximum zoom level:
        if (
          d.isCluster &&
          d.childNodes &&
          d.childNodes.length > 0 &&
          currentZoomLevel.value < ZOOM_LEVEL_SCALES.length
        ) {
          // Determine the target zoom level (next level in).
          const targetZoomLevel = currentZoomLevel.value + 1;
          const targetScale = ZOOM_LEVEL_SCALES[targetZoomLevel - 1];

          if (svg.value && zoomBehavior && xScale) {
            const currentWidth = svg.value.clientWidth;
            const currentHeight = svg.value.clientHeight;

            // Calculate the new translation (tx, ty) to center the clicked cluster.
            // The cluster's (d.x, d.y) are its layout positions in the unzoomed coordinate space.
            // We want this point to be the center of the view after zooming.
            // Formula: new_translate = view_center - (node_position * new_scale)
            const newTx = currentWidth / 2 - (d.x ?? 0) * targetScale;
            const newTy = currentHeight / 2 - (d.y ?? 0) * targetScale;

            const newTransform = d3.zoomIdentity
              .translate(newTx, newTy)
              .scale(targetScale);

            // Animate the zoom transition.
            d3.select(svg.value)
              .transition()
              .duration(300)
              .call(zoomBehavior.transform, newTransform) // Programmatically trigger zoom.
              .on('end', () => {
                // After transition, update the current zoom level and last transform state.
                currentZoomLevel.value = targetZoomLevel;
                lastTransform = newTransform;
                // debouncedProcessZoom will be called by the 'zoom' event if transform changes.
              });
          }
        } else {
          // If it's an individual (non-cluster) node, or if it's a cluster at the max zoom level,
          // emit an event to select the concept for detail view.
          emit('conceptSelected', d);
        }
      })
      .on('mouseover', function (event: MouseEvent, d: GraphNode) {
        emit('nodeHovered', d.id);
        if (tooltip.value) {
          let tooltipContent = '';
          if (d.isCluster) {
            if (d.category === 'global_cluster') {
              tooltipContent = `<strong>Cluster: ${d.name ?? 'N/A'}</strong><br>Time Span: Approx. ${d.year ? d.year - 25 + ' - ' + (d.year + 24) : 'N/A'}<br>Total Items: ${d.count ?? 'N/A'}<br>Categories: ${d.categoriesInCluster ? d.categoriesInCluster.join(', ') : 'N/A'}`;
            } else if (d.id.startsWith('cat-decade-cluster-')) {
              // Assuming decade clusters have a defined category
              tooltipContent = `<strong>Decade Cluster: ${d.name ?? 'N/A'}</strong><br>Category: ${d.category ?? DEFAULT_CATEGORY}<br>Total Items: ${d.count ?? 'N/A'}<br>Description: ${d.description ?? 'No short description available.'}`;
            } else if (d.category === 'century_cluster') {
              tooltipContent = `<strong>Century Cluster: ${d.name ?? 'N/A'}</strong><br>Total Items: ${d.count ?? 'N/A'}<br>Categories: ${d.categoriesInCluster ? d.categoriesInCluster.join(', ') : 'N/A'}`;
            } else if (d.id.startsWith('cat-year-cluster-')) {
              // Assuming year clusters have a defined category
              tooltipContent = `<strong>Year Cluster: ${d.name ?? 'N/A'}</strong><br>Category: ${d.category ?? DEFAULT_CATEGORY}<br>Year: ${d.year ?? 'N/A'}<br>Total Items: ${d.count ?? 'N/A'}<br>Description: ${d.description ?? 'No short description available.'}`;
            } else {
              // Generic cluster
              tooltipContent = `<strong>Cluster: ${d.name ?? 'N/A'}</strong><br>Total Items: ${d.count ?? 'N/A'}<br>Description: ${d.description ?? 'No short description available.'}<br>Category: ${d.category ?? DEFAULT_CATEGORY}`;
            }
          } else {
            // Individual node
            tooltipContent = `<strong>${d.name ?? 'N/A'}</strong><br>Year of Origin: ${d.year ?? 'N/A'}<br>Category: ${d.category ?? DEFAULT_CATEGORY}<br>Short Description: ${d.description ?? 'No short description available.'}`;
          }
          tooltip.value.innerHTML = tooltipContent;
          tooltip.value.style.opacity = '0.9';
          tooltip.value.style.left = `${event.pageX + 15}px`;
          tooltip.value.style.top = `${event.pageY - 10}px`;
        }
      })
      .on('mouseout', function () {
        emit('nodeHovered', null);
        if (tooltip.value) {
          tooltip.value.style.opacity = '0';
          tooltip.value.style.left = `0px`;
          tooltip.value.style.top = `0px`;
        }
      });

    // Set initial position for entering nodes for the animation:
    // If the node has `previous_x` and `previous_y` (meaning it's expanding from a parent cluster),
    // start its animation from that parent cluster's last known position.
    // Otherwise (e.g., node appearing due to data change or initial load), start from its calculated position.
    nodeEnter
      .attr('cx', (d: GraphNode) => d.previous_x ?? d.x ?? 0) // Use parent's old x or current x.
      .attr('cy', (d: GraphNode) => d.previous_y ?? d.y ?? 0); // Use parent's old y or current y.

    const nodeUpdateAndEnter = nodeEnter.merge(nodeSelection);

    nodeUpdateAndEnter.call(
      d3
        .drag<SVGCircleElement, GraphNode>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded),
    );

    const labelSelection: d3.Selection<
      SVGTextElement,
      GraphNode,
      SVGGElement,
      unknown
    > = g
      .append('g')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(culledDisplayNodes, (d: GraphNode) => d.id);

    labelSelection
      .exit()
      .transition()
      .duration(transitionDuration)
      .style('opacity', 0)
      // Animate exiting labels towards their new parent cluster's position.
      .attr('x', (d: GraphNode) => {
        const parentCluster = findTargetParentCluster(d, displayNodes);
        return parentCluster?.x ?? d.x ?? 0; // Move towards parent's x.
      })
      .attr('y', (d: GraphNode) => {
        const parentCluster = findTargetParentCluster(d, displayNodes);
        return (parentCluster?.y ?? d.y ?? 0) - 12; // Move towards parent's y (offset for label).
      })
      .remove(); // Remove after transition.

    const labelEnter: d3.Selection<
      SVGTextElement,
      GraphNode,
      SVGGElement,
      unknown
    > = labelSelection
      .enter()
      .append('text')
      .style('opacity', 0) // Start transparent.
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#333')
      .text((d: GraphNode) => d.name ?? d.id);
    // Initial position for entering labels, similar to nodes, to animate from parent or current position.
    labelEnter
      .attr('x', (d: GraphNode) => d.previous_x ?? d.x ?? 0)
      .attr('y', (d: GraphNode) => (d.previous_y ?? d.y ?? 0) - 12);

    const labelUpdateAndEnter = labelEnter.merge(labelSelection);

    if (props.usePhysics) {
      nodeUpdateAndEnter
        .attr('r', (d: GraphNode) =>
          d.isCluster ? ((d.count ?? 0) > 10 ? 14 : 10) : 6, // Added fallback for d.count
        )
        .style('opacity', 1)
        .attr('stroke', (d: GraphNode) =>
          d.id === props.highlightNodeId ? 'orange' : '#fff',
        )
        .attr('stroke-width', (d: GraphNode) =>
          d.id === props.highlightNodeId ? 3 : 1.5,
        );

      labelUpdateAndEnter.style('opacity', 1);
      linkUpdateAndEnter.attr('stroke-opacity', 0.6);

      simulation = d3
        .forceSimulation(displayNodes)
        .force(
          'link',
          d3
            .forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(
              visualLinks,
            )
            .id((d: GraphNode) => d.id)
            .distance(60),
        )
        .force('charge', d3.forceManyBody().strength(-120))
        .force('x', d3.forceX<GraphNode>((d: GraphNode) => d.x ?? 0).strength(0.3)) // Fallback for d.x
        .force('y', d3.forceY<GraphNode>((d: GraphNode) => d.y ?? 0).strength(0.05)) // Fallback for d.y
        .on('tick', ticked);
    } else {
      nodeUpdateAndEnter
        .transition()
        .duration(transitionDuration)
        .attr('cx', (d: GraphNode) => d.x ?? 0) // Fallback for d.x
        .attr('cy', (d: GraphNode) => d.y ?? 0) // Fallback for d.y
        .attr('r', (d: GraphNode) =>
          d.isCluster ? ((d.count ?? 0) > 10 ? 14 : 10) : 6, // Fallback for d.count
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
        .attr('x', (d: GraphNode) => d.x ?? 0) // Fallback for d.x
        .attr('y', (d: GraphNode) => (d.y ?? 0) - 12)
        .style('opacity', 1);

      linkUpdateAndEnter
        .transition()
        .duration(transitionDuration)
        .attr(
          'x1',
          (d: d3.SimulationLinkDatum<GraphNode>) => (d.source as GraphNode).x ?? 0, // Fallback
        )
        .attr(
          'y1',
          (d: d3.SimulationLinkDatum<GraphNode>) => (d.source as GraphNode).y ?? 0, // Fallback
        )
        .attr(
          'x2',
          (d: d3.SimulationLinkDatum<GraphNode>) => (d.target as GraphNode).x ?? 0, // Fallback
        )
        .attr(
          'y2',
          (d: d3.SimulationLinkDatum<GraphNode>) => (d.target as GraphNode).y ?? 0, // Fallback
        )
        .attr('stroke-opacity', 0.6);

      displayNodes.forEach((d: GraphNode) => {
        if (d.isCluster && d.childNodes && d.x != null && d.y != null) {
          currentFrameClusterInfo.set(d.id, {
            x: d.x,
            y: d.y,
            childNodeOriginalIds: d.childNodes.map((cn) => cn.id),
          });
        }
      });
    }

    function ticked() {
      console.log(`[${new Date().toISOString()}] ticked function triggered`);
      linkUpdateAndEnter
        .attr(
          'x1',
          (d: d3.SimulationLinkDatum<GraphNode>) => (d.source as GraphNode).x ?? 0, // Fallback
        )
        .attr(
          'y1',
          (d: d3.SimulationLinkDatum<GraphNode>) => (d.source as GraphNode).y ?? 0, // Fallback
        )
        .attr(
          'x2',
          (d: d3.SimulationLinkDatum<GraphNode>) => (d.target as GraphNode).x ?? 0, // Fallback
        )
        .attr(
          'y2',
          (d: d3.SimulationLinkDatum<GraphNode>) => (d.target as GraphNode).y ?? 0, // Fallback
        );
      nodeUpdateAndEnter
        .attr('cx', (d: GraphNode) => d.x ?? 0) // Fallback
        .attr('cy', (d: GraphNode) => d.y ?? 0); // Fallback
      labelUpdateAndEnter
        .attr('x', (d: GraphNode) => d.x ?? 0) // Fallback
        .attr('y', (d: GraphNode) => (d.y ?? 0) - 12);

      nodeUpdateAndEnter.each(function (dNode: GraphNode) {
        // Explicitly type dNode
        // const d = dNode as GraphNode; // No longer needed due to explicit type
        if (
          dNode.isCluster &&
          dNode.childNodes &&
          dNode.x != null &&
          dNode.y != null
        ) {
          currentFrameClusterInfo.set(dNode.id, {
            x: dNode.x,
            y: dNode.y,
            childNodeOriginalIds: dNode.childNodes.map((cn) => cn.id),
          });
        }
      });
    }

    function dragStarted(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
    ) {
      console.log(
        `[${new Date().toISOString()}] dragStarted function triggered`,
      );
      event.sourceEvent?.stopPropagation();
      const subjectNode = event.subject as GraphNode;
      if (!event.active && props.usePhysics) {
        simulation?.alphaTarget(0.3).restart();
      }
      subjectNode.fx = subjectNode.x ?? 0;
      subjectNode.fy = subjectNode.y ?? 0;
    }

    function dragged(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
    ) {
      console.log(`[${new Date().toISOString()}] dragged function triggered`);
      event.sourceEvent?.stopPropagation();
      const subjectNode = event.subject as GraphNode;

      if (props.usePhysics) {
        subjectNode.fx = event.x;
        subjectNode.fy = event.y;
      } else {
        subjectNode.x = event.x;
        subjectNode.y = event.y;

        d3.select(event.sourceEvent.target as SVGCircleElement)
          .attr('cx', subjectNode.x)
          .attr('cy', subjectNode.y);

        svgSel
          .selectAll('text')
          .filter(
            (d: unknown): d is GraphNode =>
              (d as GraphNode).id === subjectNode.id,
          ) // Type predicate
          .attr('x', subjectNode.x)
          .attr('y', (subjectNode.y ?? 0) - 12);

        linkUpdateAndEnter
          .filter(
            (
              l: d3.SimulationLinkDatum<GraphNode>, // Explicitly type l
            ) =>
              (l.source as GraphNode).id === subjectNode.id ||
              (l.target as GraphNode).id === subjectNode.id,
          )
          .attr(
            'x1',
            (d: d3.SimulationLinkDatum<GraphNode>) =>
              (d.source as GraphNode).x ?? 0, // Fallback
          )
          .attr(
            'y1',
            (d: d3.SimulationLinkDatum<GraphNode>) =>
              (d.source as GraphNode).y ?? 0, // Fallback
          )
          .attr(
            'x2',
            (d: d3.SimulationLinkDatum<GraphNode>) =>
              (d.target as GraphNode).x ?? 0, // Fallback
          )
          .attr(
            'y2',
            (d: d3.SimulationLinkDatum<GraphNode>) =>
              (d.target as GraphNode).y ?? 0, // Fallback
          );
      }
    }

    function dragEnded(
      event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
    ) {
      console.log(`[${new Date().toISOString()}] dragEnded function triggered`);
      event.sourceEvent?.stopPropagation();
      const subjectNode = event.subject as GraphNode;

      let targetX: number | undefined;
      if (xScale) {
        targetX = xScale(subjectNode.year);
      } else {
        // Fallback if xScale is not available, though this case should ideally not be reached
        // if render() and other dependent functions are structured correctly.
        targetX = subjectNode.x;
      }

      if (props.usePhysics) {
        if (!event.active) {
          simulation?.alphaTarget(0);
        }
        subjectNode.fx = targetX;
        subjectNode.fy = event.y;
      } else {
        subjectNode.x = targetX;
        subjectNode.y = event.y;

        d3.select(event.sourceEvent.target as SVGCircleElement)
          .transition()
          .duration(150)
          .attr('cx', subjectNode.x)
          .attr('cy', subjectNode.y);

        svgSel
          .selectAll('text')
          .filter(
            (d: unknown): d is GraphNode =>
              (d as GraphNode).id === subjectNode.id,
          ) // Type predicate
          .transition()
          .duration(150)
          .attr('x', subjectNode.x)
          .attr('y', (subjectNode.y ?? 0) - 12);

        linkUpdateAndEnter
          .filter(
            (
              l: d3.SimulationLinkDatum<GraphNode>, // Explicitly type l
            ) =>
              (l.source as GraphNode).id === subjectNode.id ||
              (l.target as GraphNode).id === subjectNode.id,
          )
          .transition()
          .duration(150)
          .attr(
            'x1',
            (d: d3.SimulationLinkDatum<GraphNode>) =>
              (d.source as GraphNode).x ?? 0, // Fallback
          )
          .attr(
            'y1',
            (d: d3.SimulationLinkDatum<GraphNode>) =>
              (d.source as GraphNode).y ?? 0, // Fallback
          )
          .attr(
            'x2',
            (d: d3.SimulationLinkDatum<GraphNode>) =>
              (d.target as GraphNode).x ?? 0, // Fallback
          )
          .attr(
            'y2',
            (d: d3.SimulationLinkDatum<GraphNode>) =>
              (d.target as GraphNode).y ?? 0, // Fallback
          );
      }

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
    previousFrameClusterInfo = new Map(currentFrameClusterInfo);
  }

  onMounted(() => {
    console.log(`[${new Date().toISOString()}] onMounted hook triggered`);
    resizeObserver = new ResizeObserver(() => render());
    if (container.value) resizeObserver.observe(container.value);
  });

  onBeforeUnmount(() => {
    console.log(`[${new Date().toISOString()}] onBeforeUnmount hook triggered`);
    simulation?.stop();
    resizeObserver?.disconnect();
  });

  const debouncedRender = debounce(render, 10);

  function zoomToClusterBounds(clusterNode: GraphNode) {
    console.log(
      `[${new Date().toISOString()}] zoomToClusterBounds function triggered`,
    );
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

    childNodes.forEach((node) => {
      const nodeX = xScale ? xScale(node.year) : undefined;
      const nodeY =
        yScale && node.category && yScale.domain().includes(node.category)
          ? yScale(node.category)
          : undefined;

      if (nodeX === undefined || nodeY === undefined) {
        // Skip this node or use a fallback if coordinates can't be determined
        // For now, let's skip, but a robust solution might involve logging or default values
        return;
      }

      minX = Math.min(minX, nodeX);
      maxX = Math.max(maxX, nodeX);
      minY = Math.min(minY, nodeY);
      maxY = Math.max(maxY, nodeY);
    });
  }

  let prevNodes: Node[] | undefined = undefined;
  let prevLinks: Link[] | undefined = undefined;
  let prevYearRange: [number, number] | undefined = undefined;
  let prevUsePhysics: boolean | undefined = undefined;

  function shallowEqualArray(a: any[] | undefined, b: any[] | undefined) {
    console.log(
      `[${new Date().toISOString()}] shallowEqualArray function triggered`,
    );
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  watch(
    () => [props.nodes, props.links, props.usePhysics, props.currentYearRange],
    () => {
      console.log(`[${new Date().toISOString()}] watch callback triggered`);
      let shouldRender = false;

      const nodeIds = props.nodes?.map((n) => n.id) || [];
      const prevNodeIds = prevNodes?.map((n) => n.id) || [];
      if (!shallowEqualArray(nodeIds, prevNodeIds)) {
        shouldRender = true;
        prevNodes = props.nodes ? [...props.nodes] : undefined;
      }

      const linkIds = props.links?.map((l) => `${l.source}-${l.target}`) || [];
      const prevLinkIds =
        prevLinks?.map((l) => `${l.source}-${l.target}`) || [];
      if (!shallowEqualArray(linkIds, prevLinkIds)) {
        shouldRender = true;
        prevLinks = props.links ? [...props.links] : undefined;
      }

      if (
        !prevYearRange ||
        props.currentYearRange[0] !== prevYearRange[0] ||
        props.currentYearRange[1] !== prevYearRange[1]
      ) {
        shouldRender = true;
        prevYearRange = [...props.currentYearRange];
      }

      if (prevUsePhysics !== props.usePhysics) {
        shouldRender = true;
        prevUsePhysics = props.usePhysics;
      }

      if (shouldRender) {
        if (!props.usePhysics) simulation?.stop();
        debouncedRender();
      }
    },
    { deep: false },
  );

  /**
   * Watches the `targetZoomLevel` prop (controlled by external components like ZoomControls).
   * When this prop changes, it programmatically triggers a zoom transition to the new level.
   */
  watch(
    () => props.targetZoomLevel,
    (newTargetLevel) => {
      // Check if the new target level is defined, valid, and different from the current internal level.
      if (
        newTargetLevel !== undefined &&
        newTargetLevel !== currentZoomLevel.value
      ) {
        if (newTargetLevel >= 1 && newTargetLevel <= ZOOM_LEVEL_SCALES.length) {
          const targetScale = ZOOM_LEVEL_SCALES[newTargetLevel - 1]; // Get scale for the target level.
          const svgInstance = svg.value;

          if (svgInstance && zoomBehavior) {
            currentZoomLevel.value = newTargetLevel; // Update internal state to the new target level.

            const currentWidth = svgInstance.clientWidth;
            const currentHeight = svgInstance.clientHeight;
            const currentTransform = lastTransform;

            const newX =
              currentWidth / 2 -
              (currentWidth / 2 - currentTransform.x) *
                (targetScale / currentTransform.k);
            const newY =
              currentHeight / 2 -
              (currentHeight / 2 - currentTransform.y) *
                (targetScale / currentTransform.k);

            const newTransform = d3.zoomIdentity
              .translate(newX, newY)
              .scale(targetScale);

            d3.select(svgInstance)
              .transition()
              .duration(300)
              .call(zoomBehavior.transform, newTransform)
              .on('end', () => {
                lastTransform = newTransform;
              });
          }
        }
      }
    },
  );
</script>
