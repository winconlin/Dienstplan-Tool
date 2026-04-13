import { appState } from './state.js';
import { getWorkPercent, normalizeAtossId, getPersonValidationError, getDuplicateAtossAssignments } from './core.js';
import { renderValidation } from './validation.js';

import { getSelectedMonthValue, saveAndRenderCalendarView, saveAndRenderAllDataViews } from './ui-common.js';

// Navigation, appState.staff management and appState.wishes UI.

export function showSection(id) {
    document.querySelectorAll(".section-content").forEach((section) => section.classList.add("hidden"));
    document.getElementById(`section-${id}`)?.classList.remove("hidden");

    document.querySelectorAll("header nav button").forEach((button) => {
        button.classList.remove("text-blue-300", "border-b-2", "border-blue-300");
        if ((button.getAttribute("onclick") || "").includes(`'${id}'`)) {
            button.classList.add("text-blue-300", "border-b-2", "border-blue-300");
        }
    });

    if (id === "personal") renderStaff();
    if (id === "validation") renderValidation();
}

export function loadPerson(index) {
    const monthValue = document.getElementById("monthPicker")?.value;
    const activeStaffList = appState.staff; // Needs getActiveStaff logic eventually, but simplifies for now
    const person = activeStaffList[index];
    if (!person) return;
    document.getElementById("pName").value = person.name;
    document.getElementById("pId").value = person.id || "";
    document.getElementById("pRole").value = person.role || "AA";
    document.getElementById("pWork").value = person.work || 100;
    document.getElementById("pRotant").checked = person.isRotant || false;
    document.getElementById("pCanDoShifts").checked = person.canDoShifts !== false;
}

function clearPersonForm() {
    document.getElementById("pName").value = "";
    document.getElementById("pId").value = "";
    document.getElementById("pRole").value = "AA";
    document.getElementById("pWork").value = "";
    document.getElementById("pRotant").checked = false;
    document.getElementById("pCanDoShifts").checked = true;
}

export function savePerson() {
    const name = document.getElementById("pName")?.value.trim() || "";
    const id = document.getElementById("pId")?.value.trim() || "";
    const role = document.getElementById("pRole")?.value || "AA";
    const workInput = Number(document.getElementById("pWork")?.value);
    const work = workInput > 0 ? Math.min(workInput, 100) : 100;
    const isRotant = document.getElementById("pRotant")?.checked || false;
    const canDoShifts = document.getElementById("pCanDoShifts")?.checked !== false;

    if (!name) {
        if (window.showToast) window.showToast("Bitte einen Namen eingeben.", "warning");
        return;
    }

    const monthValue = document.getElementById("monthPicker")?.value || new Date().toISOString().slice(0, 7);
    const existingIndex = appState.staff.findIndex((person) => person.name.toLowerCase() === name.toLowerCase());

    if (existingIndex !== -1) {
        const person = appState.staff[existingIndex];
        if (!person.history) person.history = {};
        person.history[monthValue] = { role, work, isRotant, canDoShifts };
        person.id = id;
        person.role = role;
        person.work = work;
        person.isRotant = isRotant;
        person.canDoShifts = canDoShifts;
        if (window.showToast) window.showToast(`Änderungen für ${name} ab ${monthValue} gespeichert.`, "success");
    } else {
        const history = {};
        history[monthValue] = { role, work, isRotant, canDoShifts };
        appState.staff.push({ name, id, role, work, isRotant, canDoShifts, history });
        if (window.showToast) window.showToast(`${name} hinzugefügt.`, "success");
    }

    appState.staff.sort((a, b) => a.name.localeCompare(b.name));
    saveAndRenderAllDataViews();
    clearPersonForm();
}

export function removePerson(index) {
    const person = appState.staff[index];
    if (!person) return;
    if (!confirm(`Soll ${person.name} wirklich entfernt werden? Zugeordnete Dienste, Sperren und Stationsfelder werden ebenfalls geleert.`)) return;

    appState.staff.splice(index, 1);

    Object.keys(appState.plan).forEach((dateKey) => {
        ["AA", "VISITE", "OA"].forEach((role) => {
            if (appState.plan[dateKey]?.[role] === person.name) appState.plan[dateKey][role] = "";
        });
    });

    Object.keys(appState.wishes).forEach((dateKey) => {
        appState.wishes[dateKey] = (appState.wishes[dateKey] || []).filter((name) => name !== person.name);
        if (!appState.wishes[dateKey].length) delete appState.wishes[dateKey];
    });

    Object.keys(appState.stationPlan).forEach((key) => {
        if (appState.stationPlan[key] === person.name) delete appState.stationPlan[key];
    });

    saveAndRenderAllDataViews();
}

export function renderStaff() {
    const staffList = document.getElementById("staffList");
    if (!staffList) return;
    const duplicateIds = new Set(getDuplicateAtossAssignments().map((entry) => entry.id));

    staffList.innerHTML = appState.staff.map((person, index) => {
        const details = [person.role, `${getWorkPercent(person)}%`];
        const normalizedId = normalizeAtossId(person.id);
        if (normalizedId) details.unshift(normalizedId);

        const duplicateBadge = duplicateIds.has(normalizedId)
            ? ' <span class="text-red-600 font-bold">Atoss-ID doppelt</span>'
            : "";

        return `<div class="bg-slate-50 p-1 border rounded flex justify-between text-[10px] items-center mb-1 hover:bg-slate-100 cursor-pointer transition" onclick="loadPerson(${index})"><span><span class="font-bold">${person.name}</span> <span class="text-slate-500">(${details.join(" | ")})</span>${duplicateBadge}</span><button onclick="event.stopPropagation(); removePerson(${index})" class="text-red-500 font-bold px-2 hover:bg-red-100 rounded">X</button></div>`;
    }).join("");
}

export function renderWishMatrix() {
    const monthValue = getSelectedMonthValue();
    const container = document.getElementById("wishTableContainer");
    if (!monthValue || !container) return;

    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let head = '<tr><th class="border p-1 bg-slate-100">Tag</th>';
    appState.staff.forEach((person) => {
        head += `<th class="border p-1 text-[8px] h-24 align-bottom" style="writing-mode: vertical-rl;">${person.name}</th>`;
    });
    head += "</tr>";

    let body = "";
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let row = `<tr><td class="p-1 border bg-slate-50 text-center font-bold text-[10px]">${day}</td>`;
        appState.staff.forEach((person) => {
            const isSet = (appState.wishes[dateKey] || []).includes(person.name);
            row += `<td class="border text-center cursor-pointer ${isSet ? "bg-purple-500 text-white" : ""}" onclick="toggleWish('${dateKey}', '${person.name}')">${isSet ? "X" : ""}</td>`;
        });
        body += `${row}</tr>`;
    }

    container.innerHTML = `<h2 class="text-xl font-bold mb-4 text-purple-700 uppercase">Wuensche / Sperren</h2><table class="w-full text-xs border-collapse">${head}${body}</table>`;
}

export function toggleWish(dateKey, name) {
    if (!appState.wishes[dateKey]) appState.wishes[dateKey] = [];
    appState.wishes[dateKey] = appState.wishes[dateKey].includes(name)
        ? appState.wishes[dateKey].filter((item) => item !== name)
        : [...appState.wishes[dateKey], name];
    saveAndRenderCalendarView();
}
