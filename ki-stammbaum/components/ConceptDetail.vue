<template>
  <div v-if="concept" class="concept-detail-container">
    <h2>Konzeptdetails</h2>
    <p><strong>Name:</strong> {{ concept.name }}</p>
    <p><strong>Jahr:</strong> {{ concept.year }}</p>
    <p><strong>Beschreibung:</strong> {{ concept.description }}</p>
    <!-- Weitere Details hier -->
  </div>
  <div v-else class="concept-detail-placeholder">
    <p>Wählen Sie ein Konzept aus, um Details anzuzeigen.</p>
  </div>
</template>

<script setup lang="ts">
import type { KiConcept } from '@/types/concept';

const props = defineProps<{
  concept: KiConcept | null;
}>();
</script>

<style scoped>
.concept-detail-container {
  border: 1px solid #eee;
  padding: 1rem;
  margin-top: 1rem;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.concept-detail-container h2 {
  margin-top: 0;
  color: #333;
}

.concept-detail-container p {
  margin-bottom: 0.5rem;
}

.concept-detail-placeholder {
  padding: 1rem;
  margin-top: 1rem;
  text-align: center;
  color: #888;
  border: 1px dashed #ccc;
  border-radius: 8px;
}
</style>
