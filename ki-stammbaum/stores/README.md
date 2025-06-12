# Pinia Stores

Dieses Verzeichnis enthält globale Anwendungszustände für die KI-Stammbaum-Visualisierung. Aktuell gibt es einen Store:

- **`stammbaum.ts`** – speichert aktive Filter, die ausgewählte `conceptId` sowie den aktuellen Zoom-Zustand der D3-Visualisierung.

Der Store kann in Komponenten über `useStammbaumStore()` eingebunden und reaktiv genutzt werden.
