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
