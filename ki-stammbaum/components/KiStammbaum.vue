<template>
  <div class="ki-stammbaum-container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg ref="svg" class="ki-stammbaum-svg" aria-label="KI-Stammbaum Visualisierung" role="img">
      <title>KI-Stammbaum Visualisierung</title>
      <g v-for="(node, index) in graphData.nodes" :key="node.id">
        <circle :cx="20 + index * 30" cy="20" r="5" />
        <text :x="20 + index * 30" y="35" text-anchor="middle">{{ node.name || node.id }}</text>
      </g>
      <text v-if="pending" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Visualisierung lädt...</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
// Vue Composition API Imports für Lifecycle und Reaktivität
import { onMounted, ref, watch, computed } from 'vue';
// Import des zentralen KiConcept-Typs und Graph-Types aus der Typdefinitionsdatei
import type { KiConcept, Node, Link } from '@/types/concept';
// Import des Composables zum Laden der Stammbaum-Daten
import { useStammbaumData } from '@/composables/useStammbaumData';

/**
 * Event-Emitter für Kommunikation mit der Parent-Komponente
 * conceptSelected: Wird ausgelöst wenn ein Knoten im Stammbaum angeklickt wird
 */
const emit = defineEmits<{
  conceptSelected: [concept: KiConcept];
}>();

const props = defineProps<{
  nodes?: Node[];
  links?: Link[];
}>();

// Referenz auf das SVG-Element für D3.js-Manipulationen
const svg = ref<SVGSVGElement | null>(null);

// Laden der Stammbaum-Daten über das Composable
const { data, pending, error } = useStammbaumData();

/**
 * Computed Property zur Transformation der rohen Daten in Graph-Strukturen
 * Konvertiert die KiConcept-Daten in Nodes und Links für D3.js
 */
const graphData = computed(() => {
  if (props.nodes && props.nodes.length) {
    return { nodes: props.nodes, links: props.links ?? [] };
  }
  if (!data.value?.nodes) return { nodes: [], links: [] };

  const concepts = data.value.nodes as KiConcept[];
  
  // Transformation zu Graph-Knoten
  const nodes: Node[] = concepts.map(concept => ({
    id: concept.id,
    name: concept.name,
    year: concept.year,
    description: concept.description,
    // Weitere D3-spezifische Eigenschaften können hier hinzugefügt werden
    x: 0,
    y: 0
  }));
  
  // Transformation zu Graph-Verbindungen basierend auf Dependencies
  const links: Link[] = [];
  concepts.forEach(concept => {
    if (concept.dependencies) {
      concept.dependencies.forEach(depId => {
        links.push({
          source: depId,
          target: concept.id
        });
      });
    }
  });
  
  return { nodes, links };
});

/**
 * Watcher für Datenänderungen der Graph-Struktur
 * Wird ausgelöst sobald neue transformierte Daten verfügbar sind und initiiert die D3-Visualisierung
 */
watch(
  graphData,
  (newGraphData) => {
    if (newGraphData.nodes.length > 0 && svg.value) {
      console.log('Graph aktualisiert:', newGraphData.nodes.length, 'Knoten,', newGraphData.links.length, 'Verbindungen');
      // renderD3Visualization(newGraphData); // Später implementieren
    }
  },
  { immediate: true }
);

/**
 * Watcher für Fehlerbehandlung
 * Loggt Fehler beim Laden der Daten
 */
watch(error, (newError) => {
  if (newError) {
    console.error('Fehler beim Laden der Stammbaum-Daten:', newError);
  }
});

/**
 * Lifecycle Hook - wird nach dem Mounten der Komponente ausgeführt
 * Loggt das SVG-Element für Debugging-Zwecke
 */
onMounted(() => {
  console.log('KiStammbaum Komponente mounted. SVG-Element:', svg.value);
});

/**
 * Event-Handler für Klicks auf Knoten in der Visualisierung
 * Emittiert das conceptSelected-Event mit dem angeklickten Konzept
 * 
 * @param concept - Das angeklickte KI-Konzept
 */
function handleNodeClick(concept: KiConcept): void {
  emit('conceptSelected', concept);
}

/**
 * Hilfsfunktion zur Transformation einzelner Konzepte zu Graph-Knoten
 * Kann für spezielle D3-Anpassungen erweitert werden
 * 
 * @param concept - Das zu transformierende KI-Konzept
 * @returns Graph-Knoten für D3.js
 */
function conceptToNode(concept: KiConcept): Node {
  return {
    id: concept.id,
    name: concept.name,
    year: concept.year,
    description: concept.description,
    x: 0,
    y: 0
  };
}
</script>

<style scoped>
/* Hauptcontainer für die Stammbaum-Visualisierung */
.ki-stammbaum-container {
  width: 100%;
  height: 80vh; /* Beispielhöhe - anpassbar je nach Layout-Anforderungen */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* SVG-Element für die D3.js-Visualisierung */
.ki-stammbaum-svg {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc; /* Visueller Platzhalter während der Entwicklung */
}
</style>
