# KiStammbaum.vue

Diese Komponente bildet die zentrale Visualisierung des KI-Stammbaums. Sie lädt die Daten 
über `useStammbaumData()` und übergibt sie an D3, um ein interaktives SVG zu rendern.

## Props

- *keine* – die Daten stammen aus dem Composable.

## Emits

- `conceptSelected(concept)` – wird ausgelöst, wenn ein Knoten angeklickt wurde.
