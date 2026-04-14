import { appState } from './state.js';
import { matchesRole, isHoliday, isRoleActiveOnDateKey, shiftDateKey, createPlanEntry, hasVacationDutyConflict, syncDienstRowsFromPlan } from './core.js';
import { renderValidation } from './validation.js';

import { getSelectedMonthValue, saveAndRenderPlanningViews } from './ui-common.js';
import { getWeeksInMonth } from './planning-engine.js';
import { renderWishMatrix } from './management-ui.js';

// Calendar and statistics rendering.

export function getHeatmapColor(value, min, max) {
    if (max <= min) return "transparent";
    const position = (value - min) / (max - min);
    return position < 0.5
        ? `rgba(${Math.floor(255 * position * 2)}, 255, 0, 0.3)`
        : `rgba(255, ${Math.floor(255 * (2 - position * 2))}, 0, 0.3)`;
}

export function renderCalendar() {
    const monthValue = getSelectedMonthValue();
    const monthTitleEl = document.getElementById("displayMonth");
    const printTitleEl = document.getElementById("printHeaderTitle");
    const calendarBody = document.getElementById("calendarBody");
    if (!monthValue || !monthTitleEl || !printTitleEl || !calendarBody) return;

    const [year, month] = monthValue.split("-").map(Number);
    const monthLabel = new Date(year, month - 1, 1).toLocaleString("de-DE", { month: "long", year: "numeric" });
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks = getWeeksInMonth(year, month);

    monthTitleEl.innerText = monthLabel;
    printTitleEl.innerText = `Dienstplan - ${monthLabel}`;

    let html = "";
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const yesterdayKey = shiftDateKey(dateKey, -1);
        const holidayName = isHoliday(date);
        const isSpecialDay = Boolean(holidayName) || date.getDay() === 0 || date.getDay() === 6;

        const checkCellClass = (role) => {
            const value = appState.plan[dateKey]?.[role] || "";
            if (!value) return "";
            if (hasVacationDutyConflict(value, dateKey, weeks)) return "conflict-red";
            if ((appState.wishes[dateKey] || []).includes(value)) return "wish-conflict";
            if (appState.plan[yesterdayKey] && Object.values(appState.plan[yesterdayKey]).includes(value)) return "conflict-red";
            return "";
        };

        html += `
            <tr class="${isSpecialDay ? "holiday-bg" : ""} border-b text-xs">
                <td class="p-1 text-center font-bold text-slate-500">${date.toLocaleDateString("de-DE", { weekday: "short" })}</td>
                <td class="p-1 text-center font-bold border-l border-r">${day}.${holidayName ? `<br><span class="text-[7px] text-red-600 font-normal leading-tight">${holidayName}</span>` : ""}</td>
                <td class="p-0 ${checkCellClass("AA")}">${createSelect(dateKey, "AA")}</td>
                <td class="p-0 ${checkCellClass("VISITE")}">${createSelect(dateKey, "VISITE")}</td>
                <td class="p-0 ${checkCellClass("OA")}">${createSelect(dateKey, "OA")}</td>
            </tr>`;
    }

    calendarBody.innerHTML = html;
    renderStats();
    renderWishMatrix();
    renderValidation();
}

export function renderStats() {
    const monthValue = getSelectedMonthValue();
    const statsTableAA = document.getElementById("statsTableAA");
    const statsTableOA = document.getElementById("statsTableOA");
    if (!monthValue || !statsTableAA || !statsTableOA) return;

    const [year, month] = monthValue.split("-").map(Number);

    ["AA", "OA"].forEach((role) => {
        const data = appState.staff.filter((person) => matchesRole(person, role)).map((person) => {
            let monthDuty = 0;
            let monthVisit = 0;
            let sixMonthDuty = 0;
            let sixMonthVisit = 0;

            for (let offset = 0; offset < 6; offset += 1) {
                const currentMonth = new Date(year, month - 1 - offset, 1);
                const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;

                Object.keys(appState.plan).forEach((dateKey) => {
                    if (!dateKey.startsWith(monthKey)) return;
                    if (appState.plan[dateKey].AA === person.name || appState.plan[dateKey].OA === person.name) {
                        sixMonthDuty += 1;
                        if (offset === 0) monthDuty += 1;
                    }
                    if (isRoleActiveOnDateKey("VISITE", dateKey) && appState.plan[dateKey].VISITE === person.name) {
                        sixMonthVisit += 1;
                        if (offset === 0) monthVisit += 1;
                    }
                });
            }

            return { name: person.name, monthDuty, monthVisit, sixMonthDuty, sixMonthVisit };
        });

        const container = document.getElementById(`statsTable${role}`);
        if (!data.length) {
            container.innerHTML = '<p class="text-sm text-slate-500">Keine Mitarbeiter in dieser Rolle angelegt.</p>';
            return;
        }

        const extremes = (key) => ({
            max: Math.max(...data.map((row) => row[key]), 1),
            min: Math.min(...data.map((row) => row[key]))
        });

        const monthDutyRange = extremes("monthDuty");
        const monthVisitRange = extremes("monthVisit");
        const sixMonthDutyRange = extremes("sixMonthDuty");
        const sixMonthVisitRange = extremes("sixMonthVisit");

        let table = '<table class="w-full border-collapse border text-xs text-center"><thead><tr class="bg-slate-100"><th class="p-2 border text-left">Arzt</th><th class="p-2 border">24h (M)</th><th class="p-2 border">Visite (M)</th><th class="p-2 border">24h (6M)</th><th class="p-2 border">Visite (6M)</th></tr></thead><tbody>';

        data.forEach((row) => {
            table += `<tr>
                <td class="p-2 border text-left font-bold">${row.name}</td>
                <td class="p-2 border" style="background:${getHeatmapColor(row.monthDuty, monthDutyRange.min, monthDutyRange.max)}">${row.monthDuty}</td>
                <td class="p-2 border" style="background:${getHeatmapColor(row.monthVisit, monthVisitRange.min, monthVisitRange.max)}">${row.monthVisit}</td>
                <td class="p-2 border" style="background:${getHeatmapColor(row.sixMonthDuty, sixMonthDutyRange.min, sixMonthDutyRange.max)}">${row.sixMonthDuty}</td>
                <td class="p-2 border" style="background:${getHeatmapColor(row.sixMonthVisit, sixMonthVisitRange.min, sixMonthVisitRange.max)}">${row.sixMonthVisit}</td>
            </tr>`;
        });

        container.innerHTML = `${table}</tbody></table>`;
    });
}

export function createSelect(dateKey, role) {
    const currentValue = appState.plan[dateKey]?.[role] || "";
    if (!isRoleActiveOnDateKey(role, dateKey)) {
        if (!currentValue) {
            return '<div class="w-full p-1 text-center text-[10px] text-slate-300 print:text-slate-500">-</div>';
        }

        return `<select data-action="savePlan" data-date="${dateKey}" data-role="${role}" class="w-full bg-amber-50 p-1 outline-none text-[10px] text-amber-700 print:font-bold">
            <option value="${currentValue}" selected>${currentValue} (nur entfernen)</option>
            <option value="">-</option>
        </select>`;
    }

    let options = '<option value="">-</option>';

    appState.staff.filter((person) => matchesRole(person, role)).forEach((person) => {
        const isWarning = (appState.wishes[dateKey] || []).includes(person.name);
        const label = person.name + (isWarning ? " (!)" : "");
        options += `<option value="${person.name}" ${currentValue === person.name ? "selected" : ""}>${label}</option>`;
    });

    return `<select data-action="savePlan" data-date="${dateKey}" data-role="${role}" class="w-full bg-transparent p-1 outline-none text-[10px] print:font-bold">${options}</select>`;
}

export function savePlan(dateKey, role, value) {
    if (!appState.plan[dateKey]) appState.plan[dateKey] = createPlanEntry();
    appState.plan[dateKey][role] = isRoleActiveOnDateKey(role, dateKey) ? value : "";

    if (role === "AA" && isRoleActiveOnDateKey("VISITE", dateKey)) {
        if (!appState.plan[dateKey]["VISITE"]) {
            appState.plan[dateKey]["VISITE"] = value;
        } else if (!value) {
            appState.plan[dateKey]["VISITE"] = "";
        }
    }

    syncDienstRowsFromPlan(dateKey.slice(0, 7), { preserveExisting: false });
    saveAndRenderPlanningViews();
}
