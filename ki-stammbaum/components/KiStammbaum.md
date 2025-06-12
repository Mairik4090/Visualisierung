# KiStammbaum.vue

Diese Komponente bildet die zentrale Visualisierung des KI-Stammbaums. Die bereits
transformierten Graph-Daten werden per Props übergeben und dienen als Grundlage für die
D3-Visualisierung.

## Props

- `nodes` – Array der Knoten für die Darstellung
- `links` – Array der Kanten zwischen den Knoten

## Emits

- `conceptSelected(concept)` – wird ausgelöst, wenn ein Knoten angeklickt wurde.
