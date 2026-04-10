// Shared UI helpers for month selection and common refresh flows.

function getSelectedMonthValue() {
    return document.getElementById("monthPicker")?.value || "";
}

function renderPlanningViews() {
    renderCalendar();
    renderStationPlan();
}

function saveAndRenderPlanningViews(options = {}) {
    const saveResult = save(options);
    renderPlanningViews();
    return saveResult;
}

function saveAndRenderCalendarView(options = {}) {
    const saveResult = save(options);
    renderCalendar();
    return saveResult;
}

function saveAndRenderStationView(options = {}) {
    const saveResult = save(options);
    renderStationPlan();
    return saveResult;
}

function renderAllDataViews() {
    renderPlanningViews();
    renderStaff();
    renderValidation();
    renderSnapshotInfo();
}

function saveAndRenderAllDataViews(options = {}) {
    const saveResult = save(options);
    renderAllDataViews();
    return saveResult;
}
