# MediPlan Repository Analyse

## 10 Aktuelle Probleme (nach Schweregrad)

1. **Performance-Risiko im Autoplaner (Kritisch):** Auch nach den Optimierungen (WeekKey Cache) hat die `runAutoPlaner` Funktion eine sehr hohe Zyklomatische Komplexität. Wenn die Anzahl der Ärzte, Stationen oder Tage steigt, kann die UI blockieren. Ein Web Worker für die Berechnung wäre sicherer.
2. **God-Object Architektur (Hoch):** Die gesamte Logik (UI, State-Management, Kalender-Algorithmen, Backup, Export) liegt in einer einzigen riesigen Datei `app.js` (über 1200 Zeilen). Das erschwert die Wartung massiv.
3. **XSS Risiko bei manuellen Eingaben (Hoch):** Arztnamen werden zwar an einigen Stellen escaped, aber wenn Nutzer in Zukunft auch Stationen oder Wünsche per Textfeld benennen können, droht XSS durch ungefilterte `innerHTML` Injections, da HTML komplett in Strings zusammengebaut wird.
4. **Kein State-Management Pattern (Mittel):** Der globale State (`staff`, `plan`, `stationPlan`, etc.) wird von jeder Funktion wild mutiert. Das macht Features wie "Undo/Redo" sehr fehleranfällig und schwer zu skalieren.
5. **Datenmigration bei Updates (Mittel):** Wenn sich die Struktur des JSON-Backups ändert (wie jetzt bei der `history` Property für Ärzte), gibt es keine sauberen Migrations-Pfade in `backupImport` oder beim Laden aus dem `localStorage`. Alte Backups könnten unerwartetes Verhalten auslösen.
6. **Statische `index.html` UI (Mittel):** Wenn viele Stationen oder Ärzte existieren, ist die Tabelle auf mobilen Endgeräten nahezu unlesbar. Eine responsive Ansicht fehlt weitestgehend.
7. **Ungenaue Validierung (Niedrig):** Die `getValidationIssues` Logik deckt zwar Lücken auf, könnte aber intelligenter prüfen, ob z.B. jemand Dienst hat, obwohl er explizit den Tag als "Wunsch" (Sperre) markiert hat.
8. **Fehlende i18n (Niedrig):** Hardcodierte deutsche Strings überall im Code machen es unmöglich, das Tool in Zukunft z.B. für englischsprachige Kliniken anzubieten.
9. **Inline-Eventhandler im HTML (Niedrig):** `onclick="..."` im HTML verstößt gegen moderne Security-Best-Practices (CSP) und erschwert das Debuggen. Event-Listener sollten im JavaScript via `addEventListener` gebunden werden.
10. **Testabdeckung (Niedrig):** Die `tests.html` deckt nur einen minimalen Bruchteil der Geschäftslogik ab (vor allem Kalender-Sonderfälle). Wichtige UI- und Rendering-Funktionen sind komplett ungetestet.

---

## 10 Verbesserungsvorschläge (Browser-Only konform)

Da das Tool zwingend ohne Build-Schritt, Node.js oder Web-Server direkt im Browser laufen muss, hier realistische Verbesserungen:

1. **Modulare JavaScript-Dateien via ES-Modules:** Auch ohne Build-Tool kann man `<script type="module">` nutzen, um die `app.js` in logische Blöcke zu splitten (z.B. `ui.js`, `state.js`, `autoplaner.js`, `export.js`).
2. **Web Worker für den Autoplaner:** Die Berechnung des Dienstplans kann in eine separate Worker-Datei (`worker.js`) ausgelagert werden. Die UI zeigt währenddessen einen sauberen Loading-Spinner und friert nicht ein.
3. **PWA (Progressive Web App):** Durch Hinzufügen einer simplen `manifest.json` und eines Service Workers kann die App auf Tablets und Smartphones "installiert" (auf den Homescreen gelegt) werden und lädt offline noch zuverlässiger.
4. **Verwendung einer Lightweight-Library:** Anstatt HTML-Strings mit Vanilla JS zusammenzubauen, könnte eine extrem kleine, build-freie Library wie [Preact (via htm)](https://preactjs.com/guide/v10/getting-started#alternatives-to-jsx) oder [Alpine.js](https://alpinejs.dev/) über CDN eingebunden werden.
5. **Erweiterte Validierungs-Ansicht:** Die Validierung sollte nicht nur ein separater Tab sein, sondern kritische Konflikte (wie "Arzt A hat am Tag X Dienst, aber auch Urlaub") direkt im Kalender rot hinterlegen, bevor man überhaupt exportiert.
6. **IndexedDB statt LocalStorage:** `localStorage` blockiert den Main-Thread und hat ein 5MB Limit. Ein Wechsel auf IndexedDB (z.B. mit dem leichten Wrapper `idb-keyval`) macht das Speichern performanter und erlaubt riesige Historien.
7. **Visueller Layout-Editor für Stationen:** Ein kleines Interface im "System"-Reiter, mit dem man die Stationen (wie "HKL", "CPU") selbst per Drag & Drop sortieren, umbenennen oder ausblenden kann, ohne den Code anzufassen. Die Konfiguration wird im Storage gespeichert.
8. **Dunkelmodus (Dark Mode):** Da Tailwind bereits verwendet wird, lässt sich ein Dark-Mode Schalter extrem einfach einbauen, was für Ärzte, die Nachts am Plan arbeiten, sehr augenschonend ist.
9. **Bessere Druck-Styles:** Die Druckansicht (`styles.css`) ist funktional, aber Seitenumbrüche (Page-Breaks) könnten intelligenter gesetzt werden, damit Tabellen (z.B. Stationsbesetzung) nicht mitten in einer Zeile zerrissen werden (`page-break-inside: avoid`).
10. **Lokales Auto-Save & Versionsverlauf:** Statt nur beim manuellen Klicken eines Buttons ein Backup herunterzuladen, könnte das Tool bei jedem Verlassen der Seite (via `beforeunload` event) den letzten Stand in einen Ring-Puffer (`IndexedDB`) schreiben. So kann man auch nach einem Browser-Crash den Plan von gestern wiederherstellen.
