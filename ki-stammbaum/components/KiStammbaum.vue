<template>
  <div class="ki-stammbaum-container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg ref="svg" class="ki-stammbaum-svg" aria-label="KI-Stammbaum Visualisierung" role="img">
      <title>KI-Stammbaum Visualisierung</title>
      <text v-if="!props.data.length" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Visualisierung lädt...</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { KiConcept } from '@/types/concept';

const props = defineProps<{ data: KiConcept[] }>();

const emit = defineEmits<{
  (e: 'conceptSelected', concept: KiConcept): void;
}>();

const svg = ref<SVGSVGElement | null>(null);

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

function handleNodeClick(concept: KiConcept) {
  emit('conceptSelected', concept);
}
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
