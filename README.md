# MediPlan - Dienstplan-Tool

MediPlan ist eine rein im Browser lauffähige Webanwendung zur Erstellung, Verwaltung und Validierung von ärztlichen Dienstplänen.
Das Tool verzichtet komplett auf ein serverseitiges Backend und speichert alle Daten lokal im Browser, wodurch es sofort, unabhängig und datenschutzfreundlich einsetzbar ist.

## Kernfunktionen

- **Dienstplanung:**
  - Manuelle Planung als führendes System.
  - **Autoplaner:** Ergänzt freie Lücken intelligent um bereits eingetragene Dienste, Wünsche und Urlaub herum.
  - Verwaltung von 24h-Diensten, Visiten und Hintergrunddiensten.
- **Stationsbesetzung:**
  - Verknüpfung von Dienst- und Stationsplänen.
  - Übersichtliche Matrix für verschiedene Stationen und ärztliche Funktionen (EPU, HKL, Echo, etc.).
- **Validierung & Konflikterkennung:**
  - Automatische Prüfung auf Doppelbelegungen, unbesetzte Dienste und Überschneidungen mit Urlaub/Zeitausgleich.
  - Erkennung von exportrelevanten Datenlücken (z.B. fehlende Atoss-IDs).
- **Personal- & Systemverwaltung:**
  - Mitarbeiterverwaltung (Rollen, Stellenprozente, Atoss-IDs).
  - Verwaltung von Urlauben, Wunschfrei-Zeiten und Sperren.
  - Undo-Funktion durch Snapshot-Erstellung und Wiederherstellung.
- **Export & Backup:**
  - Backup-Export und Import als JSON.
  - Export von Atoss-CSV-Dateien für die Zeiterfassung.
  - Generierung von ICS-Kalenderdateien für alle Mitarbeiter.

## Technische Basis

Das Projekt ist mit einem modernen "Vanilla"-Ansatz umgesetzt. Um Konflikte mit Browser-Restriktionen für ES-Module über das `file://` Protokoll zu umgehen, gibt es eine Zweiteilung:

- **Produktiv-Version (`index.html` & `app.js`):** Die gesamte Logik ist in einer einzigen monolithischen Datei (`app.js`) gebündelt. Diese nutzt `LocalStorage` für die Datenhaltung. Dadurch gibt es keine CORS/Modul-Einschränkungen.
- **Entwicklungs-Version (`scripts/`):** Der Quellcode ist modularisiert in ES-Module (z.B. `core.js`, `storage.js`) aufgeteilt und nutzt teilweise `IndexedDB`. Dies wird hauptsächlich für die Testsuite (`tests.html`) verwendet.
- **Styling:** Tailwind CSS (via CDN) und `styles.css`.

Es wird keine serverseitige Logik (Node.js, PHP, etc.) oder externe Datenbank benötigt.

## Ausführung / Start

Das Tool ist extrem leichtgewichtig und erfordert **keine Installation** oder einen Webserver.

- Einfach die Datei `index.html` per Doppelklick in einem beliebigen modernen Browser (Chrome, Firefox, Edge, Safari) öffnen.
- Die Anwendung läuft dank der gebündelten `app.js` direkt und fehlerfrei lokal über das `file://` Protokoll.

## Projektstruktur

- `index.html`: Haupt-Einstiegspunkt für den Endnutzer (lädt die gebündelte `app.js`).
- `app.js`: Monolithische JavaScript-Datei für die direkte Ausführung im Browser ohne Server.
- `scripts/`: Ordner mit den aufgeteilten ES-Modulen für Entwicklung und Tests.
  - `app-init.js`: Bootstrapping.
  - `state.js`: Zentrales App-State Objekt.
  - `storage.js`: Speicher- und Snapshot-Logik.
  - `planning-engine.js`: Logik für den Autoplaner.
  - `validation.js`: Logik zur Konflikterkennung.
  - `export.js`: CSV- und ICS-Generierung.
- `styles.css`: Zusätzliche Custom-Styles.
- `tests.html`: Testsuite für die modulare Version des Projekts (benötigt einen lokalen Webserver, z.B. `python3 -m http.server`).

## Historie

`Dienstplan.html` und `legacy_monolith.html` sind Altstände/Referenzen, die vor der Modularisierung in ES-Modules existierten. Sie sind nicht mehr die maßgebliche Logikquelle.
