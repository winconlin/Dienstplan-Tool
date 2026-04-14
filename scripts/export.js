import { appState } from './state.js';
import { normalizeAtossId, isRoleActiveOnDateKey, getICSStartTime, escapeICSText, withTemporaryState } from './core.js';
import { validateBackupPayload, getValidationIssues, renderValidation } from './validation.js';
import { syncConfigControls, getAtossHoursForDate, applyNormalizedAppState, createUndoSnapshot } from './storage.js';
import { getSelectedMonthValue, saveAndRenderAllDataViews } from './ui-common.js';
import { showSection } from './management-ui.js';

// Backup, ICS and Atoss export flows.

export function backupExport() {
    const payload = JSON.stringify({ staff: appState.staff, plan: appState.plan, wishes: appState.wishes, stationPlan: appState.stationPlan, holidaySeasonMode: appState.holidaySeasonMode, atossHours: appState.atossHours });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    anchor.download = "MediPlan_Backup.json";
    anchor.click();

    // Save last backup timestamp
    try {
        localStorage.setItem("mp_last_backup_date", new Date().toISOString());
    } catch(e) {}
}

export function backupImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const data = JSON.parse(loadEvent.target.result);
            const validation = validateBackupPayload(data);
            if (!validation.ok) throw new Error(validation.error);

            createUndoSnapshot(`Vor Backup-Import ${file.name}`);
            applyNormalizedAppState(validation.normalized);
            syncConfigControls();

            const saveResult = saveAndRenderAllDataViews();
            if (saveResult.ok) alert("Daten geladen!");
        } catch (error) {
            alert(error?.message || "Backup konnte nicht gelesen werden.");
        } finally {
            event.target.value = "";
        }
    };
    reader.readAsText(file);
}

export function maybeBlockExport(exportType, label) {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return false;

    const blockingIssues = getValidationIssues(monthValue).filter((issue) => (issue.blocks || []).includes(exportType));
    if (!blockingIssues.length) return false;

    renderValidation();
    showSection("validation");
    return !confirm(`${label}: ${blockingIssues.length} blockierende Punkte gefunden. Trotzdem exportieren?`);
}

export function exportAllICS() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (maybeBlockExport("ics", "ICS-Export")) return;

    const monthEntries = Object.keys(appState.plan).filter((dateKey) => dateKey.startsWith(monthValue)).sort();
    if (!monthEntries.length) {
        alert("Keine Dienste im gewaehlten Monat gefunden.");
        return;
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    let exportedFiles = 0;

    appState.staff.forEach((person) => {
        const events = [];

        monthEntries.forEach((dateKey) => {
            [
                ["AA", "24h Dienst"],
                ["VISITE", "Visite"],
                ["OA", "Hintergrund"]
            ].forEach(([role, label]) => {
                if (!isRoleActiveOnDateKey(role, dateKey)) return;
                if (appState.plan[dateKey]?.[role] !== person.name) return;

                const startTime = getICSStartTime(dateKey, role);
                const uid = `${dateKey}-${role}-${person.name}`.replace(/\s+/g, "-");
                events.push([
                    "BEGIN:VEVENT",
                    `UID:${uid}@mediplan`,
                    `DTSTAMP:${timestamp}`,
                    `SUMMARY:${escapeICSText(label)}`,
                    `DTSTART:${dateKey.replace(/-/g, "")}T${startTime}`,
                    `DTEND:${dateKey.replace(/-/g, "")}T235900`,
                    "END:VEVENT"
                ].join("\r\n"));
            });
        });

        if (!events.length) return;

        const lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//MediPlan Pro//Dienstplan//DE",
            ...events,
            "END:VCALENDAR"
        ];

        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
        anchor.download = `Dienst_${person.name}.ics`;
        anchor.click();
        exportedFiles += 1;
    });

    if (!exportedFiles) {
        alert("Fuer den gewaehlten Monat gibt es keine exportierbaren Dienste.");
    }
}

export function buildAtossExportRows(monthValue, source = {}) {
    return withTemporaryState(source, () => {
        if (!monthValue) return [];

        const rows = [];
        Object.keys(appState.plan).sort().forEach((dateKey) => {
            if (!dateKey.startsWith(monthValue)) return;
            ["AA", "VISITE", "OA"].forEach((role) => {
                if (!isRoleActiveOnDateKey(role, dateKey)) return;
                const person = appState.staff.find((entry) => entry.name === appState.plan[dateKey]?.[role]);
                const normalizedId = normalizeAtossId(person?.id);
                if (!normalizedId) return;

                const hours = getAtossHoursForDate(dateKey, role, appState.holidaySeasonMode, appState.atossHours);
                rows.push(`${normalizedId};${dateKey};${hours}`);
            });
        });

        return rows;
    });
}

export function exportAtossCSV() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (maybeBlockExport("atoss", "Atoss-Export")) return;

    const rows = buildAtossExportRows(monthValue);
    if (!rows.length) {
        alert("Fuer den gewaehlten Monat gibt es keine exportierbaren Atoss-Daten.");
        return;
    }

    const csv = ["Personalnummer;Datum;Stunden", ...rows].join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = "Atoss_Export.csv";
    anchor.click();
}
