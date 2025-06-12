<template>
  <div>
    <h1>KI Stammbaum</h1>
    <div v-if="pending">Loading data...</div>
    <div v-else-if="error">Error loading data: {{ error.message }}</div>
    <pre v-else>{{ treeData }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Use runtime config so the fetch path respects the app base URL.
const config = useRuntimeConfig();
const { data: treeData, pending, error } = await useFetch('data/ki-stammbaum.json', {
  baseURL: config.app.baseURL,
});
</script>

<style scoped>
pre {
  background-color: #f4f4f4;
  padding: 1em;
  border-radius: 5px;
  white-space: pre-wrap; /* Allow text wrapping */
  word-wrap: break-word; /* Break long words */
}
</style>
