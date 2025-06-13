<template>
  <div class="filter-controls-container">
    <h3>Filter und Sortierung</h3>
    <div>
      <label for="start-year-filter">Start Year:</label>
      <input
        id="start-year-filter"
        v-model="startYearFilter"
        type="number"
        placeholder="z.B. 1950"
        min="1900"
        max="2100"
      />
    </div>
    <div>
      <label for="end-year-filter">End Year:</label>
      <input
        id="end-year-filter"
        v-model="endYearFilter"
        type="number"
        placeholder="z.B. 2000"
        min="1900"
        max="2100"
      />
    </div>
    <div>
      <label for="type-filter">Typ:</label>
      <select id="type-filter" v-model="typeFilter">
        <option value="">Alle</option>
        <option value="algorithm">Algorithmus</option>
        <option value="concept">Konzept</option>
        <option value="technology">Technologie</option>
      </select>
    </div>
    <button @click="applyFilters">Filter anwenden</button>
  </div>
</template>

<script setup lang="ts">
  import { ref, defineEmits } from 'vue';

  /**
   * Defines the event emitted by this component.
   * `filtersApplied`: Emitted when the user clicks the "Filter anwenden" button.
   * The payload is an object containing the selected filter values:
   *   {
   *     startYear: number | null, // The selected start year, or null if empty.
   *     endYear: number | null,   // The selected end year, or null if empty.
   *     type: string              // The selected category type, or "" for "Alle".
   *   }
   */
  const emit = defineEmits(['filtersApplied']);

  // Reactive refs for storing the current values of the filter inputs.
  const startYearFilter = ref<number | null>(null); // Bound to the "Start Year" input.
  const endYearFilter = ref<number | null>(null);   // Bound to the "End Year" input.
  const typeFilter = ref<string>('');              // Bound to the "Typ" select input.

  /**
   * Gathers the current filter values from the refs and emits the `filtersApplied` event.
   */
  function applyFilters() {
    const filters = {
      startYear: startYearFilter.value,
      endYear: endYearFilter.value,
      type: typeFilter.value,
    };
    emit('filtersApplied', filters); // Emit the collected filters to the parent component.
  }
</script>

<style scoped>
  .filter-controls-container {
    padding: 1rem;
    border: 1px solid #ddd;
    margin-bottom: 1rem;
    border-radius: 8px;
    background-color: #f9f9f9;
  }

  .filter-controls-container h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #333;
  }

  .filter-controls-container div {
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
  }

  .filter-controls-container label {
    margin-right: 0.5rem;
    font-weight: bold;
    min-width: 50px; /* Adjust as needed */
  }

  .filter-controls-container input[type='number'],
  .filter-controls-container select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    flex-grow: 1;
  }

  .filter-controls-container button {
    padding: 0.5rem 1rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .filter-controls-container button:hover {
    background-color: #0056b3;
  }
</style>
