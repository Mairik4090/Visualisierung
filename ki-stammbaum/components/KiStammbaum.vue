<template>
  <div class="ki-stammbaum-container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg ref="svg" class="ki-stammbaum-svg" aria-label="KI-Stammbaum Visualisierung" role="img">
      <title>KI-Stammbaum Visualisierung</title>
      <text v-if="pending" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Visualisierung lädt...</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useStammbaumData } from '@/composables/useStammbaumData';

const emit = defineEmits(['conceptSelected']);

const svg = ref<SVGSVGElement | null>(null);
const { data, pending } = useStammbaumData();

watch(data, (newData) => {
  if (newData && svg.value) {
    console.log('Daten für D3 aktualisiert:', (newData as any).length, 'Konzepte');
    // renderD3Visualization(newData); // Später implementieren
  }
}, { immediate: true });

onMounted(() => {
  console.log('KiStammbaum Komponente mounted. SVG-Element:', svg.value);
});

function handleNodeClick(concept) {
  emit('conceptSelected', concept);
}

/**
 * @typedef {Object} KiConcept
 * @property {string} id - Eindeutige ID des Konzepts.
 * @property {string} name - Name des KI-Konzepts.
 * @property {number} year - Entstehungsjahr des Konzepts.
 * @property {string[]} dependencies - IDs der Konzepte, von denen dieses Konzept abhängt.
 * @property {string} description - Kurze Beschreibung des Konzepts.
 */
/**
 * Die KiStammbaum-Komponente ist für die Rendering der interaktiven
 * D3.js-Visualisierung des KI-Stammbaums zuständig. Die benötigten Daten
 * werden über das `useStammbaumData`-Composable geladen und bei Änderungen
 * erneut an D3 übergeben.
 */
</script>

<style scoped>
.ki-stammbaum-container {
  width: 100%;
  height: 80vh; /* Beispielhöhe */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ki-stammbaum-svg {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc; /* Visueller Platzhalter */
}
</style>
