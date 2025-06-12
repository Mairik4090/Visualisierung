# Agends – KI‑Stammbaum: Eine interaktive Reise durch die Evolution der künstlichen Intelligenz

## 0 Überblick

Diese Roadmap beschreibt die technische Vorgehensweise für die Umsetzung eines Nuxt‑3‑Frontends, das einen interaktiven „KI‑Stammbaum“ auf Basis vorverarbeiteter JSON‑Daten visualisiert. Sie gliedert sich in fünf Themenblöcke – Projektstruktur, Komponenten‑Architektur, D3‑Integration, Interaktivität sowie Code‑Qualität & Kommentierung – und folgt dem Prinzip „offline first“.

---

## 1 Projektstruktur (Nuxt‑3)

```text
├── .nuxt/              # vom Framework generiert
├── assets/             # SCSS/Tailwind‑Erweiterungen, Bilder
│   └── styles/
├── components/         # wiederverwendbare Vue‑Komponenten
│   ├── KiStammbaum.vue         # Haupt‑Visualisierung
│   ├── ConceptDetail.vue       # modale Detailansicht
│   ├── FilterControls.vue      # Filter & Layer‑Toggles
│   ├── Legend.vue              # Graph‑Legende
│   └── ui/                     # generische UI‑Controls
├── composables/        # zustandslose Helfer auf Composition‑API‑Basis
│   └── useStammbaumData.ts     # Laden & Caching der JSON‑Daten
├── layouts/
│   └── default.vue             # Grundlayout mit Header/Footer
├── pages/              # Multi‑Page Routing
│   ├── index.vue               # Landing mit Kurzerklärung
│   ├── stammbaum.vue           # Seite für Hauptgraphen
│   └── about.vue               # Hintergrundinfos / Credits
├── public/             # statische, offline verfügbare Assets
│   └── data/ki-stammbaum.json  # Vorverarbeitete Daten
├── utils/              # Daten‑Transformationslogik (kein Vue‑Code)
│   └── graph-transform.ts
├── types/              # TypeScript‑Interfaces
│   └── concept.d.ts
└── README.md
```

### Datenablage & ‑Ladepfad

- **Ort:** `public/data/ki-stammbaum.json` → wird vom Dev‑ und Static‑Build ohne Server geladen und ist offline zugänglich.
- **Lade‑Strategie:** In `useStammbaumData.ts` mittels `await $fetch('/data/ki-stammbaum.json')`. Das Composable cached die Daten per `shallowRef` und stellt sie reaktiv zur Verfügung.

---

## 2 Vue‑Komponenten‑Architektur

| Komponente           | Aufgabe                                                      | Schlüssel‑Props / Emits                                 |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `KiStammbaum.vue`    | Rendern des gesamten Graphen, Delegation von Interaktionen   | `data` (Graph), `selectedId` (two‑way), Emits: `select` |
| `ConceptDetail.vue`  | Anzeige von Detail‑Metadaten in Modal oder Side‑Pane         | `concept`                                               |
| `FilterControls.vue` | UI‑Elemente, die den globalen Store/Composable aktualisieren | Emits: `update:filter`                                  |
| `Legend.vue`         | Farbschema & Knotentypen erläutern                           | `categories`                                            |
| `BaseModal.vue`      | generische Overlay‑Komponente                                | slots                                                   |

### Exemplarische Struktur von **KiStammbaum.vue**

```vue
<template>
  <svg ref="svgRef" class="w-full h-full" />
  <ConceptDetail v-if="selected" :concept="selected" @close="selected = null" />
</template>

<script setup lang="ts">
  import { ref, watch, onMounted } from 'vue';
  import * as d3 from 'd3';
  import { useStammbaumData } from '@/composables/useStammbaumData';
  import { transformToGraph } from '@/utils/graph-transform';

  const { data: rawData, pending } = useStammbaumData();
  const svgRef = ref<SVGSVGElement | null>(null);
  const selected = ref(null);

  function render() {
    if (!svgRef.value || !rawData.value) return;
    const { nodes, links } = transformToGraph(rawData.value);

    // ►► D3‑Code (Force‑Layout, Zoom, Event‑Listener etc.)
  }

  onMounted(render);
  watch(rawData, render);
</script>

<style scoped>
  svg {
    font-family: system-ui, sans-serif;
  }
</style>
```

---

## 3 D3.js‑Integration & Visualisierungsmuster

### Einbindung in Vue

1. **Datenfluss:** JSON → Composable → reaktive Props der Komponente.
2. **Rendering‑Lebenszyklus:**

   - `onMounted()` → initialer Graph.
   - `watch(rawData)` / `watch(filters)` → `redraw()` mit virtueller Diff‑Strategie (enter/update/exit).

3. **DOM‑Zugriff:** Nur innerhalb D3‑Funktionen; die übrige Komponente bleibt render‑frei.

### Vorschlag A – Force‑Directed Graph mit Zeitauslenkung

- **Konzept:** x‑Achse = Jahr, y‑Koordinate per Force‑Layout (collision‑avoidance). Verbindungs‑Kanten zeigen Abhängigkeiten.
- **Transformation:**

  ```ts
  const nodes = concepts.map((c) => ({ id: c.id, year: +c.year }));
  const links = concepts.flatMap((c) =>
    c.dependsOn.map((d) => ({ source: d, target: c.id })),
  );
  ```

- **Interaktivität:** Dragging einzelner Knoten, Hover‑Tooltip, Klick‑Select.

### Vorschlag B – Radiale Baumdarstellung (Collapsible)

- **Konzept:** Wurzel = ältestes Konzept; Kinder entsprechen abhängigen Konzepten. D3 `cluster` oder `tree` erzeugt polare Koordinaten.
- **Transformation:** Rekursive Bildung einer Hierarchie in `d3.hierarchy()` anhand der Abhängigkeits‑IDs.
- **Interaktivität:** Knoten einklappbar, legendengesteuertes Highlighting nach Kategorien.

### Minimal‑Snippet – D3‑Setup innerhalb einer Komponente

```ts
function render() {
  const svg = d3.select(svgRef.value);
  const g = svg.append('g').attr('class', 'viewport');

  // Zoom‑Behaviour
  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (ev) => g.attr('transform', ev.transform as any)),
  );

  // Force‑Simulation
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(60),
    )
    .force('charge', d3.forceManyBody().strength(-120))
    .force(
      'x',
      d3.forceX((d) => xScale(d.year)),
    )
    .force('y', d3.forceY(0).strength(0.05))
    .on('tick', ticked);
}
```

---

## 4 Interaktivität

| Feature            | Technische Umsetzung                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Zoom & Panning** | `d3.zoom()` → skaliert `g.viewport`; Werte im Store zur Wiederherstellung speichern                            |
| **Knoten‑Klick**   | `selection.on('click', (event, d) => emit('select', d.id))`; Vue zeigt Detail‑Pane                             |
| **Hover‑Tooltip**  | D3‑Tooltip‑Div oder `title`‑Element; throttle bei mobilen Geräten                                              |
| **Filter**         | State im Pinia‑Store; `watch(filters)` in `KiStammbaum.vue` → Daten erneut an D3 übergeben (enter/update/exit) |
| **Responsive**     | SVG `viewBox` + `preserveAspectRatio`; ResizeObserver löst `render()` aus                                      |

### Daten‑Updates in D3

- Nutze **Key‑Funktionen** (`.data(nodes, d => d.id)`) um sauberes Diffing zu gewährleisten.
- Bei Filterung: Simulation pausieren (`simulation.stop()`), Daten filtern, neue Nodes/Kanten binden, `simulation.restart()`.

---

## 5 Code‑Qualität & Kommentierung

- **TypeScript & ESLint (airbnb‑base)** erzwingen einheitliche Syntax.
- **Kommentartiefe:**

  - **Modul‑Header (JSDoc)** erklärt Zweck, Schnittstellen und Autor.
  - **Funktions‑JSDoc** mit `@param` / `@returns`.
  - **Inline‑Kommentare** nur für komplexe Algorithmen.

```ts
/**
 * Baut aus einer flachen Konzeptliste ein D3‑kompatibles Link‑/Node‑Objekt.
 * @param concepts Vorverarbeitete Konzepte aus JSON
 * @returns Objekt { nodes, links }
 */
export function transformToGraph(concepts: Concept[]): Graph {
  // 1 Nodes erstellen – jedes Konzept wird zum Knoten
  const nodes: Node[] = concepts.map((c) => ({ id: c.id, year: +c.year }));
  // 2 Links erstellen – Abhängigkeiten bilden gerichtete Kanten
  const links: Link[] = concepts.flatMap((c) =>
    c.dependsOn.map((dep) => ({ source: dep, target: c.id })),
  );
  return { nodes, links };
}
```

- **Testing:** Komponenten mit Vitest; D3‑Logik als reine TS‑Funktionen testbar.
- **Dokumentation:** Jede Komponente erhält eine Kurzbeschreibung im README der Komponente.

---

### Erweiterbarkeit

- **Neue Visualisierung:** Weitere Routen unter `pages/`; Daten‑Composable bleibt zentral.
- **Datenänderungen:** Schema‑Version in JSON; Transformations‑Funktionen prüfen Version.
- **Design‑System:** Zentrale Tailwind‑Konfig gewährleistet konsistente Farben und Abstände.

---

**Ende der Roadmap**
