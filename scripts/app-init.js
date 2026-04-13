
import { showSection, removePerson, savePerson, toggleWish, loadPerson } from './management-ui.js';
import { clearMonth, clearWishes } from './planning-actions.js';
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

function bootstrap() {
    const monthPicker = document.getElementById("monthPicker");
    if (!monthPicker) return;

    monthPicker.value = getCurrentMonthValue();
    syncConfigControls();
    renderSnapshotInfo();

    renderPlanningViews();
    showSection("plan");
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


// Expose globals for HTML inline handlers
window.showSection = showSection;
window.savePlan = savePlan;
window.exportAllICS = exportAllICS;
window.backupExport = backupExport;
window.backupImport = backupImport;
window.exportAtossCSV = exportAtossCSV;
window.saveHolidaySeasonMode = saveHolidaySeasonMode;
window.saveAtossHours = saveAtossHours;
window.createUndoSnapshot = createUndoSnapshot;
window.restoreLatestSnapshot = restoreLatestSnapshot;
window.removePerson = removePerson;
window.savePerson = savePerson;
window.toggleWish = toggleWish;
window.runAutoPlaner = autoPlan;
window.autoStationPlan = autoStationPlan;
window.renderCalendar = renderCalendar;
window.renderStationPlan = renderStationPlan;
window.renderValidation = renderValidation;
window.clearMonth = clearMonth;
window.clearWishes = clearWishes;
window.saveStationPlan = saveStationPlan;
window.loadPerson = loadPerson;
