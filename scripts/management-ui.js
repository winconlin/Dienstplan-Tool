import { appState } from './state.js';
import { getWorkPercent, normalizeAtossId, getPersonValidationError, getDuplicateAtossAssignments, matchesRole } from './core.js';
import { renderValidation } from './validation.js';

import { getSelectedMonthValue, saveAndRenderCalendarView, saveAndRenderAllDataViews, showToast } from './ui-common.js';

// Navigation, appState.staff management and appState.wishes UI.

export function showSection(id) {
    document.querySelectorAll(".section-content").forEach((section) => section.classList.add("hidden"));
    document.getElementById(`section-${id}`)?.classList.remove("hidden");

    document.querySelectorAll("header nav button").forEach((button) => {
        button.classList.remove("text-blue-300", "border-b-2", "border-blue-300");
        if (button.dataset.section === id) {
            button.classList.add("text-blue-300", "border-b-2", "border-blue-300");
        }
    });

    if (id === "personal") {
        renderStaff();
        renderStationLayoutEditor();
    }
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
    const pRotantEl = document.getElementById("pRotant");
    if (pRotantEl) pRotantEl.checked = Boolean(person.isRotant);
    const pCanDoShiftsEl = document.getElementById("pCanDoShifts");
    if (pCanDoShiftsEl) pCanDoShiftsEl.checked = person.canDoShifts !== false;
}

function clearPersonForm() {
    document.getElementById("pName").value = "";
    document.getElementById("pId").value = "";
    document.getElementById("pRole").value = "AA";
    document.getElementById("pWork").value = "";
    const pRotantEl = document.getElementById("pRotant");
    if (pRotantEl) pRotantEl.checked = false;
    const pCanDoShiftsEl = document.getElementById("pCanDoShifts");
    if (pCanDoShiftsEl) pCanDoShiftsEl.checked = true;
}

export function savePerson() {
    const name = document.getElementById("pName")?.value.trim() || "";
    const id = document.getElementById("pId")?.value.trim() || "";
    const role = document.getElementById("pRole")?.value || "AA";
    const workInput = Number(document.getElementById("pWork")?.value);
    const work = workInput > 0 ? Math.min(workInput, 100) : 100;
    const pRotantEl = document.getElementById("pRotant");
    const isRotant = pRotantEl ? pRotantEl.checked : false;
    const pCanDoShiftsEl = document.getElementById("pCanDoShifts");
    const canDoShifts = pCanDoShiftsEl ? pCanDoShiftsEl.checked : true;

    if (!name) {
        showToast("Bitte einen Namen eingeben.", "warning");
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
        showToast(`Änderungen für ${name} ab ${monthValue} gespeichert.`, "success");
    } else {
        const history = {};
        history[monthValue] = { role, work, isRotant, canDoShifts };
        appState.staff.push({ name, id, role, work, isRotant, canDoShifts, history });
        showToast(`${name} hinzugefügt.`, "success");
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

        // Escape name to prevent XSS
        const escapeHtml = (text) => document.createElement('div').appendChild(document.createTextNode(text)).parentNode.innerHTML;
        const safeName = escapeHtml(person.name);

        return `<div class="bg-slate-50 p-1 border rounded flex justify-between text-[10px] items-center mb-1 hover:bg-slate-100 cursor-pointer transition" data-action="loadPerson" data-index="${index}"><span><span class="font-bold">${safeName}</span> <span class="text-slate-500">(${details.join(" | ")})</span>${duplicateBadge}</span><button data-action="removePerson" data-index="${index}" class="text-red-500 font-bold px-2 hover:bg-red-100 rounded">X</button></div>`;
    }).join("");
}

export function renderWishMatrix() {
    const monthValue = getSelectedMonthValue();
    const container = document.getElementById("wishTableContainer");
    if (!monthValue || !container) return;

    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Group staff by roles: Assistants vs Seniors
    const assistants = appState.staff.filter((person) => !matchesRole(person, "OA"));
    const seniors = appState.staff.filter((person) => matchesRole(person, "OA"));
    const groupedStaff = [...assistants, ...seniors];

    let head = '<tr><th class="border p-1 bg-slate-100">Tag</th>';
    groupedStaff.forEach((person) => {
        head += `<th class="border p-1 text-[8px] h-24 align-bottom" style="writing-mode: vertical-rl;">${person.name}</th>`;
    });
    head += "</tr>";

    let body = "";
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let row = `<tr><td class="p-1 border bg-slate-50 text-center font-bold text-[10px]">${day}</td>`;
        groupedStaff.forEach((person) => {
            const isSet = (appState.wishes[dateKey] || []).includes(person.name);
            row += `<td class="border text-center cursor-pointer ${isSet ? "bg-purple-500 text-white" : ""}" data-action="toggleWish" data-date="${dateKey}" data-name="${person.name}">${isSet ? "X" : ""}</td>`;
        });
        body += `${row}</tr>`;
    }

    container.innerHTML = `<table class="w-full text-xs border-collapse">${head}${body}</table>`;
}

export function toggleWish(dateKey, name) {
    if (!appState.wishes[dateKey]) appState.wishes[dateKey] = [];
    appState.wishes[dateKey] = appState.wishes[dateKey].includes(name)
        ? appState.wishes[dateKey].filter((item) => item !== name)
        : [...appState.wishes[dateKey], name];
    saveAndRenderCalendarView();
}

import { stationLayout, defaultStationLayout, updateStationLayout } from './core.js';
import { saveAndRenderStationView } from './ui-common.js';

export function renderStationLayoutEditor() {
    const listEl = document.getElementById("stationLayoutList");
    if (!listEl) return;

    let html = "";
    const escapeHtml = (text) => document.createElement('div').appendChild(document.createTextNode(text)).parentNode.innerHTML;

    stationLayout.forEach((node, index) => {
        html += `
        <div class="flex justify-between items-center bg-white p-2 mb-1 border rounded shadow-sm hover:shadow transition">
            <div class="flex-1 cursor-pointer" data-action="loadStationNode" data-index="${index}">
                <span class="font-bold text-xs text-slate-800">${escapeHtml(node.name)}</span>
                <span class="text-[10px] text-slate-500 ml-2">(${escapeHtml(node.category)}) [${escapeHtml(node.id)}]</span>
            </div>
            <div class="flex gap-1">
                <button data-action="moveStationNodeUp" data-index="${index}" class="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs" ${index === 0 ? "disabled" : ""}>↑</button>
                <button data-action="moveStationNodeDown" data-index="${index}" class="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs" ${index === stationLayout.length - 1 ? "disabled" : ""}>↓</button>
                <button data-action="deleteStationNode" data-index="${index}" class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs">X</button>
            </div>
        </div>`;
    });

    listEl.innerHTML = html;
}

export function loadStationNode(index) {
    const node = stationLayout[index];
    if (!node) return;

    document.getElementById("sId").value = node.id;
    document.getElementById("sName").value = node.name;
    document.getElementById("sCategory").value = node.category;
}

export function saveStationNode() {
    const id = document.getElementById("sId").value.trim();
    const name = document.getElementById("sName").value.trim();
    const category = document.getElementById("sCategory").value.trim();

    if (!id || !name || !category) {
        showToast("Bitte ID, Name und Kategorie angeben.", "error");
        return;
    }

    const existingIndex = stationLayout.findIndex(n => n.id === id);
    if (existingIndex >= 0) {
        stationLayout[existingIndex] = { id, name, category };
        showToast("Station aktualisiert.");
    } else {
        stationLayout.push({ id, name, category });
        showToast("Station hinzugefügt.");
    }

    document.getElementById("sId").value = "";
    document.getElementById("sName").value = "";
    document.getElementById("sCategory").value = "";

    appState.stationLayout = stationLayout;
    saveAndRenderAllDataViews();
    renderStationLayoutEditor();
}

export function moveStationNodeUp(index) {
    if (index <= 0) return;
    const temp = stationLayout[index - 1];
    stationLayout[index - 1] = stationLayout[index];
    stationLayout[index] = temp;

    appState.stationLayout = stationLayout;
    saveAndRenderAllDataViews();
    renderStationLayoutEditor();
}

export function moveStationNodeDown(index) {
    if (index >= stationLayout.length - 1) return;
    const temp = stationLayout[index + 1];
    stationLayout[index + 1] = stationLayout[index];
    stationLayout[index] = temp;

    appState.stationLayout = stationLayout;
    saveAndRenderAllDataViews();
    renderStationLayoutEditor();
}

export function deleteStationNode(index) {
    if (!confirm(`Soll der Knoten '${stationLayout[index].name}' wirklich gelöscht werden?`)) return;

    stationLayout.splice(index, 1);
    appState.stationLayout = stationLayout;
    saveAndRenderAllDataViews();
    renderStationLayoutEditor();
}

export function resetStationLayout() {
    if (!confirm("Soll das Layout wirklich auf den Standard zurückgesetzt werden? Alle eigenen Anpassungen gehen verloren.")) return;

    updateStationLayout([...defaultStationLayout]);
    appState.stationLayout = stationLayout;
    saveAndRenderAllDataViews();
    renderStationLayoutEditor();
}
