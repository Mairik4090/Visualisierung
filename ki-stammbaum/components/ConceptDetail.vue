<template>
  <BaseModal :open="!!concept" @close="close">
    <div v-if="concept" class="concept-detail-container">
      <h2>Konzeptdetails</h2>
      <p><strong>Name:</strong> {{ concept.name }}</p>
      <p><strong>Jahr:</strong> {{ concept.year }}</p>
      <p><strong>Beschreibung:</strong> {{ concept.description }}</p>
      <button class="close-button" type="button" @click="close">Schließen</button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import BaseModal from './ui/BaseModal.vue';

// Define the structure of a concept, aligning with KiConcept if possible
interface KiConcept {
  id: string;
  name: string;
  year: number;
  dependencies?: string[];
  description: string;
}

const props = defineProps({
  concept: {
    type: Object as () => KiConcept | null,
    default: null,
  },
});

const emit = defineEmits(['close']);

function close() {
  emit('close');
}
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

</style>
