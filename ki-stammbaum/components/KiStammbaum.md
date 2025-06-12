# KiStammbaum.vue

Diese Komponente bildet die zentrale Visualisierung des KI-Stammbaums. Die bereits
transformierten Graph-Daten werden per Props übergeben und dienen als Grundlage für die
D3-Visualisierung. Die Kreise werden entlang einer Zeitachse positioniert und bei
Datenänderungen oder nach dem Mount automatisch neu gezeichnet.

## Props

- `nodes` – Liste der Knotenobjekte (`id`, `name`, `year`). Die horizontale Position eines Knotens richtet sich nach dem Jahr.
- `links` – Liste der Verbindungen zwischen den Knoten (`source`, `target`).
- `usePhysics` – aktiviert die D3-Force-Simulation (Standard: `true`). Bei
  `false` werden die Knoten nur anhand ihres Jahres positioniert.

## Emits

- `conceptSelected(concept)` – wird ausgelöst, wenn ein Knoten angeklickt wurde.

## D3‑Zeitleistenverhalten

Die Knoten werden entlang einer Zeitachse angeordnet. D3 berechnet aus dem `year` jedes Knotens die x-Position. Eine Force-Simulation sorgt dafür, dass sich die Punkte dynamisch bewegen und über ihre Links verbunden bleiben.
