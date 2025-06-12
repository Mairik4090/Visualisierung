<template>
  <div class="ki-stammbaum-container">
    <h2>KI-Stammbaum Visualisierung</h2>
    <svg
      ref="svg"
      class="ki-stammbaum-svg"
      aria-label="KI-Stammbaum Visualisierung"
      role="img"
    >
      <title>KI-Stammbaum Visualisierung</title>
      <!-- Fallback-Anzeige während des Ladens -->
      <text v-if="!nodes || nodes.length === 0" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">
        Visualisierung lädt...
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import * as d3 from 'd3';
import type { Node, Link } from '@/types/concept';

/** Node definition extended with optional name for labels */
interface GraphNode extends Node {
  name?: string;
}

/**
 * Eingehende Daten für die Darstellung des KI-Stammbaums.
 * Beide Properties sind optional, um flexibel mit verschiedenen Datenquellen zu arbeiten.
 */
const props = defineProps<{
  nodes?: GraphNode[];
  links?: Link[];
}>();

/**
 * Event-Emitter für Kommunikation mit der Parent-Komponente.
 * Wird ausgelöst, wenn ein Benutzer auf einen Knoten klickt.
 */
const emit = defineEmits<{
  conceptSelected: [node: GraphNode];
}>();

/** 
 * SVG-Referenz für alle D3-Manipulationen 
 * Wird verwendet, um das DOM-Element direkt mit D3.js zu steuern
 */
const svg = ref<SVGSVGElement | null>(null);

/**
 * Render-Funktion erzeugt die Visualisierung des Stammbaums.
 * Verwendet D3.js für die dynamische SVG-Generierung und Interaktivität.
 */
function render(): void {
  // Frühzeitiger Ausstieg, falls SVG-Element noch nicht verfügbar
  if (!svg.value || !props.nodes || props.nodes.length === 0) return;

  // D3-Selektion des SVG-Elements
  const svgSel = d3.select(svg.value);
  
  // Vorherige Inhalte entfernen für saubere Neuzeichnung
  svgSel.selectAll('*').remove();

  // Dynamische Größenbestimmung basierend auf Container
  const width = svg.value.clientWidth || 600;
  const height = svg.value.clientHeight || 400;

  // ViewBox für responsive Skalierung setzen
  svgSel
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Zeitskala für horizontale Positionierung der Knoten erstellen
  const years = props.nodes.map((d) => d.year);
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(years) as [number, number])
    .range([40, width - 40]); // Rand von 40px links und rechts

  // Vertikale Mittelposition für alle Knoten
  const y = height / 2;
  
  // Hauptgruppe für alle grafischen Elemente
  const g = svgSel.append('g');

  // Kreise für jeden Knoten zeichnen
  g.selectAll('circle')
    .data(props.nodes, (d: any) => d.id) // Eindeutige Schlüssel für effiziente Updates
    .join('circle')
    .attr('cx', (d) => xScale(d.year)) // X-Position basierend auf Jahr
    .attr('cy', y) // Alle Knoten auf gleicher Höhe
    .attr('r', 6) // Radius der Kreise
    .attr('fill', '#1f77b4') // Blaue Füllfarbe
    .style('cursor', 'pointer') // Zeiger-Cursor für Interaktivität
    .on('click', (_event, d) => emit('conceptSelected', d as GraphNode)); // Click-Handler

  // Textlabels für jeden Knoten hinzufügen
  g.selectAll('text')
    .data(props.nodes, (d: any) => d.id)
    .join('text')
    .attr('x', (d) => xScale(d.year)) // X-Position entspricht Kreis
    .attr('y', y - 12) // Leicht oberhalb des Kreises
    .attr('text-anchor', 'middle') // Zentrierte Textausrichtung
    .text((d) => d.name ?? d.id) // Name oder ID als Fallback
    .style('font-size', '10px') // Kleine Schriftgröße für Übersichtlichkeit
    .style('fill', '#333'); // Dunkle Textfarbe für Kontrast

  // TODO: Links zwischen Knoten basierend auf props.links hinzufügen
  // Kann in zukünftigen Versionen implementiert werden
}

// Komponente nach dem Mounting rendern
onMounted(render);

// Bei Änderungen der Props neu rendern
watch(
  () => [props.nodes, props.links],
  render,
  { deep: true }, // Tiefe Überwachung für verschachtelte Objekte
);
</script>

<style scoped>
/* Hauptcontainer für die Stammbaum-Visualisierung */
.ki-stammbaum-container {
  width: 100%;
  height: 80vh; /* Beispielhöhe - anpassbar je nach Layout-Anforderungen */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

/* Überschrift der Visualisierung */
.ki-stammbaum-container h2 {
  margin-bottom: 20px;
  color: #333;
  font-size: 1.5rem;
}

/* SVG-Element für die D3.js-Visualisierung */
.ki-stammbaum-svg {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc; /* Visueller Platzhalter während der Entwicklung */
  border-radius: 4px;
  background-color: #fafafa; /* Leichter Hintergrund für bessere Sichtbarkeit */
}

/* Styling für Ladetext */
.ki-stammbaum-svg text {
  font-family: 'Arial', sans-serif;
  fill: #666;
}
</style>