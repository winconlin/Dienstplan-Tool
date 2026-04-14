
import { showSection, removePerson, savePerson, toggleWish, loadPerson } from './management-ui.js';
import { clearMonth, clearWishes, clearStationPlan } from './planning-actions.js';
import { exportAllICS, backupExport, backupImport, exportAtossCSV } from './export.js';
import { saveHolidaySeasonMode, saveAtossHours, createUndoSnapshot, restoreLatestSnapshot } from './storage.js';
import { renderCalendar, savePlan } from './calendar-ui.js';
import { renderStationPlan, saveStationPlan } from './station-ui.js';
import { renderValidation } from './validation.js';
import { autoPlan, autoStationPlan } from './planning-engine.js';

import { appState } from './state.js';
import { getPersonValidationError, getCurrentMonthValue, getEasterSunday, getHolidayName, getICSStartTime } from './core.js';
import { validateBackupPayload, getValidationIssues } from './validation.js';
import { persistAppStateToStorage, syncConfigControls, getAtossHoursForDate, renderSnapshotInfo } from './storage.js';
import { renderPlanningViews } from './ui-common.js';
import { getWeeksInMonth } from './planning-engine.js';
import { runAutoPlanSimulation, runAutoStationPlanSimulation, runCalendarRenderSimulation, runPlanEditSimulation, runStationPlanEditSimulation, runUndoRestoreSimulation, runStorageFailureSimulation } from './test-helpers.js';
import { buildAtossExportRows } from './export.js';

import { showToast } from './ui-common.js';

function checkBackupReminder() {
    try {
        const lastBackupRaw = localStorage.getItem("mp_last_backup_date");
        if (!lastBackupRaw) {
            showToast("Bitte erstelle regelmäßig Backups (System > Backup)!", "warning");
            return;
        }

        const lastBackupDate = new Date(lastBackupRaw);
        const daysSinceBackup = (new Date() - lastBackupDate) / (1000 * 60 * 60 * 24);

        if (daysSinceBackup > 7) {
            showToast(`Das letzte Backup ist ${Math.round(daysSinceBackup)} Tage alt. Bitte erstelle ein neues!`, "warning");
        }
    } catch(e) {}
}

function bootstrap() {
    const monthPicker = document.getElementById("monthPicker");
    if (!monthPicker) return;

    monthPicker.value = getCurrentMonthValue();
    syncConfigControls();
    renderSnapshotInfo();

    renderPlanningViews();
    showSection("plan");

    setTimeout(checkBackupReminder, 1000);
}

window.MediPlanTestApi = {
    getEasterSunday,
    getHolidayName,
    getWeeksInMonth,
    getICSStartTime,
    getAtossHoursForDate,
    getPersonValidationError,
    validateBackupPayload,
    getValidationIssues,
    buildAtossExportRows,
    persistAppStateToStorage,
    runAutoPlanSimulation,
    runAutoStationPlanSimulation,
    runCalendarRenderSimulation,
    runPlanEditSimulation,
    runStationPlanEditSimulation,
    runUndoRestoreSimulation,
    runStorageFailureSimulation
};

document.addEventListener("DOMContentLoaded", bootstrap);


export function setupEventListeners() {
    document.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.dataset.action;
        if (!action) return;

        if (action === "showSection") showSection(target.dataset.section);
        else if (action === "clearMonth") clearMonth();
        else if (action === "runAutoPlaner") autoPlan();
        else if (action === "autoStationPlan") autoStationPlan();
        else if (action === "clearStationPlan") clearStationPlan();
        else if (action === "renderValidation") renderValidation();
        else if (action === "clearWishes") clearWishes();
        else if (action === "savePerson") savePerson();
        else if (action === "backupExport") backupExport();
        else if (action === "exportAllICS") exportAllICS();
        else if (action === "exportAtossCSV") exportAtossCSV();
        else if (action === "restoreLatestSnapshot") restoreLatestSnapshot();
        else if (action === "printWindow") window.print();
        else if (action === "printStations") {
            document.body.classList.add('print-only-stations');
            window.print();
            document.body.classList.remove('print-only-stations');
        }
        else if (action === "loadPerson") loadPerson(Number(target.dataset.index));
        else if (action === "removePerson") {
            e.stopPropagation();
            removePerson(Number(target.dataset.index));
        }
        else if (action === "toggleWish") toggleWish(target.dataset.date, target.dataset.name);
    });

    document.addEventListener("change", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.dataset.action;
        if (!action) return;

        if (action === "saveStationPlan") {
            const value = target.hasAttribute('data-value') ? target.dataset.value : target.value;
            saveStationPlan(target.dataset.cell, value);
        }
        else if (action === "savePlan") savePlan(target.dataset.date, target.dataset.role, target.value);
        else if (action === "renderAll") {
            renderCalendar();
            renderStationPlan();
        } else if (action === "saveHolidaySeasonMode") {
            saveHolidaySeasonMode();
            renderCalendar();
            renderStationPlan();
        } else if (action === "saveAtossHours") {
            saveAtossHours();
        } else if (action === "backupImport") {
            backupImport(e);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
});


// Drag and Drop global handlers for Station Plan
window.handleDragStartStation = function(event, doctorName, sourceCell) {
    event.dataTransfer.setData("text/plain", JSON.stringify({ doctorName, sourceCell }));
    event.dataTransfer.effectAllowed = "move";
};

window.handleDropStation = function(event) {
    event.preventDefault();
    const cell = event.currentTarget;
    cell.classList.remove('bg-blue-50');

    const targetCellKey = cell.dataset.cell;
    const allowedRoles = (cell.dataset.allowed || "").split(",");

    try {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        const { doctorName, sourceCell } = data;

        if (!doctorName || targetCellKey === sourceCell) return;

        // Validation logic can be expanded here if needed before saving
        // For now, we trust the UI roles to guide the user, or let validation catch it later.

        if (sourceCell !== 'unassigned') {
            saveStationPlan(sourceCell, ""); // Remove from old cell
        }

        saveStationPlan(targetCellKey, doctorName);
    } catch (e) {
        console.error("Drop failed", e);
    }
};
