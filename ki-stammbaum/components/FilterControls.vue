<template>
  <div class="filter-controls-container">
    <h3>Filter und Sortierung</h3>
    <div>
      <label for="year-filter">Jahr:</label>
      <input type="number" id="year-filter" v-model="yearFilter" placeholder="z.B. 1950" min="1900" max="2100" />
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

const emit = defineEmits(['filtersApplied']);

const yearFilter = ref<number | null>(null);
const typeFilter = ref<string>('');

function applyFilters() {
  const filters = {
    year: yearFilter.value,
    type: typeFilter.value,
  };
  console.log('Filter angewendet:', filters);
  emit('filtersApplied', filters);
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

.filter-controls-container input[type="number"],
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
