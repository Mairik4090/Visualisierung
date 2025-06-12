# Timeline.vue

Visualisiert einen Zeitstrahl von ersten bis letzten Jahr der Daten.
Balken zeigen an, wie viele Konzepte in einem Jahr existieren. Durch Ziehen
und Scrollen kann entlang der x-Achse gezoomt und navigiert werden.
Der sichtbare Jahresbereich wird als `rangeChanged`-Event ausgegeben und kann
zum Filtern der Stammbaum-Visualisierung genutzt werden.
Bei Klick auf einen Balken wird ein `yearSelected`-Event mit dem entsprechenden
Jahr ausgelöst.
