# Timeline.vue

Visualisiert einen Zeitstrahl von ersten bis letzten Jahr der Daten.  
Balken zeigen an, wie viele Konzepte in einem Jahr existieren. Durch Ziehen  
und Scrollen kann entlang der x-Achse gezoomt und navigiert werden.  
Der sichtbare Jahresbereich wird als `rangeChanged`-Event ausgegeben und kann  
zum Filtern der Stammbaum-Visualisierung genutzt werden.

Abhängig vom aktuellen Zoomfaktor werden die Werte vor dem Rendern in  
verschiedene Zeitabschnitte gruppiert:

- **Zoom < 1.5:** Jahrzehnte  
- **1.5 ≤ Zoom < 3:** Fünf-Jahres-Intervalle  
- **Zoom ≥ 3:** Einzelne Jahre  

Bei Klick auf einen Balken wird zusätzlich ein `yearSelected`-Event mit dem  
jeweiligen Jahr ausgelöst.  

Bei jeder Zoom-Interaktion wird die neue Skalierung gespeichert und die  
Balkendarstellung entsprechend neu berechnet.
