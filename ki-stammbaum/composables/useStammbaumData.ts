import { shallowRef } from 'vue';

interface StammbaumData {
  nodes: any[];
  [key: string]: any;
}

const dataCache = shallowRef<StammbaumData | null>(null);
const pendingCache = shallowRef(false);
const errorCache = shallowRef<Error | null>(null);

async function loadData() {
  if (dataCache.value || pendingCache.value) return;
  pendingCache.value = true;
  try {
    dataCache.value = await $fetch<StammbaumData>('/data/ki-stammbaum.json');
  } catch (err) {
    errorCache.value = err as Error;
  } finally {
    pendingCache.value = false;
  }
}

export function useStammbaumData() {
  if (!dataCache.value && !pendingCache.value) {
    // Fire and forget; composable consumers can watch pending.
    loadData();
  }
  return {
    data: dataCache,
    pending: pendingCache,
    error: errorCache,
  };
}
