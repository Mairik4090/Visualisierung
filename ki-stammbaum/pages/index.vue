<template>
  <div>
    <h1>KI Stammbaum</h1>
    <ClientOnly>
      <div v-if="pending">Loading data...</div>
      <div v-else-if="error">Error loading data: {{ error.message }}</div>
      <pre v-else>{{ treeData }}</pre>
      <template #fallback>
        <!-- Optional: A fallback message while the client-side script loads -->
        <div>Loading interactive content...</div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });
import { useStammbaumData } from '@/composables/useStammbaumData';

const { data: treeData, pending, error } = useStammbaumData();
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
