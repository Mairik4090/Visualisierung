<template>
  <div>
    <h1>KI Stammbaum</h1>
    <div v-if="pending">Loading data...</div>
    <div v-else-if="error">Error loading data: {{ error.message }}</div>
    <pre v-else>{{ treeData }}</pre>
  </div>
</template>

<script setup lang="ts">
  // Use runtime config so the fetch path respects the app base URL.
  const config = useRuntimeConfig();
  // Build the full URL to the JSON file using the runtime base URL. The trailing
  // slash is trimmed to avoid duplicated path separators.
  const jsonUrl = `${config.app.baseURL.replace(/\/$/, '')}/data/ki-stammbaum.json`;
  const { data: treeData, pending, error } = await useFetch(jsonUrl);
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
