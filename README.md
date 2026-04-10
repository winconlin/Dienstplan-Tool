# Dienstplan-Tool
`index.html` ist der aktuelle Einstiegspunkt mit ausgelagerter Logik in `scripts/core.js`, `scripts/validation.js`, `scripts/storage.js`, `scripts/ui-common.js`, `scripts/planning-actions.js`, `scripts/planning-engine.js`, `scripts/test-helpers.js`, `scripts/station-ui.js`, `scripts/calendar-ui.js`, `scripts/management-ui.js`, `scripts/export.js` und `scripts/app-init.js` sowie Styles in `styles.css`.
Der aktive Planungsmodus ist: manuelle Vorplanung bleibt fuehrend, der Autoplaner ergaenzt nur freie Luecken um bereits eingetragene Dienste, Wuensche und Urlaub herum.
`Dienstplan.html` und `legacy_monolith.html` bleiben nur als Altstand/Referenz erhalten und sind nicht mehr die massgebliche Logikquelle.
Ein kleines Tool zur Erstellung von Aerztedienstplaenen mit Stationsbesetzung.
