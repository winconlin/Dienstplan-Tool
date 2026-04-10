import { state, saveState, createSnapshot } from './state.js';
import { getICSStartTime } from './calendar.js';
import { escapeICSText } from './utils.js';
import { t } from './i18n.js';
import { showToast } from './ui.js';
import { getValidationIssues } from './validation.js';

export function maybeBlockExport(exportType, label, monthValue) {
    if (!monthValue) return false;

    const blockingIssues = getValidationIssues(monthValue).filter((issue) => (issue.blocks || []).includes(exportType));
    if (!blockingIssues.length) return false;

    import('./main.js').then(({ renderValidation, showSection }) => {
        renderValidation();
        showSection("validation");
    });

    return !confirm(`${label}: ${blockingIssues.length} blockierende Punkte gefunden. Trotzdem exportieren?`);
}

export function exportAllICS(monthValue) {
    if (!monthValue) return;
    if (maybeBlockExport("ics", "ICS-Export", monthValue)) return;

    const monthEntries = Object.keys(state.plan).filter((dateKey) => dateKey.startsWith(monthValue)).sort();
    if (!monthEntries.length) {
        showToast(t('no_ics_data'), 'warning');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    let exportedFiles = 0;

    state.staff.forEach((person) => {
        const events = [];

        monthEntries.forEach((dateKey) => {
            [
                ["AA", t('role_aa')],
                ["VISITE", t('role_visite')],
                ["OA", t('role_oa')]
            ].forEach(([role, label]) => {
                if (state.plan[dateKey]?.[role] !== person.name) return;

                const startTime = getICSStartTime(dateKey, role);
                const uid = `${dateKey}-${role}-${person.name}`.replace(/[^a-zA-Z0-9-]/g, "-");
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
        showToast(t('no_ics_exportable'), 'warning');
    }
}

export function exportAtossCSV(monthValue) {
    if (!monthValue) return;
    if (maybeBlockExport("atoss", "Atoss-Export", monthValue)) return;

    const rows = [];
    Object.keys(state.plan).sort().forEach((dateKey) => {
        if (!dateKey.startsWith(monthValue)) return;
        [
            ["AA", 17],
            ["VISITE", 5],
            ["OA", 17]
        ].forEach(([role, hours]) => {
            const person = state.staff.find((entry) => entry.name === state.plan[dateKey]?.[role]);
            if (person?.id) rows.push(`${person.id};${dateKey};${hours}`);
        });
    });

    if (!rows.length) {
        showToast(t('no_csv_data'), 'warning');
        return;
    }

    const csv = ["Personalnummer;Datum;Stunden", ...rows].join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = "Atoss_Export.csv";
    anchor.click();
}

export function backupExport() {
    const payload = JSON.stringify(state);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    anchor.download = "MediPlan_Backup.json";
    anchor.click();
}

export async function cleanupOldData() {
    if (!confirm(t('alert_confirm_archive'))) return;
    backupExport();

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12);
    const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}`;
    const cutoffWeekKey = `${cutoffDate.getFullYear()}-KW${String(Math.ceil((cutoffDate.getTime() - new Date(cutoffDate.getFullYear(), 0, 1).getTime()) / 86400000 / 7)).padStart(2, "0")}`;

    Object.keys(state.plan).forEach(key => {
        if (key < cutoffKey) delete state.plan[key];
    });
    Object.keys(state.wishes).forEach(key => {
        if (key < cutoffKey) delete state.wishes[key];
    });
    Object.keys(state.stationPlan).forEach(key => {
        if (key.split("_")[0] < cutoffWeekKey) delete state.stationPlan[key];
    });

    await saveState();
    import('./main.js').then(({ renderCalendar, renderStationPlan }) => {
        renderCalendar();
        renderStationPlan();
    });
    showToast(t('toast_archive_success'), "success");
}

export async function backupImport(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
        try {
            const data = JSON.parse(loadEvent.target.result);
            state.staff = Array.isArray(data.staff) ? data.staff.filter(p => p && typeof p.name === "string") : [];
            state.plan = data.plan && typeof data.plan === "object" ? data.plan : {};
            state.wishes = data.wishes && typeof data.wishes === "object" ? data.wishes : {};
            state.stationPlan = data.stationPlan && typeof data.stationPlan === "object" ? data.stationPlan : {};
            state.holidaySeasonMode = Boolean(data.holidaySeasonMode);
            state.customStationLayout = data.customStationLayout || null;

            const checkbox = document.getElementById("holidaySeasonMode");
            if (checkbox) checkbox.checked = state.holidaySeasonMode;

            await saveState();
            import('./main.js').then(({ renderCalendar, renderStationPlan, renderStaff }) => {
                renderCalendar();
                renderStationPlan();
                renderStaff();
            });
            showToast(t('toast_backup_success'), "success");
        } catch {
            showToast(t('toast_backup_error'), "error");
        }
    };
    reader.readAsText(file);
}
