/**
 * Pinia-Store für globale Steuerparameter des KI-Stammbaums.
 * Speichert aktive Filter, ausgewählte Konzept-ID und Zoom-Werte.
 * @module stammbaumStore
 */
import { defineStore } from 'pinia';

export interface Filters {
  year: number | null;
  type: string;
}

export interface ZoomState {
  k: number; // Zoom scale
  x: number; // Pan X
  y: number; // Pan Y
}

/**
 * Globaler Store für Visualisierungsparameter.
 */
export const useStammbaumStore = defineStore('stammbaum', {
  state: () => ({
    filters: { year: null, type: '' } as Filters,
    conceptId: null as string | null,
    zoom: { k: 1, x: 0, y: 0 } as ZoomState,
  }),
  actions: {
    setFilters(filters: Filters) {
      this.filters = filters;
    },
    setConceptId(id: string | null) {
      this.conceptId = id;
    },
    setZoom(zoom: ZoomState) {
      this.zoom = zoom;
    },
  },
});
