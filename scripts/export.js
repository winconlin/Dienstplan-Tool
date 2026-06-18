import { appState } from './state.js';
import { normalizeAtossId, isRoleActiveOnDateKey, getICSStartTime, getICSEnd, getAtossHourSegments, escapeICSText, withTemporaryState } from './core.js';
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
    reader.onload = async (loadEvent) => {
        try {
            const data = JSON.parse(loadEvent.target.result);
            const validation = validateBackupPayload(data);
            if (!validation.ok) throw new Error(validation.error);

            createUndoSnapshot(`Vor Backup-Import ${file.name}`);
            applyNormalizedAppState(validation.normalized);
            syncConfigControls();

            // Confirm success only after the imported data is durably persisted.
            const saveResult = await saveAndRenderAllDataViews();
            if (saveResult.ok) alert("Daten geladen!");
            else alert(`${saveResult.message} Der Import wurde angezeigt, aber nicht dauerhaft gespeichert.`);
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

// IANA timezone used for all ICS timestamps. Calendar clients (Apple/Google/
// Outlook) resolve TZID=Europe/Berlin including DST, avoiding floating times.
export const ICS_TIMEZONE = "Europe/Berlin";

// Triggers a browser download for a single in-memory file and frees the URL.
function triggerDownload(filename, content, mimeType) {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    // Revoke shortly after to keep the click alive but avoid leaking the URL.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Builds the per-person ICS payloads for the given month without touching DOM.
function buildICSFiles(monthValue) {
    const monthEntries = Object.keys(appState.plan).filter((dateKey) => dateKey.startsWith(monthValue)).sort();
    if (!monthEntries.length) return [];

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const files = [];

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
                const end = getICSEnd(dateKey, role);
                const uid = `${dateKey}-${role}-${person.name}`.replace(/\s+/g, "-");
                events.push([
                    "BEGIN:VEVENT",
                    `UID:${uid}@mediplan`,
                    `DTSTAMP:${timestamp}`,
                    `SUMMARY:${escapeICSText(label)}`,
                    `DTSTART;TZID=${ICS_TIMEZONE}:${dateKey.replace(/-/g, "")}T${startTime}`,
                    `DTEND;TZID=${ICS_TIMEZONE}:${end.dateKey.replace(/-/g, "")}T${end.time}`,
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

        files.push({ filename: `Dienst_${person.name}.ics`, content: lines.join("\r\n") });
    });

    return files;
}

// Batch-downloads one .ics file per doctor. Downloads run through an async
// queue with a small delay so browsers do not block/drop rapid-fire downloads.
export async function exportAllICS() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (maybeBlockExport("ics", "ICS-Export")) return;

    if (!Object.keys(appState.plan).some((dateKey) => dateKey.startsWith(monthValue))) {
        alert("Keine Dienste im gewaehlten Monat gefunden.");
        return;
    }

    const files = buildICSFiles(monthValue);
    if (!files.length) {
        alert("Fuer den gewaehlten Monat gibt es keine exportierbaren Dienste.");
        return;
    }

    for (let index = 0; index < files.length; index += 1) {
        triggerDownload(files[index].filename, files[index].content, "text/calendar");
        if (index < files.length - 1) await delay(300);
    }
}

// Atoss CSV layout is configured per clinic. This object centralizes the
// column order, separators, date format, decimal style and Lohnart mapping so
// the interface can be adapted without touching the generator logic.
export const atossExportConfig = {
    delimiter: ";",
    decimalSeparator: ",",
    // Field order of each output row. Supported keys: personalnummer, datum,
    // stunden, lohnart. Reorder/trim to match the target Atoss configuration.
    columns: ["personalnummer", "datum", "stunden", "lohnart"],
    columnLabels: {
        personalnummer: "Personalnummer",
        datum: "Datum",
        stunden: "Stunden",
        lohnart: "Lohnart"
    },
    // Date output format. Tokens: YYYY, MM, DD.
    dateFormat: "YYYY-MM-DD",
    // Lohnart per role; falls back to `default` for any unmapped role.
    lohnart: {
        default: "BD",
        VISITE: "VIS"
    }
};

function formatAtossDate(dateKey, config) {
    const [year, month, day] = dateKey.split("-");
    return config.dateFormat.replace("YYYY", year).replace("MM", month).replace("DD", day);
}

function formatAtossHours(hours, config) {
    return hours.toFixed(1).replace(".", config.decimalSeparator);
}

function getAtossLohnart(role, config) {
    return config.lohnart[role] || config.lohnart.default;
}

export function buildAtossExportRows(monthValue, source = {}, config = atossExportConfig) {
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

                const totalHours = getAtossHoursForDate(dateKey, role, appState.holidaySeasonMode, appState.atossHours);
                const lohnart = getAtossLohnart(role, config);
                // Split overnight shifts into one record per calendar day.
                getAtossHourSegments(dateKey, role, totalHours, appState.holidaySeasonMode).forEach((segment) => {
                    const values = {
                        personalnummer: normalizedId,
                        datum: formatAtossDate(segment.dateKey, config),
                        stunden: formatAtossHours(segment.hours, config),
                        lohnart
                    };
                    rows.push(config.columns.map((column) => values[column]).join(config.delimiter));
                });
            });
        });

        return rows;
    });
}

export function exportAtossCSV(config = atossExportConfig) {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (maybeBlockExport("atoss", "Atoss-Export")) return;

    const rows = buildAtossExportRows(monthValue, {}, config);
    if (!rows.length) {
        alert("Fuer den gewaehlten Monat gibt es keine exportierbaren Atoss-Daten.");
        return;
    }

    const header = config.columns.map((column) => config.columnLabels[column] || column).join(config.delimiter);
    const csv = [header, ...rows].join("\n");
    triggerDownload("Atoss_Export.csv", csv, "text/csv");
}
