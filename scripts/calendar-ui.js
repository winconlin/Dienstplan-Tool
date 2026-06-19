import { appState } from './state.js';
import { matchesRole, isHoliday, isRoleActiveOnDateKey, shiftDateKey, createPlanEntry, hasVacationDutyConflict, syncDienstRowsFromPlan, getConfigRoles, getConfigRoleIds } from './core.js';
import { renderValidation, getValidationIssues } from './validation.js';

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

    const validationIssues = getValidationIssues(monthValue);

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

            const hasIssue = validationIssues.some(issue => issue.reference === `${dateKey} ${role}` || issue.message.includes(`${dateKey} hat ${value}`));
            if (hasIssue) return "conflict-red border-2 border-red-500";

            if (hasVacationDutyConflict(value, dateKey, weeks)) return "conflict-red";
            if ((appState.wishes[dateKey] || []).includes(value)) return "wish-conflict";
            if (appState.plan[yesterdayKey] && Object.values(appState.plan[yesterdayKey]).includes(value)) return "conflict-red border-2 border-red-500";
            return "";
        };

        const checkRowIssue = () => {
             const issue = validationIssues.find(issue => issue.reference.startsWith(dateKey) && issue.severity === "warning");
             return issue ? `title="${issue.message}"` : "";
        };

        html += `
            <tr class="${isSpecialDay ? "holiday-bg" : ""} border-b text-xs hover:bg-slate-50" ${checkRowIssue()}>
                <td class="p-1 text-center font-bold text-slate-500">${date.toLocaleDateString("de-DE", { weekday: "short" })}</td>
                <td class="p-1 text-center font-bold border-l border-r">${day}.${holidayName ? `<br><span class="text-[7px] text-red-600 font-normal leading-tight">${holidayName}</span>` : ""}</td>
                ${getConfigRoleIds().map((role) => `<td class="p-0 relative ${checkCellClass(role)}">${createSelect(dateKey, role)}</td>`).join("")}
            </tr>`;
    }

    const headerRow = document.getElementById("calendarHeaderRow");
    if (headerRow) {
        const roleCols = getConfigRoles().map((cfg) => `<th class="p-2 border border-slate-700 w-1/4">${cfg.label}</th>`).join("");
        headerRow.innerHTML = `<th class="p-2 border border-slate-700 col-day">Tag</th><th class="p-2 border border-slate-700 col-date">Dat.</th>${roleCols}`;
    }

    calendarBody.innerHTML = html;
    renderStats();
    renderWishMatrix();
    renderValidation();
}

export function renderStats() {
    const monthValue = getSelectedMonthValue();
    const statsContainer = document.getElementById("statsContainer");
    if (!monthValue || !statsContainer) return;

    const [year, month] = monthValue.split("-").map(Number);
    const statsRoles = getConfigRoles().filter((cfg) => cfg.showInStats);

    const panels = statsRoles.map((cfg) => {
        const role = cfg.id;
        const data = appState.staff.filter((person) => matchesRole(person, role)).map((person) => {
            let monthDuty = 0;
            let sixMonthDuty = 0;

            for (let offset = 0; offset < 6; offset += 1) {
                const currentMonth = new Date(year, month - 1 - offset, 1);
                const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;

                Object.keys(appState.plan).forEach((dateKey) => {
                    if (!dateKey.startsWith(monthKey)) return;
                    const entry = appState.plan[dateKey];
                    if (entry[role] === person.name) {
                        sixMonthDuty += 1;
                        if (offset === 0) monthDuty += 1;
                    }
                });
            }

            return { name: person.name, monthDuty, sixMonthDuty };
        });

        let body;
        if (!data.length) {
            body = '<p class="text-sm text-slate-500">Keine Mitarbeiter in dieser Rolle angelegt.</p>';
        } else {
            const extremes = (key) => ({
                max: Math.max(...data.map((row) => row[key]), 1),
                min: Math.min(...data.map((row) => row[key]))
            });
            const monthRange = extremes("monthDuty");
            const sixRange = extremes("sixMonthDuty");

            let table = '<table class="w-full border-collapse border text-xs text-center"><thead><tr class="bg-slate-100"><th class="p-2 border text-left">Arzt</th><th class="p-2 border">Dienste (M)</th><th class="p-2 border">Dienste (6M)</th></tr></thead><tbody>';
            data.forEach((row) => {
                table += `<tr>
                    <td class="p-2 border text-left font-bold">${row.name}</td>
                    <td class="p-2 border" style="background:${getHeatmapColor(row.monthDuty, monthRange.min, monthRange.max)}">${row.monthDuty}</td>
                    <td class="p-2 border" style="background:${getHeatmapColor(row.sixMonthDuty, sixRange.min, sixRange.max)}">${row.sixMonthDuty}</td>
                </tr>`;
            });
            body = `${table}</tbody></table>`;
        }

        return `<div class="bg-white p-4 rounded shadow border"><h3 class="font-bold border-b mb-2 text-blue-700 uppercase">${cfg.label}</h3>${body}</div>`;
    }).join("");

    statsContainer.innerHTML = panels || '<p class="text-sm text-slate-500">Keine Rollen mit Statistik konfiguriert.</p>';
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
