import { renderValidation } from './validation.js';
import { save, renderSnapshotInfo } from './storage.js';
import { renderStationPlan } from './station-ui.js';
import { renderCalendar } from './calendar-ui.js';
import { renderStaff } from './management-ui.js';

// Shared UI helpers for month selection and common refresh flows.

export function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    const colors = { info: "bg-blue-600", success: "bg-green-600", warning: "bg-orange-500", error: "bg-red-600" };
    toast.className = `${colors[type]} text-white px-4 py-2 rounded shadow-lg text-sm transition-opacity duration-300 opacity-0`;
    toast.innerText = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove("opacity-0"));
    setTimeout(() => {
        toast.classList.add("opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function getSelectedMonthValue() {
    return document.getElementById("monthPicker")?.value || "";
}

export function renderPlanningViews() {
    renderCalendar();
    renderStationPlan();
}

export function saveAndRenderPlanningViews(options = {}) {
    const saveResult = save(options);
    renderPlanningViews();
    return saveResult;
}

export function saveAndRenderCalendarView(options = {}) {
    const saveResult = save(options);
    renderCalendar();
    return saveResult;
}

export function saveAndRenderStationView(options = {}) {
    const saveResult = save(options);
    renderStationPlan();
    return saveResult;
}

export function renderAllDataViews() {
    renderPlanningViews();
    renderStaff();
    renderValidation();
    renderSnapshotInfo();
}

export function saveAndRenderAllDataViews(options = {}) {
    const saveResult = save(options);
    renderAllDataViews();
    return saveResult;
}
