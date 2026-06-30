# Dienstplantool – Repository-Analyse

Stand der Analyse: Bewertung des aktuellen Codes (`scripts/`, `template.html`, `build.js`)
nach Behebung des Autoplaner-Hangs und der Umbenennung auf **Dienstplantool**.

## 10 aktuelle Probleme (nach Relevanz)

1. **Fachlogik fest auf die Kardiologie (MED I) verdrahtet (Kritisch für Mehr-Abteilungs-Einsatz):**
   Rollen (`AA`/`VISITE`/`OA`, dazu `OA-EPU`/`FOA`/`FOA-EPU` in `matchesRole`), das Stations-Layout
   (`defaultStationLayout` in `core.js`), die Schichtzeiten (`getShiftWindow`) und die Atoss-Stunden
   sind hart im Code hinterlegt. Eine andere Abteilung mit anderen Funktionen/Diensten kann das Tool
   ohne Code-Änderung nicht sinnvoll nutzen.

2. **Region-spezifischer, fest verdrahteter Feiertagskalender:**
   `getHolidayName` kodiert bayerische Feiertage (Mariä Himmelfahrt, Fronleichnam, Hl. 3 Könige …)
   fest. Für andere Bundesländer/Länder ist das falsch und nicht umschaltbar.

3. **Generiertes Bundle als Auslieferungsdatei im Git (Wartungsrisiko):**
   `Dienstplan.html` (~80 KB) ist ein Build-Artefakt, wird aber versioniert. Genau das war die Ursache
   des „Wird berechnet…"-Hangs: Die Quelle war gefixt, das committete Bundle aber veraltet. Jetzt durch
   CI/Hook abgesichert, die strukturelle Kopplung (Artefakt im Repo) bleibt aber bestehen.

4. **Keine automatisierte Testausführung in der CI:**
   `tests.html` ist nur im Browser lauffähig; `run_tests.py`/`test_ui.py` sind nicht in eine Pipeline
   eingebunden. Regressionen in der Planungs-/Validierungslogik werden nicht automatisch erkannt.

5. **IndexedDB-Ladevorgang mit Race-/Überschreib-Risiko:**
   In `storage.js` (unten) wird zuerst synchron aus LocalStorage initialisiert und gerendert, danach
   asynchron aus IndexedDB überschrieben und erneut gerendert. Bei laufenden Eingaben kann der späte
   IDB-Block frische Änderungen überschreiben; Fehler werden mit `.catch(console.error)` praktisch
   verschluckt; der Nutzer sieht kurz veraltete Daten („flash of stale state").

6. **XSS-Risiko durch `innerHTML`-Stringbau mit Nutzereingaben:**
   Tabellen/Listen werden in den `*-ui.js`-Modulen via `innerHTML` aus Strings zusammengesetzt, in die
   Arzt- und Stationsnamen einfließen. Sobald ein Name HTML-Sonderzeichen enthält, droht Injection.
   Escaping erfolgt nur punktuell, nicht systematisch.

7. **Globaler, überall mutierter State:**
   `appState` wird aus nahezu jeder Funktion heraus direkt mutiert. Undo basiert auf groben
   Voll-Snapshots statt auf nachvollziehbaren Aktionen – fehleranfällig und schlecht skalierbar.

8. **Autoplaner blockiert den Main-Thread:**
   Die Berechnung läuft in einem `setTimeout`-Callback auf dem Main-Thread (kein Web Worker). Der
   Spinner wird zwar korrekt ein-/ausgeblendet, bei vielen Ärzten/Stationen friert die UI während der
   Berechnung aber ein. Die zyklomatische Komplexität von `fillPlanMonth` ist hoch.

9. **Hohe Schreib-/Snapshot-Frequenz:**
   Auto-Save erzeugt alle 15 Minuten und bei `beforeunload` einen kompletten Snapshot; jeder Speichervorgang
   serialisiert den gesamten State als JSON. Bei großen Plänen/Historien ist das unnötig teuer und
   begünstigt das Erreichen der Speicherquote.

10. **Keine Schema-Versionierung für Backups/Storage:**
    Backups (`backupExport`) und der persistierte State tragen keine Versionsnummer. Ändert sich die
    Datenstruktur, gibt es keinen sauberen Migrationspfad – alte Backups können stillschweigend abgelehnt
    oder fehlinterpretiert werden.

---

## 10 Verbesserungsvorschläge (Browser-only-konform)

Da das Tool zwingend ohne Server im Browser laufen muss, sind alle Vorschläge mit einem optionalen
Node-Build (für die Auslieferung) und reinem Vanilla-JS umsetzbar.

1. **Abteilungs-Profile / Mandantenfähigkeit (Kern für andere Abteilungen):**
   Sämtliche fachlichen Annahmen (Rollen, Rollen-Matching, Stations-Layout, Schichtzeiten, Atoss-Stunden,
   Feiertagsregion) in **ein zentrales Konfigurationsobjekt** auslagern, das pro Abteilung als JSON
   geladen/gespeichert wird. Im Reiter „System" ein Profil-Umschalter. So lässt sich das Tool ohne
   Code-Änderung auf andere Abteilungen anpassen.

2. **Konfigurierbare Rollen & Matching-Regeln:**
   `matchesRole`, `planRoles` und `roleLabels` datengetrieben aus dem Profil speisen, statt Rollennamen
   hart zu kodieren. Abteilungen ohne EPU/HKL o.ä. funktionieren dann automatisch.

3. **Region-wählbarer Feiertagskalender:**
   Feiertage aus einer datengetriebenen Definition pro Bundesland/Land berechnen (Auswahl im Profil),
   die bewegliche Feiertage über die bereits vorhandene Osterberechnung ableitet.

4. **Konfigurierbare Schicht- & Atoss-Zeiten:**
   `getShiftWindow` und die Atoss-Stunden vollständig aus dem Profil beziehen, inkl. Mitternachts-Split,
   damit andere Dienstmodelle (z.B. Schichtdienst statt 24h) abbildbar sind.

5. **Autoplaner in einen Web Worker auslagern:**
   Die Berechnung in `worker.js` verschieben; die UI zeigt währenddessen den vorhandenen Spinner und
   bleibt responsiv. Beseitigt das UI-Einfrieren bei großen Datenmengen.

6. **Tests in die CI integrieren (Regressionsschutz):**
   Die `tests.html`-Suite headless (Playwright/Puppeteer) in GitHub Actions ausführen und einen
   Smoke-Test ergänzen, der den Autoplaner startet und prüft, dass das Lade-Overlay wieder verschwindet –
   als dauerhafter Schutz gegen den behobenen Hang.

7. **Zentrales, sicheres Rendering:**
   `innerHTML`-Stringbau durch `textContent`/`createElement`-Helfer oder ein winziges, build-freies
   Template-Helferlein ersetzen und Nutzereingaben konsequent escapen (XSS-Schutz).

8. **State-Zugriff kapseln:**
   Mutationen von `appState` hinter klar benannte Aktionen/Setter legen. Das macht Undo/Redo robust,
   ermöglicht gezielte Re-Renders und reduziert Folgefehler.

9. **Speicher-Schreibvorgänge entkoppeln & schonen:**
   Speichern debouncen, Snapshots nur bei tatsächlicher Änderung erzeugen und ggf. Deltas statt
   Voll-Snapshots ablegen. Reduziert Quota-Druck und CPU-Last.

10. **Backup-/Storage-Versionierung + Migrationen + PWA:**
    Jedem Backup/State eine `schemaVersion` geben und einen Migrations-Layer beim Import/Laden ergänzen.
    Ergänzend `manifest.json` + Service Worker, damit das Tool offline auf Tablets „installiert" werden
    kann und Updates kontrolliert ausgerollt werden.
