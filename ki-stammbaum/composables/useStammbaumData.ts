/**
 * Composable zum Laden und Cachen der KI-Stammbaum-Daten
 * Stellt reaktive Zustände für mehrere Komponenten zur Verfügung
 */
import { shallowRef, type Ref } from 'vue';

/**
 * Interface für die Struktur der Stammbaum-Daten
 */
interface StammbaumData {
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
  // Frühzeitiger Ausstieg wenn Daten bereits geladen oder Request läuft
  if (dataCache.value || pendingCache.value) {
    return;
  }

  // Ladezustand setzen und vorherige Fehler zurücksetzen
  pendingCache.value = true;
  errorCache.value = null;

  try {
    // Daten von der API laden und in den Cache speichern
    const result = await $fetch<StammbaumData>('/data/ki-stammbaum.json');
    dataCache.value = result;
  } catch (err) {
    try {
      // Fallback auf statischen Import, falls kein Netzwerkzugriff möglich ist
      const localModule = await import('@/public/data/ki-stammbaum.json');
      dataCache.value = (localModule.default || localModule) as StammbaumData;
    } catch {
      // Fehler erfassen und in typisierter Form speichern
      errorCache.value = err as Error;
    }
  } finally {
    // Ladezustand in jedem Fall zurücksetzen
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
  // Automatisches Laden initiieren wenn noch keine Daten vorhanden und kein Request läuft
  if (!dataCache.value && !pendingCache.value) {
    // Fire-and-forget Aufruf - Komponenten können den pending-Zustand überwachen
    loadData();
  }

  // Reaktive Referenzen zurückgeben die von allen Komponenten geteilt werden
  return {
    data: dataCache,     // Die geladenen Stammbaum-Daten
    pending: pendingCache, // Boolean ob gerade geladen wird
    error: errorCache    // Eventuell aufgetretener Fehler
  };
}
