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
    /* Richtet die h3 rechtsbündig aus */
    text-align: right;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    margin-top: 0.25rem;
    /* Behält den Versatz nach links bei */
    padding-right: 1.5rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 0.25rem;

    /* NEU: Kehrt die visuelle Reihenfolge der Elemente um (Text, dann Box) */
    flex-direction: row-reverse;

    /* NEU: Richtet den Inhalt am Start der Hauptachse aus. Da die Richtung
       umgekehrt ist, ist der "Start" nun rechts. */
    justify-content: flex-start;
  }

  .color-box {
    width: 1rem;
    height: 1rem;
    /* GEÄNDERT: Abstand wieder links von der Box, um sie vom Text zu trennen */
    margin-left: 0.5rem;
    border-radius: 2px;
    border: 1px solid #ccc;
    flex-shrink: 0;
  }
</style>
