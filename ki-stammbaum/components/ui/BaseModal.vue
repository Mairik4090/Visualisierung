<template>
  <teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="close">
      <div class="modal-content" role="dialog">
        <button class="modal-close" aria-label="Schließen" type="button" @click="close">×</button>
        <slot />
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-content {
  background: #fff;
  padding: 1rem;
  border-radius: 0.5rem;
  position: relative;
  max-width: 90%;
  max-height: 90%;
  overflow: auto;
}

.modal-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}
</style>
