<template>
  <div ref="container" class="stammbaum-container">
    <svg ref="svg"></svg>
    <div ref="tooltip" class="stammbaum-tooltip"></div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref, watch, type PropType } from 'vue';
  import * as d3 from 'd3';
  import type { Node, Link } from '@/types/concept';

  const ZOOM_LEVEL_SCALES = [0.3, 0.7, 1.2, 2.5];
  const currentZoomLevel = ref(1);
  const ZOOM_SCALE_THRESHOLD = 0.05;
  const YEAR_RANGE_THRESHOLD = 1;
  let previousZoomScale: number | null = null;
  let previousVisibleYearRange: [number, number] | null = null;

  interface GraphNode extends Node {
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    previous_x?: number;
    previous_y?: number;
    isCluster?: boolean;
    count?: number;
    childNodes?: Node[];
    categoriesInCluster?: string[];
    categoryColorsInCluster?: string[];
  }

  const props = defineProps({
    nodes: { type: Array as PropType<Node[] | undefined> },
    links: { type: Array as PropType<Link[] | undefined> },
    usePhysics: { type: Boolean, default: true },
    currentYearRange: {
      type: Object as PropType<[number, number]>,
      required: true,
    },
    highlightNodeId: { type: String as PropType<string | null>, default: null },
    selectedNodeId: { type: String as PropType<string | null>, default: null },
    targetZoomLevel: { type: Number },
  });

  const emit = defineEmits<{
    conceptSelected: [node: GraphNode];
    centerOnYear: [year: number];
    nodeHovered: [nodeId: string | null];
    mainViewRangeChanged: [range: [number, number]];
  }>();

  const svg = ref<SVGSVGElement | null>(null);
  const container = ref<HTMLDivElement | null>(null);
  const tooltip = ref<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | null = null;

  let simulation: d3.Simulation<GraphNode, Link> | null = null;
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let lastTransform: d3.ZoomTransform = d3.zoomIdentity;
  let currentFrameClusterInfo = new Map<
    string,
    { x: number; y: number; childNodeOriginalIds: string[] }
  >();
  let previousFrameClusterInfo = new Map<
    string,
    { x: number; y: number; childNodeOriginalIds: string[] }
  >();
  const userPositionedNodes = ref<Map<string, { fy: number }>>(new Map());

  let xScale: d3.ScaleLinear<number, number> | null = null;
  let yScale: d3.ScalePoint<string> | null = null;

  // Main group for all chart elements (nodes, links, labels)
  let mainGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null =
    null;
  let linkGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null =
    null;
  let nodeGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null =
    null;
  let labelGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null =
    null;

  function debounce<F extends (...args: any[]) => any>(
    func: F,
    waitFor: number,
  ) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
      new Promise((resolve) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => resolve(func(...args)), waitFor);
      });
  }

  function processZoomLogic() {
    if (xScale && svg.value && lastTransform) {
      const currentWidth = svg.value.clientWidth;
      const minVisibleDataX = lastTransform.invertX(0);
      const maxVisibleDataX = lastTransform.invertX(currentWidth);
      if (typeof xScale.invert !== 'function') return;
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
          YEAR_RANGE_THRESHOLD ||
        (roundedMinVisibleYear > roundedMaxVisibleYear &&
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
    if (node.isCluster && node.childNodes)
      return node.childNodes.map((cn) => cn.id);
    return [node.id];
  }

  function generateLinksForZoomLevel(
    displayNodes: GraphNode[],
    originalLinks: Link[],
    zoomLevel: number,
  ): d3.SimulationLinkDatum<GraphNode>[] {
    const visualLinks: d3.SimulationLinkDatum<GraphNode>[] = [];
    const createdLinks = new Set<string>();
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
      const findVisualNodeRepresentingLocal = (
        originalId: string,
      ): GraphNode | undefined => {
        let found = displayNodes.find(
          (n) => !n.isCluster && n.id === originalId,
        );
        if (found) return found;
        return displayNodes.find(
          (n) =>
            n.isCluster &&
            n.childNodes?.some((child) => child.id === originalId),
        );
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

  function setupSimulation(
    nodes: GraphNode[],
    links: d3.SimulationLinkDatum<GraphNode>[],
  ) {
    if (!svg.value) return;
    simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(links)
          .id((d: GraphNode) => d.id)
          .distance(60),
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('x', d3.forceX<GraphNode>((d) => d.x!).strength(0.3))
      .force('y', d3.forceY<GraphNode>((d) => d.y!).strength(0.05))
      .on('tick', ticked);
  }

  function ticked() {
    if (!mainGroup || !linkGroup || !nodeGroup || !labelGroup) return;

    linkGroup
      .selectAll<SVGLineElement, d3.SimulationLinkDatum<GraphNode>>('line')
      .attr('x1', (d: any) => (d.source as GraphNode).x!)
      .attr('y1', (d: any) => (d.source as GraphNode).y!)
      .attr('x2', (d: any) => (d.target as GraphNode).x!)
      .attr('y2', (d: any) => (d.target as GraphNode).y!);

    nodeGroup
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .attr('cx', (d: any) => (d as GraphNode).x!)
      .attr('cy', (d: any) => (d as GraphNode).y!);

    labelGroup
      .selectAll<SVGTextElement, GraphNode>('text')
      .attr('x', (d: any) => (d as GraphNode).x!)
      .attr('y', (d: any) => ((d as GraphNode).y ?? 0) - 12);

    nodeGroup
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .each(function (dNode) {
        const d = dNode as GraphNode;
        if (d.isCluster && d.childNodes && d.x != null && d.y != null) {
          currentFrameClusterInfo.set(d.id, {
            x: d.x,
            y: d.y,
            childNodeOriginalIds: d.childNodes.map((cn) => cn.id),
          });
        }
      });
  }

  function render(): void {
    const currentFrameClusterInfo = new Map<
      string,
      { x: number; y: number; childNodeOriginalIds: string[] }
    >();
    if (!svg.value || !props.nodes || props.nodes.length === 0) return;

    const svgSel = d3.select(svg.value as SVGSVGElement);
    const width = svg.value.clientWidth || 600;
    const height = svg.value.clientHeight || 400;

    svgSel
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Ensure defs for arrowhead is present (append only if not exists)
    if (svgSel.select('defs').empty()) {
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
    }

    // Ensure background rect is present (append only if not exists, or update)
    let bgRect = svgSel.select<SVGRectElement>('rect.background-rect');
    if (bgRect.empty()) {
      bgRect = svgSel
        .insert('rect', ':first-child')
        .classed('background-rect', true)
        .attr('fill', 'transparent')
        .on('click', function (event: PointerEvent) {
          if (!xScale) return;
          const clickedX = d3.pointer(event, this)[0];
          const targetYear = xScale.invert(clickedX);
          emit('centerOnYear', Math.round(targetYear));
        });
    }
    bgRect.attr('width', width).attr('height', height);

    // Ensure main group for chart elements is present
    if (!mainGroup) {
      mainGroup = svgSel.append('g').attr('class', 'chart-content');
      // Create sub-groups for links, nodes, and labels one time
      linkGroup = mainGroup.append('g').attr('class', 'links');
      nodeGroup = mainGroup.append('g').attr('class', 'nodes');
      labelGroup = mainGroup.append('g').attr('class', 'labels');
    }

    let filteredNodes: Node[] = [];
    if (props.nodes && props.nodes.length > 0) {
      filteredNodes = props.nodes.filter(
        (node) =>
          node.year >= props.currentYearRange[0] &&
          node.year <= props.currentYearRange[1],
      );
    }

    const displayNodes: GraphNode[] = [];
    const allNodeCategories = Array.from(
      new Set(filteredNodes.map((n) => n.category).filter(Boolean)),
    ) as string[];
    const color = d3
      .scaleOrdinal<string>()
      .domain(allNodeCategories)
      .range(d3.schemeCategory10);

    if (filteredNodes.length > 0) {
      switch (currentZoomLevel.value) {
        case 1: {
          const groupedByCenturyBlock = d3.group(
            filteredNodes,
            (d) => Math.floor(d.year / 100) * 100,
          );
          groupedByCenturyBlock.forEach((nodesInBlock, startYear) => {
            const representativeYear = startYear + 50;
            const clusterId = `century-block-cluster-${startYear}`;
            const childNodes = [...nodesInBlock];
            const categoriesInCluster = Array.from(
              new Set(childNodes.map((n) => n.category).filter(Boolean)),
            ) as string[];
            const categoryColorsInCluster = categoriesInCluster.map((cat) =>
              color(cat || ''),
            );
            displayNodes.push({
              id: clusterId,
              year: representativeYear,
              category: 'global_cluster',
              name: `Concepts ${startYear}-${startYear + 99}`,
              description: `Cluster of ${childNodes.length} concepts from ${startYear} to ${startYear + 99}. Categories: ${categoriesInCluster.join(', ')}`,
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
          break;
        }
        case 2: {
          const groupedByCentury = d3.group(
            filteredNodes,
            (d) => Math.floor(d.year / 100) * 100,
          );
          groupedByCentury.forEach((nodesInCentury, centuryStartYear) => {
            const representativeYear = centuryStartYear + 50;
            const clusterId = `century-cluster-${centuryStartYear}`;
            const childNodes = [...nodesInCentury];
            const categoriesInCluster = Array.from(
              new Set(
                childNodes
                  .map((n) => n.category)
                  .filter((c): c is string => c !== undefined && c !== null),
              ),
            );
            const categoryColorsInCluster = categoriesInCluster.map((cat) =>
              color(cat),
            );
            displayNodes.push({
              id: clusterId,
              year: representativeYear,
              category: 'century_cluster',
              name: `Concepts of the ${centuryStartYear / 100 + 1}${centuryStartYear === 1800 || centuryStartYear === 1900 ? 'th' : 'th'} Century`,
              description: `Cluster of ${childNodes.length} concepts from the ${centuryStartYear / 100 + 1}${centuryStartYear === 1800 || centuryStartYear === 1900 ? 'th' : 'th'} century.`,
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
          break;
        }
        case 3: {
          const groupedByDecadeAndCategory = d3.group(
            filteredNodes,
            (d) => Math.floor(d.year / 10) * 10,
            (d) => d.category,
          );
          groupedByDecadeAndCategory.forEach((categoriesInDecade, decade) => {
            categoriesInDecade.forEach((childNodesInGroup, category) => {
              const representativeYear = decade + 5;
              const clusterId = `decade-cat-cluster-${decade}-${category}`;
              displayNodes.push({
                id: clusterId,
                year: representativeYear,
                category: category || '',
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
          break;
        }
        case 4:
        default: {
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
    }

    xScale = d3
      .scaleLinear()
      .domain(props.currentYearRange)
      .range([40, width - 40]);
    const categoriesForScale = Array.from(
      new Set(filteredNodes.map((n) => n.category).filter(Boolean)),
    ) as string[];
    yScale = d3
      .scalePoint<string>()
      .domain(
        categoriesForScale.length > 0
          ? categoriesForScale
          : ['default_category_for_empty_scale'],
      )
      .range([40, height - 40]);

    displayNodes.forEach((n: GraphNode) => {
      if (
        xScale &&
        yScale &&
        typeof n.year === 'number' &&
        typeof n.category === 'string'
      ) {
        n.x = xScale(n.year);
        n.y =
          n.category === 'global_cluster' || n.category === 'century_cluster'
            ? height / 2
            : yScale(n.category);
      } else {
        n.x = width / 2;
        n.y = height / 2;
      }
      if (
        userPositionedNodes.value.has(n.id) &&
        userPositionedNodes.value.get(n.id)!.fy !== null
      ) {
        n.fy = userPositionedNodes.value.get(n.id)!.fy;
      } else {
        n.fy = null; // Ensure fy is explicitly null if not user-positioned
      }

      if (props.usePhysics && xScale && typeof n.year === 'number') {
        n.fx = xScale(n.year); // Fix X for physics
      } else {
        n.fx = null; // Ensure fx is null if not using physics or no year
      }
    });

    if (!zoomBehavior) {
      const originalZoomHandler = (
        event: d3.D3ZoomEvent<SVGSVGElement, unknown>,
      ) => {
        if (!mainGroup) return;
        const currentScale = lastTransform.k;
        if (!event.transform) {
          mainGroup.attr('transform', lastTransform.toString());
          debouncedProcessZoom();
          return;
        }
        const eventScale = event.transform.k;
        let targetLevel = currentZoomLevel.value;

        if (event.sourceEvent) {
          // User-initiated zoom (wheel, pinch)
          if (eventScale > currentScale)
            targetLevel = Math.min(
              ZOOM_LEVEL_SCALES.length,
              currentZoomLevel.value + 1,
            );
          else if (eventScale < currentScale)
            targetLevel = Math.max(1, currentZoomLevel.value - 1);
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

            d3.select(svgInstance as SVGSVGElement)
              .transition()
              .duration(300)
              .call(zoomBehavior!.transform as any, newTransform)
              .on('end', () => {
                currentZoomLevel.value = targetLevel; // Update level after transition
                lastTransform = newTransform;
                debouncedProcessZoom(); // This will trigger a render
              });
          }
        } else {
          // Programmatic zoom or no level change
          mainGroup.attr('transform', event.transform.toString());
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
      svgSel.call(zoomBehavior as any);
    }

    // Apply initial or target zoom level transform if needed
    if (zoomBehavior) {
      const targetScale = ZOOM_LEVEL_SCALES[currentZoomLevel.value - 1];
      let newTransform = lastTransform;

      if (
        lastTransform === d3.zoomIdentity ||
        Math.abs(lastTransform.k - targetScale) > 0.001
      ) {
        const svgWidth = svg.value?.clientWidth || width;
        const svgHeight = svg.value?.clientHeight || height;
        if (lastTransform === d3.zoomIdentity) {
          // Initial load
          newTransform = d3.zoomIdentity
            .translate(svgWidth / 2, svgHeight / 2)
            .scale(targetScale)
            .translate(-svgWidth / 2, -svgHeight / 2);
        } else {
          // Target level changed
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
      // Apply transform without triggering zoom event, then restore handler
      const tempZoomHandler = zoomBehavior.on('zoom');
      zoomBehavior.on('zoom', null); // Temporarily disable handler
      (zoomBehavior as d3.ZoomBehavior<SVGSVGElement, unknown>).transform(
        svgSel as any,
        newTransform,
      );
      lastTransform = newTransform;
      if (mainGroup) mainGroup.attr('transform', newTransform.toString()); // Also apply to mainGroup
      if (tempZoomHandler) zoomBehavior.on('zoom', tempZoomHandler); // Restore handler
    }

    const visualLinks = generateLinksForZoomLevel(
      displayNodes,
      props.links || [],
      currentZoomLevel.value,
    );
    const transitionDuration = 300;

    // Ensure linkGroup, nodeGroup, labelGroup are defined
    if (!linkGroup || !nodeGroup || !labelGroup) return;

    const linkSelection = linkGroup
      .selectAll<SVGLineElement, d3.SimulationLinkDatum<GraphNode>>('line')
      .data(visualLinks, (d: any) => `${d.source.id}-${d.target.id}`);
    linkSelection
      .exit()
      .transition()
      .duration(transitionDuration)
      .attr('stroke-opacity', 0)
      .remove();
    const linkEnter = linkSelection
      .enter()
      .append('line')
      .attr('stroke-opacity', 0)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');
    const linkUpdateAndEnter = linkEnter.merge(linkSelection);

    const nodeSelection = nodeGroup
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(displayNodes, (d: any) => d.id);

    const findTargetParentCluster = (
      exitingNode: GraphNode,
      newDisplayNodes: GraphNode[],
    ): GraphNode | undefined => {
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
      .exit()
      .transition()
      .duration(transitionDuration)
      .attr('r', 0)
      .style('opacity', 0)
      .attr('cx', (d: any) => {
        const parentCluster = findTargetParentCluster(
          d as GraphNode,
          displayNodes,
        );
        return (parentCluster?.x ?? (d as GraphNode).x ?? 0).toString();
      })
      .attr('cy', (d: any) => {
        const parentCluster = findTargetParentCluster(
          d as GraphNode,
          displayNodes,
        );
        return (parentCluster?.y ?? (d as GraphNode).y ?? 0).toString();
      })
      .remove();

    const nodeEnter = nodeSelection
      .enter()
      .append('circle')
      .attr('r', 0)
      .style('opacity', 0)
      .attr('fill', (d: GraphNode) => {
        if (d.isCluster) {
          if (d.category === 'global_cluster')
            return d.categoryColorsInCluster &&
              d.categoryColorsInCluster.length > 0
              ? d.categoryColorsInCluster[0]
              : '#888';
          const baseColor = color(d.category || '');
          return d3.color(baseColor)?.darker(0.5).toString() ?? '#555';
        }
        return color(d.category || '');
      })
      .style('cursor', 'pointer')
      .on('click', function (_e, d: GraphNode) {
        if (
          d.isCluster &&
          d.childNodes &&
          d.childNodes.length > 0 &&
          currentZoomLevel.value < ZOOM_LEVEL_SCALES.length
        ) {
          const targetZoomLevel = currentZoomLevel.value + 1;
          const targetScale = ZOOM_LEVEL_SCALES[targetZoomLevel - 1];
          if (svg.value && zoomBehavior && xScale) {
            const currentWidth = svg.value.clientWidth;
            const currentHeight = svg.value.clientHeight;
            const newTx = currentWidth / 2 - (d.x ?? 0) * targetScale;
            const newTy = currentHeight / 2 - (d.y ?? 0) * targetScale;
            const newTransform = d3.zoomIdentity
              .translate(newTx, newTy)
              .scale(targetScale);
            d3.select(svg.value as SVGSVGElement)
              .transition()
              .duration(300)
              .call(zoomBehavior.transform as any, newTransform)
              .on('end', () => {
                currentZoomLevel.value = targetZoomLevel;
                lastTransform = newTransform;
              });
          }
        } else {
          emit('conceptSelected', d);
        }
      })
      .on('mouseover', function (event: MouseEvent, d: GraphNode) {
        /* ... tooltip logic ... */
      })
      .on('mouseout', function () {
        /* ... tooltip logic ... */
      });

    nodeEnter
      .attr('cx', (d) => d.previous_x ?? d.x ?? 0)
      .attr('cy', (d) => d.previous_y ?? d.y ?? 0);
    const nodeUpdateAndEnter = nodeEnter.merge(nodeSelection);
    nodeUpdateAndEnter.call(
      d3
        .drag<SVGCircleElement, GraphNode>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded),
    );

    const labelSelection = labelGroup
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(displayNodes, (d: any) => d.id);
    labelSelection
      .exit()
      .transition()
      .duration(transitionDuration)
      .style('opacity', 0)
      .attr('x', (d: any) =>
        (findTargetParentCluster(d, displayNodes)?.x ?? d.x ?? 0).toString(),
      )
      .attr('y', (d: any) =>
        (
          (findTargetParentCluster(d, displayNodes)?.y ?? d.y ?? 0) - 12
        ).toString(),
      )
      .remove();
    const labelEnter = labelSelection
      .enter()
      .append('text')
      .style('opacity', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#333')
      .text((d: GraphNode) => d.name ?? d.id);
    labelEnter
      .attr('x', (d) => d.previous_x ?? d.x ?? 0)
      .attr('y', (d) => (d.previous_y ?? d.y ?? 0) - 12);
    const labelUpdateAndEnter = labelEnter.merge(labelSelection);

    if (props.usePhysics) {
      if (!simulation) {
        setupSimulation(displayNodes, visualLinks);
      } else {
        simulation.nodes(displayNodes);
        (
          simulation.force('link') as d3.ForceLink<
            GraphNode,
            d3.SimulationLinkDatum<GraphNode>
          >
        ).links(visualLinks);
      }
      simulation?.alpha(1).restart(); // Reheat the simulation

      // Direct styling, simulation will handle positions in 'ticked'
      nodeUpdateAndEnter
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
      labelUpdateAndEnter.style('opacity', 1);
      linkUpdateAndEnter.attr('stroke-opacity', 0.6);
    } else {
      simulation?.stop(); // Stop simulation if not using physics
      nodeUpdateAndEnter
        .transition()
        .duration(transitionDuration)
        .attr('cx', (d: GraphNode) => d.x!)
        .attr('cy', (d: GraphNode) => d.y!)
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
        .attr('x', (d: GraphNode) => d.x!)
        .attr('y', (d: GraphNode) => (d.y ?? 0) - 12)
        .style('opacity', 1);

      linkUpdateAndEnter
        .transition()
        .duration(transitionDuration)
        .attr('x1', (d: any) => (d.source as GraphNode).x!)
        .attr('y1', (d: any) => (d.source as GraphNode).y!)
        .attr('x2', (d: any) => (d.target as GraphNode).x!)
        .attr('y2', (d: any) => (d.target as GraphNode).y!)
        .attr('stroke-opacity', 0.6);

      displayNodes.forEach((d) => {
        if (d.isCluster && d.childNodes && d.x != null && d.y != null) {
          currentFrameClusterInfo.set(d.id, {
            x: d.x,
            y: d.y,
            childNodeOriginalIds: d.childNodes.map((cn) => cn.id),
          });
        }
      });
    }
    previousFrameClusterInfo = new Map(currentFrameClusterInfo);
  }

  function dragStarted(
    event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
  ) {
    event.sourceEvent?.stopPropagation();
    const subjectNode = event.subject as GraphNode;
    if (props.usePhysics) {
      if (!event.active) simulation?.alphaTarget(0.3).restart();
      subjectNode.fx = subjectNode.x ?? 0;
      subjectNode.fy = subjectNode.y ?? 0;
    } else {
      // Non-physics drag start
      subjectNode.fx = null; // Ensure fx/fy are not carried over from a previous physics state
      subjectNode.fy = null;
    }
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
      // Manual dragging without physics
      subjectNode.x = event.x;
      subjectNode.y = event.y;
      // Update visual elements directly
      d3.select(event.sourceEvent.target as SVGCircleElement)
        .attr('cx', subjectNode.x)
        .attr('cy', subjectNode.y);
      if (labelGroup) {
        labelGroup
          .selectAll<SVGTextElement, GraphNode>('text')
          .filter((d: GraphNode) => d.id === subjectNode.id)
          .attr('x', subjectNode.x)
          .attr('y', (subjectNode.y ?? 0) - 12);
      }
      if (linkGroup) {
        linkGroup
          .selectAll<SVGLineElement, d3.SimulationLinkDatum<GraphNode>>('line')
          .filter(
            (l: any) =>
              (l.source as GraphNode).id === subjectNode.id ||
              (l.target as GraphNode).id === subjectNode.id,
          )
          .attr('x1', (d: any) => (d.source as GraphNode).x!)
          .attr('y1', (d: any) => (d.source as GraphNode).y!)
          .attr('x2', (d: any) => (d.target as GraphNode).x!)
          .attr('y2', (d: any) => (d.target as GraphNode).y!);
      }
    }
  }

  function dragEnded(
    event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>,
  ) {
    event.sourceEvent?.stopPropagation();
    if (!xScale) return;
    const subjectNode = event.subject as GraphNode;
    const targetX = xScale(subjectNode.year);

    if (props.usePhysics) {
      if (!event.active) simulation?.alphaTarget(0);
      // For physics, only fix X, allow Y to be determined by simulation unless user specifically sets it.
      // The drag sets fx, fy. If Y is meant to be free, fy should be cleared after drag unless persistent user Y is desired.
      // For now, keep fx, but set fy based on current drag position to allow some Y adjustment.
      subjectNode.fx = targetX; // Snap X back to its year scale
      subjectNode.fy = event.y; // Keep Y where dragged for physics
      userPositionedNodes.value.set(subjectNode.id, { fy: event.y });
    } else {
      // Non-physics: position is directly set
      subjectNode.x = targetX; // Snap X
      subjectNode.y = event.y; // Keep Y where dragged
      userPositionedNodes.value.set(subjectNode.id, { fy: event.y });

      // Transition the node and associated elements to the new snapped X and dragged Y
      d3.select(event.sourceEvent.target as SVGCircleElement)
        .transition()
        .duration(150)
        .attr('cx', subjectNode.x)
        .attr('cy', subjectNode.y);
      if (labelGroup) {
        labelGroup
          .selectAll<SVGTextElement, GraphNode>('text')
          .filter((d: GraphNode) => d.id === subjectNode.id)
          .transition()
          .duration(150)
          .attr('x', subjectNode.x)
          .attr('y', (subjectNode.y ?? 0) - 12);
      }
      if (linkGroup) {
        linkGroup
          .selectAll<SVGLineElement, d3.SimulationLinkDatum<GraphNode>>('line')
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
    }
  }

  onMounted(() => {
    resizeObserver = new ResizeObserver(debouncedRender);
    if (container.value)
      resizeObserver.observe(container.value as unknown as Element);
    // Initial render after mount
    debouncedRender();
  });

  onBeforeUnmount(() => {
    simulation?.stop();
    resizeObserver?.disconnect();
  });

  const debouncedRender = debounce(render, 10);

  watch(
    () => [
      props.nodes,
      props.links,
      props.currentYearRange,
      props.usePhysics,
      props.highlightNodeId,
    ],
    () => {
      // If usePhysics is toggled off, stop the simulation.
      if (!props.usePhysics) {
        simulation?.stop();
        // If physics was just turned off, nodes might need to be re-positioned based on their fx/fy values.
        // This part needs careful consideration to avoid jumping nodes.
        // For now, let's assume a simple re-positioning based on fx/fy.
        debouncedRender();
      } else {
        debouncedRender();
      }
    },
    { deep: false },
  ); // deep:false is important for performance with large node/link arrays

  watch(
    () => props.targetZoomLevel,
    (newTargetLevel) => {
      if (
        newTargetLevel !== undefined &&
        newTargetLevel !== currentZoomLevel.value
      ) {
        if (newTargetLevel >= 1 && newTargetLevel <= ZOOM_LEVEL_SCALES.length) {
          const targetScale = ZOOM_LEVEL_SCALES[newTargetLevel - 1];
          const svgInstance = svg.value;
          if (svgInstance && zoomBehavior) {
            currentZoomLevel.value = newTargetLevel; // Set current level before calling zoom
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
            d3.select(svgInstance as unknown as Element)
              .transition()
              .duration(300)
              .call(zoomBehavior.transform as any, newTransform)
              .on('end', () => {
                lastTransform =
                  newTransform; /* processZoomLogic will be called by zoom handler */
              });
          }
        }
      }
    },
  );
</script>

<style scoped>
  .stammbaum-container {
    width: 100%;
    height: 600px; /* Or other appropriate default height */
    position: relative;
  }

  .stammbaum-tooltip {
    position: absolute;
    opacity: 0;
    background-color: white;
    border: 1px solid #ccc;
    padding: 8px;
    border-radius: 4px;
    pointer-events: none; /* Important so it doesn't interfere with mouse events on SVG */
    font-size: 0.9em;
    z-index: 10;
    transition: opacity 0.2s;
  }
</style>
