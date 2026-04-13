# MediPlan - Dienstplan-Tool

MediPlan ist eine rein im Browser lauffähige Webanwendung zur Erstellung, Verwaltung und Validierung von ärztlichen Dienstplänen.
Das Tool verzichtet komplett auf ein serverseitiges Backend und speichert alle Daten lokal im Browser (IndexedDB), wodurch es sofort, unabhängig und datenschutzfreundlich einsetzbar ist.

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

Das Projekt ist mit einem modernen "Vanilla"-Ansatz umgesetzt:
- **HTML5 & Vanilla JavaScript (ES Modules):** Modularer Code, aufgeteilt in logische Einheiten (z.B. `core.js`, `storage.js`, `planning-engine.js`, `validation.js`).
- **Styling:** Tailwind CSS (via CDN).
- **Datenhaltung:** IndexedDB (zur Persistenz zwischen Sitzungen), initialisiert in `scripts/storage.js`.

Es wird keine serverseitige Logik (Node.js, PHP, etc.) oder externe Datenbank benötigt.

## Lokale Ausführung / Entwicklung

Da moderne Browser bei `file://` Aufrufen oft Restriktionen für ES-Modules (CORS) und IndexedDB haben, sollte das Tool über einen lokalen Webserver aufgerufen werden.

1. Terminal im Hauptverzeichnis des Projekts öffnen.
2. Lokalen Server starten (z.B. mit Python):
   ```bash
   python3 -m http.server 8000
   ```
3. Im Browser öffnen:
   `http://localhost:8000/index.html`

## Projektstruktur

- `index.html`: Einstiegspunkt der Anwendung (inkl. grundlegendem UI-Skelett).
- `scripts/`: Ordner mit allen JavaScript-Modulen.
  - `app-init.js`: Bootstrapping und Exponieren von Funktionen für Inline-Event-Handler.
  - `state.js`: Zentrales App-State Objekt (`appState`).
  - `storage.js`: IndexedDB Persistenz und Snapshots.
  - `planning-engine.js`: Logik für den Autoplaner.
  - `validation.js`: Logik zur Konflikterkennung.
  - `export.js`: CSV- und ICS-Generierung.
- `styles.css`: Zusätzliche Custom-Styles.
- `tests.html`: Testsuite für das Projekt.

## Historie

`Dienstplan.html` und `legacy_monolith.html` sind Altstände/Referenzen, die vor der Modularisierung in ES-Modules existierten. Sie sind nicht mehr die maßgebliche Logikquelle.
