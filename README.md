# Dienstplantool

Dienstplantool ist eine rein im Browser lauffähige Webanwendung zur Erstellung, Verwaltung und Validierung von ärztlichen Dienstplänen.
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
  - Undo-Funktion durch Snapshot-Erstellung und Wiederherstellung (inkl. automatischem Auto-Save).
- **Export & Backup:**
  - Backup-Export und Import als JSON.
  - Export von Atoss-CSV-Dateien für die Zeiterfassung.
  - Generierung von ICS-Kalenderdateien für alle Mitarbeiter.

## Technische Basis

Das Projekt nutzt einen "Vanilla"-Ansatz (kein Framework) und besteht aus zwei Ebenen:

- **Quellcode (`scripts/`):** Modularisierte ES-Module (`core.js`, `storage.js`, `planning-engine.js`, `validation.js`, `export.js`, UI-Module …). Hier wird die gesamte Logik gepflegt. Die Testsuite (`tests.html`) lädt diese Module direkt.
- **Auslieferung (`Dienstplan.html`):** Eine **per Build erzeugte, in sich geschlossene HTML-Datei**. Der Build (`build.js`, esbuild + Tailwind) bündelt alle Module zu einem einzigen Inline-Skript und inlinet das CSS. Dadurch läuft die App ohne Server direkt über das `file://`-Protokoll – ohne CORS-/ES-Modul-Einschränkungen.

> **Wichtig:** `Dienstplan.html` ist ein **generiertes Artefakt**. Niemals direkt darin editieren – Änderungen immer im Quellcode (`scripts/`, `template.html`, CSS) machen und neu bauen. Andernfalls läuft die ausgelieferte App auf veraltetem Code.

Es wird keine serverseitige Logik (Node.js, PHP, etc.) oder externe Datenbank benötigt. Node.js wird ausschließlich für den Build und die Tests gebraucht.

## Ausführung / Start (Endnutzer)

Das Tool ist extrem leichtgewichtig und erfordert **keine Installation** und keinen Webserver.

- Einfach die Datei `Dienstplan.html` per Doppelklick in einem modernen Browser (Chrome, Firefox, Edge, Safari) öffnen.
- Alle Daten werden lokal im Browser gespeichert (IndexedDB, Fallback LocalStorage).

## Entwicklung

```bash
npm install        # Abhängigkeiten + aktiviert den Git-Hook (core.hooksPath)
npm run build      # Erzeugt Dienstplan.html aus den Quellen
npm run verify-build  # Baut neu und prüft, dass Dienstplan.html aktuell ist
```

Workflow: Quellcode in `scripts/`, `template.html` oder den CSS-Dateien ändern → `npm run build` → committen. Der mitgelieferte **pre-commit-Hook** (`.githooks/pre-commit`) baut bei build-relevanten Änderungen automatisch neu und nimmt `Dienstplan.html` in den Commit auf. Zusätzlich erzwingt die **GitHub-Actions-CI** (`.github/workflows/build-check.yml`), dass das committete Bundle exakt zu den Quellen passt – so kann kein veraltetes Bundle mehr nach `main` gelangen.

### Tests

`tests.html` enthält die Testsuite für die modulare Version (benötigt einen lokalen Webserver wegen ES-Modulen):

```bash
python3 -m http.server
# anschließend http://localhost:8000/tests.html im Browser öffnen
```

## Anpassung an andere Abteilungen

Aktuell sind einige fachliche Annahmen für die Kardiologie (MED I) fest im Code hinterlegt – z.B. das Stations-Layout (`defaultStationLayout` in `scripts/core.js`), die Rollen (`AA`/`VISITE`/`OA`), die Schichtzeiten (`getShiftWindow`) und die Atoss-Stunden. Für den Einsatz in anderen Abteilungen mit anderen Anforderungen ist eine Konfigurierbarkeit dieser Punkte vorgesehen (siehe `analysis.md`). Das Stations-Layout kann bereits heute zur Laufzeit im Reiter **System** angepasst werden.

## Projektstruktur

- `Dienstplan.html`: **Generiertes** Auslieferungs-Artefakt (Einstiegspunkt für Endnutzer).
- `template.html`: HTML-Grundgerüst, aus dem das Bundle gebaut wird.
- `build.js`: Build-Skript (esbuild-Bundling + Tailwind-CSS, Inlining).
- `scripts/`: ES-Module mit der gesamten Logik.
  - `app-init.js`: Bootstrapping & Event-Verdrahtung.
  - `state.js`: Zentrales App-State-Objekt.
  - `core.js`: Domänen-Konstanten und reine Hilfsfunktionen.
  - `storage.js`: Speicher- und Snapshot-Logik (IndexedDB).
  - `planning-engine.js`: Logik für den Autoplaner.
  - `validation.js`: Logik zur Konflikterkennung.
  - `export.js`: CSV- und ICS-Generierung.
  - `*-ui.js`: Rendering der einzelnen Ansichten.
- `styles.css` / `input.css` / `tailwind.config.js`: Styling-Quellen.
- `tests.html`: Testsuite für die modulare Version.
- `.githooks/pre-commit`, `.github/workflows/build-check.yml`: Schutz gegen veraltete Bundles.

## Historie

`Dienstplan.html` hieß ursprünglich produktintern „MediPlan“ bzw. „Meditool“; das Produkt heißt jetzt einheitlich **Dienstplantool**. Der interne IndexedDB-Name (`MediPlanDB`) bleibt aus Gründen der Datenkompatibilität bestehen, damit bereits gespeicherte Pläne erhalten bleiben.
