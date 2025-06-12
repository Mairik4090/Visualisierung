<template>
  <BaseModal :open="!!concept" @close="close">
    <div v-if="concept" class="concept-detail-container">
      <h2>Konzeptdetails</h2>
      <p><strong>Name:</strong> {{ concept.name }}</p>
      <p><strong>Jahr:</strong> {{ concept.year }}</p>
      <p><strong>Beschreibung:</strong> {{ concept.description }}</p>
      <NodeTimeline :concept="concept" />
      <button class="close-button" type="button" @click="close">
        Schließen
      </button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
  // Import des zentralen Concept-Typs aus der Typdefinitionsdatei
  import type { Concept } from '@/types/concept';
  // Import der BaseModal-Komponente für die modale Darstellung
  import BaseModal from './ui/BaseModal.vue';
  import NodeTimeline from './NodeTimeline.vue';

  /**
   * Props-Definition für die Komponente
   * concept: Das anzuzeigende KI-Konzept oder null wenn kein Konzept ausgewählt ist
   */
  const props = defineProps<{
    concept: Concept | null;
  }>();

  /**
   * Event-Emitter für Kommunikation mit der Parent-Komponente
   * close: Event wird ausgelöst wenn das Modal geschlossen werden soll
   */
  const emit = defineEmits<{
    close: [];
  }>();

  /**
   * Schließt das Modal durch Emission des close-Events
   * Wird sowohl vom Schließen-Button als auch vom BaseModal selbst aufgerufen
   */
  function close(): void {
    emit('close');
  }
</script>

<style scoped>
  /* Container für den Hauptinhalt des Konzeptdetails-Modals */
  .concept-detail-container {
    border: 1px solid #eee;
    padding: 1rem;
    margin-top: 1rem;
    background-color: #f9f9f9;
    border-radius: 8px;
  }

  /* Styling für die Überschrift - Abstand oben entfernen */
  .concept-detail-container h2 {
    margin-top: 0;
    color: #333;
  }

  /* Spacing zwischen den Informationsparagraphen */
  .concept-detail-container p {
    margin-bottom: 0.5rem;
  }
</style>
