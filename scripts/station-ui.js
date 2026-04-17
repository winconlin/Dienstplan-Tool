import { appState } from './state.js';
import { matchesRole, syncDienstRowsFromPlan, parseStationCellKey, applyDienstRowToPlan, stationLayout } from './core.js';
import { renderValidation } from './validation.js';

import { getSelectedMonthValue, saveAndRenderPlanningViews } from './ui-common.js';
import { getWeeksInMonth } from './planning-engine.js';

// Station appState.plan rendering and editing.

export function renderStationPlan() {
    const monthValue = getSelectedMonthValue();
    const headerEl = document.getElementById("stationHeader");
    const bodyEl = document.getElementById("stationBody");
    const printTitle = document.getElementById("printHeaderStationTitle");
    const unassignedContainer = document.getElementById("unassignedDoctorsList");
    if (!monthValue || !headerEl || !bodyEl || !printTitle || !unassignedContainer) return;

    const [year, month] = monthValue.split("-").map(Number);
    const monthName = new Date(year, month - 1, 1).toLocaleString("de-DE", { month: "long" });
    printTitle.innerText = `Stationsbesetzung MED I - ${monthName} ${year}`;

    const weeks = getWeeksInMonth(year, month);
    headerEl.innerHTML = `
        <tr class="bg-slate-300 font-bold border-b border-slate-400 text-center align-middle">
            <th class="p-2 border-r border-slate-400 w-32" colspan="2">Kalenderwoche<br><span class="text-[9px] font-normal">1. Montag</span></th>
            ${weeks.map((week) => `<th class="p-2 border-r border-slate-400 w-24">${week.kw}<br><span class="text-[9px] font-normal">${week.mondayDateStr}</span></th>`).join("")}
        </tr>`;

    let tbody = "";
    let currentCategory = null;
    let categoryCount = 0;

    const assignedPerWeek = {};
    weeks.forEach(w => assignedPerWeek[w.key] = new Set());

    stationLayout.forEach((row, index) => {
        if (row.category !== currentCategory) {
            currentCategory = row.category;
            categoryCount = stationLayout.filter((item) => item.category === currentCategory).length;
        }

        let tableRow = `<tr class="border-b border-slate-300 text-center align-middle ${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100 transition">`;
        const isFirstInCategory = stationLayout.findIndex((item) => item.category === currentCategory) === index;
        const siblings = stationLayout.filter((item) => item.category === currentCategory);
        const hasSubRows = siblings.some((item) => item.name !== item.category);

        if (isFirstInCategory) {
            const colSpan = hasSubRows ? "" : 'colspan="2"';
            tableRow += `<td class="p-2 font-bold border-r border-slate-300" ${colSpan} rowspan="${categoryCount}">${row.category}</td>`;
        }

        if (hasSubRows) {
            const subText = row.name !== row.category ? row.name : "";
            tableRow += `<td class="p-1 border-r border-slate-300 text-[10px] whitespace-nowrap">${subText}</td>`;
        }

        weeks.forEach((week) => {
            const cellKey = `${week.key}_${row.id}`;
            const currentValue = appState.stationPlan[cellKey] || "";
            if (currentValue) assignedPerWeek[week.key].add(currentValue);

            const allowedRoles = [];
            if (row.category === "Oberaerzte") allowedRoles.push("OA_STATION");
            else if (row.category === "EPU") allowedRoles.push("EPU");
            else if (row.category.includes("Urlaub") || row.category.includes("Zeitausgleich")) allowedRoles.push("ALL");
            else allowedRoles.push("AA");

            tableRow += `
                <td class="p-0 border-r border-slate-300 relative bg-white droppable-cell"
                    data-cell="${cellKey}"
                    data-allowed="${allowedRoles.join(",")}"
                    ondragover="event.preventDefault(); this.classList.add('bg-blue-50')"
                    ondragleave="this.classList.remove('bg-blue-50')"
                    ondrop="window.handleDropStation(event)">
                    ${currentValue ?
                        `<div class="w-full p-2 text-[11px] font-bold text-center cursor-move draggable-doctor"
                              draggable="true"
                              ondragstart="window.handleDragStartStation(event, '${currentValue}', '${cellKey}')">
                            ${currentValue}
                            <span class="absolute top-0 right-1 text-[8px] text-red-500 cursor-pointer" data-action="saveStationPlan" data-cell="${cellKey}" data-value="">x</span>
                        </div>`
                        : '<div class="w-full p-2 h-full min-h-[30px]"></div>'}
                </td>`;
        });

        tableRow += "</tr>";
        tbody += tableRow;
    });

    bodyEl.innerHTML = tbody;

    let unassignedHtml = `<div class="grid grid-cols-1 md:grid-cols-${weeks.length} gap-2">`;
    weeks.forEach(week => {
        unassignedHtml += `<div class="border p-2 rounded bg-white">
            <h4 class="font-bold text-[10px] border-b pb-1 mb-1">KW ${week.kw}</h4>
            <div class="flex flex-wrap gap-1">`;

        appState.staff.forEach(person => {
            if (!assignedPerWeek[week.key].has(person.name)) {
                const roles = [];
                if (matchesRole(person, "AA")) roles.push("AA");
                if (matchesRole(person, "OA_STATION")) roles.push("OA_STATION");
                if (matchesRole(person, "EPU")) roles.push("EPU");

                unassignedHtml += `<div class="px-2 py-1 bg-slate-200 text-[10px] rounded cursor-move hover:bg-slate-300 transition"
                    draggable="true"
                    data-role="${roles.join(",")}"
                    ondragstart="window.handleDragStartStation(event, '${person.name}', 'unassigned')">
                    ${person.name}
                </div>`;
            }
        });
        unassignedHtml += `</div></div>`;
    });
    unassignedHtml += `</div>`;
    unassignedContainer.innerHTML = unassignedHtml;

    renderValidation();
}

export function saveStationPlan(key, value) {
    const monthValue = getSelectedMonthValue();
    const { rowId } = parseStationCellKey(key);

    if (value) appState.stationPlan[key] = value;
    else delete appState.stationPlan[key];

    if ((rowId === "da_1" || rowId === "da_2") && monthValue) {
        if (value) applyDienstRowToPlan(monthValue, key, value);
        syncDienstRowsFromPlan(monthValue, { preserveExisting: false });
    }

    saveAndRenderPlanningViews();
}
