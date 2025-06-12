# KI-Stammbaum

Diese Nuxt-3-Anwendung visualisiert die Entwicklung der künstlichen Intelligenz. 
Die Daten liegen als JSON im Ordner `public/data` und werden offline geladen. 
D3.js erzeugt daraus einen interaktiven Graphen.

## Setup

Abhängigkeiten werden mit pnpm installiert:

```bash
pnpm install
```

## Entwicklungsserver

Starten Sie den lokalen Server unter `http://localhost:3000`:

```bash
pnpm dev
```

## Build

Ein Produktionsbuild lässt sich wie folgt erzeugen und testen:

```bash
pnpm build
pnpm preview
```

Weitere Hinweise zur Bereitstellung finden Sie in der [Nuxt-Dokumentation](https://nuxt.com/docs/getting-started/deployment).

## Navigation & Darstellung

Das Menü im Kopfbereich wird in `layouts/default.vue` über `NuxtLink`-Elemente aufgebaut und verlinkt automatisch auf die Seiten unter `pages/`.
In der Visualisierung erscheinen die Knotennamen zusammen mit ihrem Jahr; die horizontale Position basiert auf der Jahreszahl.
