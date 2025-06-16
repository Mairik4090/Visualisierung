<template>
  <div class="zoom-controls-container">
    <button
      v-for="item in zoomLevels"
      :key="item.level"
      :class="{ active: item.level === currentLevel }"
      @click="selectLevel(item.level)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
  /**
   * @file ZoomControls.vue
   * @description Component providing UI buttons to switch between predefined zoom levels
   * for the KI-Stammbaum visualization.
   */

  interface ZoomLevel {
    level: number;
    label: string;
  }

  const props = defineProps({
    /**
     * The currently active zoom level (1-4).
     * This is used to highlight the active button.
     */
    currentLevel: {
      type: Number,
      required: true,
    },
  });

  const emit = defineEmits<{
    /**
     * Event emitted when a user clicks a zoom level button.
     * Used to inform the parent component of the desired new zoom level.
     * Supports v-model pattern if used as `update:currentLevel`.
     * @param e 'update:currentLevel'
     * @param level The target zoom level number (1-4).
     */
    (e: 'update:currentLevel', level: number): void;
  }>();

  // Defines the available zoom levels and their labels for the buttons.
  const zoomLevels: ZoomLevel[] = [
    { level: 1, label: 'Overview' },
    { level: 2, label: 'Centuries' },
    { level: 3, label: 'Decades' },
    { level: 4, label: 'Years' },
  ];

  const selectLevel = (level: number) => {
    if (level !== props.currentLevel) {
      // Emit an event to the parent component to change the zoom level.
      emit('update:currentLevel', level);
    }
  };
</script>

<style scoped>
  .zoom-controls-container {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 5px;
    padding: 5px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    z-index: 1000; /* Ensure it's above other elements */
  }

  button {
    padding: 8px 12px;
    border: 1px solid #ccc;
    background-color: #fff;
    cursor: pointer;
    text-align: center;
    border-radius: 3px;
    font-size: 0.9em;
  }

  button:hover {
    background-color: #f0f0f0;
  }

  button.active {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
  }
</style>
