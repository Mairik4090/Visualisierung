# Agends – KI‑Stammbaum: Eine interaktive Reise durch die Evolution der künstlichen Intelligenz

## Ausgangssituation

Ich entwickle ein Visualisierungsmodul für meine Hochschule zum Thema **'KI‑Stammbaum: Eine interaktive Reise durch die Evolution der künstlichen Intelligenz'**.
Die Daten (Liste von KI-Konzepten mit Entstehungsjahren und Abhängigkeiten) liegen als vorverarbeitetes JSON vor (siehe Struktur in Prompt 1).
Die Implementierung erfolgt in einer Nuxt-basierten Entwicklungsumgebung und soll eine komponentenbasierte Multi‑Page Vue-Anwendung sein. Interaktive Grafiken mit D3.js sind Kernbestandteil. Der Quellcode muss ausführlich kommentiert werden.

## Ziel

Erstelle eine detaillierte **technische Roadmap und grundlegende Code‑Struktur** für das Frontend‑Projekt. Zeige auf, wie die JSON‑Daten geladen und verarbeitet werden können, und schlage konkrete Vue‑Komponenten und D3.js‑Visualisierungsmuster vor.

## Aufgabenbereiche und Erwartungen

### 1. Projektstruktur (Nuxt)

- Schlage eine sinnvolle Verzeichnisstruktur für das Nuxt‑Projekt vor, die eine komponentenbasierte Multi‑Page Vue‑Anwendung unterstützt.
- Erkläre, wo die JSON‑Daten am besten abgelegt und wie sie initial geladen werden sollten (z. B. `static/data.json`).

### 2. Vue‑Komponenten‑Architektur

- Definiere die Kern‑Vue‑Komponenten, die für die Visualisierung und Interaktion benötigt werden (z. B. `KiStammbaum.vue` für die Hauptvisualisierung, `ConceptDetail.vue` für Detailansichten, `FilterControls.vue` für Interaktionen).
- Zeige exemplarisch die grundlegende Struktur (Template, Script, Style) einer zentralen Komponente auf.

### 3. D3.js‑Integration und Visualisierungsideen

- Erläutere, wie D3.js am besten in Vue‑Komponenten integriert wird, um Reaktivität zu gewährleisten (z. B. mittels `watch` oder `computed` Properties für Datenänderungen).
- Schlage **zwei konkrete D3.js‑Visualisierungstypen** vor, die für den „KI‑Stammbaum“ geeignet sind und das Potenzial für Interaktivität bieten (z. B. Force‑Directed Graph, Zeitstrahl‑Netzwerk). Erkläre jeweils kurz, wie die JSON‑Daten dafür transformiert werden müssten.
- Gib einen rudimentären Code‑Snippet für die Initialisierung einer D3.js‑Visualisierung innerhalb einer Vue‑Komponente.

### 4. Interaktivität

- Beschreibe, wie grundlegende Interaktionen wie Zoomen, Panning, Klicken auf Knoten (um Details anzuzeigen) und Filtern umgesetzt werden können.
- Zeige, wie Datenänderungen in D3.js bei Filteraktionen oder Detailansichten aktualisiert werden.

### 5. Code‑Qualität & Kommentierung

- Betone die Wichtigkeit von sauberem Code und Kommentaren.
- Gib exemplarisch an, wie Code‑Kommentare aussehen sollten.

## Wichtige Hinweise

- Der Fokus liegt auf dem **Architektur‑Vorschlag und konzeptionellen Code‑Strukturen**, keine vollständige Implementierung.
- Berücksichtige die **Offline‑Lauffähigkeit** nach Datenbereitstellung.
- Schlage eine Lösung vor, die **gut erweiterbar** ist, falls später weitere Visualisierungen oder Datenpunkte hinzukommen sollen.
