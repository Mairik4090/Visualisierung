<template>
  <BaseModal :open="!!concept" @close="close">
    <div v-if="concept" class="concept-detail-container">
      <h2>Konzeptdetails</h2>
      <p><strong>Name:</strong> {{ concept.name }}</p>
      <p><strong>Year of Origin:</strong> {{ concept.year }}</p>
      <p><strong>Short Description:</strong> {{ concept.description }}</p>
      <NodeTimeline :concept="concept" />

      <!-- Section detailing concepts that influenced the current concept. Placeholder content. -->
      <div class="influence-section">
        <h3>Beinflusst von:</h3>
        <p>[Informationen demnächst verfügbar]</p>
      </div>

      <!-- Section detailing concepts that were influenced by the current concept. Placeholder content. -->
      <div class="influence-section">
        <h3>Dieses Konzept beeinflusste:</h3>
        <p>[Informationen demnächst verfügbar]</p>
      </div>

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
  import NodeTimeline from './NodeTimeline.vue'; // Component to display a timeline for the concept.

  /**
   * Props for the ConceptDetail component.
   * @property {Concept | null} concept - The concept object to display details for.
   *                                     If null, the modal will not show detailed content.
   *                                     The `Concept` type should include `name`, `year` (for year_of_origin),
   *                                     and `description` (for short_description).
   */
  const props = defineProps<{
    concept: Concept | null;
  }>();

  /**
   * Defines the events emitted by this component.
   * @event close - Emitted when the user requests to close the detail view (e.g., by clicking the close button).
   */
  const emit = defineEmits<{
    close: [];
  }>();

  /**
   * Emits the 'close' event to signal that the detail view should be closed.
   * This function is called by the close button within this component and
   * can also be triggered by the BaseModal component (e.g., when clicking the overlay).
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

  .influence-section {
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid #eee;
  }

  .influence-section h3 {
    margin-bottom: 0.5rem;
    color: #555;
    font-size: 1rem;
  }
</style>
