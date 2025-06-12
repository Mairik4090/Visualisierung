<template>
  <div class="legend">
    <h3>Legende</h3>
    <ul>
      <li v-for="c in categories" :key="c.name" class="legend-item">
        <span class="color-box" :style="{ backgroundColor: c.color }" />
        {{ c.name }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
  /** Legend component displaying node types with their colors. */
  export interface LegendCategory {
    name: string;
    color: string;
  }

  const props = defineProps<{ categories: LegendCategory[] }>();
</script>

<style scoped>
  .legend {
    margin-top: 1rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .color-box {
    width: 1rem;
    height: 1rem;
    margin-right: 0.5rem;
    border-radius: 2px;
    border: 1px solid #ccc;
  }
</style>
