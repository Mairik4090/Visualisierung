<template>
  <div class="ki-stammbaum-container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg ref="svg" class="ki-stammbaum-svg">
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Visualisierung lädt...</text>
    </svg>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['conceptSelected']);

const svg = ref(null);

watch(() => props.data, (newData) => {
  if (newData && svg.value) {
    console.log('Daten für D3 aktualisiert:', newData.length, 'Konzepte');
    // renderD3Visualization(newData); // Später implementieren
  }
}, { immediate: true });

onMounted(() => {
  console.log('KiStammbaum Komponente mounted. SVG-Element:', svg.value);
  // if (props.data.length > 0) {
  //   renderD3Visualization(props.data); // Später implementieren
  // }
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
 * Die KiStammbaum-Komponente ist für die rendering der interaktiven D3.js-Visualisierung des KI-Stammbaums zuständig.
 * Sie empfängt die Daten über die 'data' Prop und aktualisiert die Visualisierung, wenn sich die Daten ändern.
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
