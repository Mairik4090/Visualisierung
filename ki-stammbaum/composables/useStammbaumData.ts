import { shallowRef, type Ref } from 'vue';
import { useRuntimeConfig } from '#app';

/**
 * Interface für die Struktur der Stammbaum-Daten
 */
export interface StammbaumData {
  nodes: any[];
  [key: string]: any;
}

// Globaler Cache für die geladenen Daten - wird zwischen allen Composable-Instanzen geteilt
const dataCache: Ref<StammbaumData | null> = shallowRef(null);
// Globaler Zustand für laufende Anfragen - verhindert mehrfache gleichzeitige Requests
const pendingCache = shallowRef(false);
// Globaler Fehlerzustand - speichert den letzten aufgetretenen Fehler
const errorCache = shallowRef<Error | null>(null);

/**
 * Lädt die Stammbaum-Daten von der API
 * Verwendet Caching um mehrfache Requests zu vermeiden
 */
async function loadData(): Promise<void> {
  if (dataCache.value || pendingCache.value) {
    return;
  }

  pendingCache.value = true;
  errorCache.value = null;

  try {
    // Load data from local module first
    const localModule = await import('~/public/data/ki-stammbaum.json');
    dataCache.value = (localModule.default || localModule) as StammbaumData;
  } catch (importErr) {
    try {
      // Fallback to network fetch if local import fails
      const config = useRuntimeConfig();
      const base = config.app.baseURL || '/';
      const result = await $fetch<StammbaumData>(
        '/public/data/ki-stammbaum.json',
      );
      dataCache.value = result;
    } catch (networkErr) {
      errorCache.value = networkErr as Error;
    }
  } finally {
    pendingCache.value = false;
  }
}

/**
 * Hauptfunktion des Composables
 * Stellt reaktive Referenzen auf Daten, Ladezustand und Fehler zur Verfügung
 *
 * @returns Objekt mit reaktiven Referenzen für data, pending und error
 */
export function useStammbaumData() {
  if (!dataCache.value && !pendingCache.value) {
    // Fire-and-forget Aufruf - Komponenten können den pending-Zustand überwachen
    loadData();
  }

  return {
    data: dataCache, // Die geladenen Stammbaum-Daten
    pending: pendingCache, // Boolean ob gerade geladen wird
    error: errorCache, // Eventuell aufgetretener Fehler
  };
}
