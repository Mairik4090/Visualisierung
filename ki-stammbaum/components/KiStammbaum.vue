<template>
  <div class="ki-stammbaum-container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg ref="svg" class="ki-stammbaum-svg" aria-label="KI-Stammbaum Visualisierung" role="img">
      <title>KI-Stammbaum Visualisierung</title>
    </svg>
  </div>
</template>

<script setup lang="ts">
// Vue Composition API Imports für Lifecycle und Reaktivität
import { onMounted, ref, watch } from 'vue';
// Import des zentralen KiConcept-Typs und Graph-Types aus der Typdefinitionsdatei
import type { KiConcept, Node, Link } from '@/types/concept';

/**
 * Event-Emitter für Kommunikation mit der Parent-Komponente
 * conceptSelected: Wird ausgelöst wenn ein Knoten im Stammbaum angeklickt wird
 */
const emit = defineEmits<{
  conceptSelected: [concept: KiConcept];
}>();

// Props für die bereits transformierten Graph-Daten
const props = defineProps<{
  nodes: Node[];
  links: Link[];
}>();

// Referenz auf das SVG-Element für D3.js-Manipulationen
const svg = ref<SVGSVGElement | null>(null);

/**
 * Watcher für Datenänderungen
 * Wird ausgelöst sobald neue Daten verfügbar sind und initiiert die D3-Visualisierung
 */
watch(
  () => props.nodes,
  (newNodes) => {
    if (newNodes && svg.value) {
      console.log('Graph aktualisiert:', newNodes.length, 'Knoten');
      // renderD3Visualization({ nodes: newNodes, links: props.links });
    }
  },
  { immediate: true },
);

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