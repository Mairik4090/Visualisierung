
/**
 * Composable to load the KI tree data once and provide
 * reactive state for other components.
 */
import { shallowRef, type Ref } from 'vue';

// Cache for the fetched data so multiple components share the same result.
const cachedData: Ref<unknown | null> = shallowRef(null);
const pendingState = shallowRef(false);
const errorState = shallowRef<unknown | null>(null);

/**
 * Fetches `/data/ki-stammbaum.json` and returns reactive refs.
 * The data is cached across calls.
 */
export function useStammbaumData() {
  const data = shallowRef<unknown | null>(cachedData.value);

  async function load() {
    if (cachedData.value || pendingState.value) {
      data.value = cachedData.value;
      return;
    }
    pendingState.value = true;
    errorState.value = null;
    try {
      const result = await $fetch('/data/ki-stammbaum.json');
      cachedData.value = result;
      data.value = result;
    } catch (err) {
      errorState.value = err;
    } finally {
      pendingState.value = false;
    }
  }

  if (!cachedData.value) {
    // Trigger the initial load on first use.
    load();
  }

  return {
    data,
    pending: pendingState,
    error: errorState,
  };
}
