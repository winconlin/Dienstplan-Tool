import { state, defaultStationLayout, loadState, saveState, createSnapshot, triggerUndo } from './state.js';
import { getMonthDayKeys, getCurrentMonthValue, getWeeksInMonth, isHoliday, isVisitDay } from './calendar.js';
import { showToast, showSection } from './ui.js';
import { escapeHTML, getHeatmapColor } from './utils.js';
import { getActiveStaff, matchesRole, getWorkPercent } from './staff.js';
import { exportAllICS, exportAtossCSV, backupExport, backupImport, cleanupOldData } from './export.js';
import { getValidationIssues } from './validation.js';
import { renderStationEditor, addStation } from './config.js';
import { t } from './i18n.js';

let worker;

import { migrateLegacyData } from './migration.js';

export async function bootstrap() {
    await migrateLegacyData();
    await loadState();

    const monthPicker = document.getElementById("monthPicker");
    if (monthPicker) {
        monthPicker.value = getCurrentMonthValue();
        monthPicker.addEventListener("change", () => {
            renderCalendar();
            renderStationPlan();
        });
    }

    const holidayCheckbox = document.getElementById("holidaySeasonMode");
    if (holidayCheckbox) {
        holidayCheckbox.checked = state.holidaySeasonMode;
        holidayCheckbox.addEventListener("change", async (e) => {
            state.holidaySeasonMode = e.target.checked;
            await saveState();
            renderCalendar();
            renderStationPlan();
        });
    }

    // Attach Nav
    document.querySelectorAll("header nav button").forEach(btn => {
        btn.addEventListener("click", () => showSection(btn.dataset.target));
    });

    // Attach other global buttons
    document.getElementById("btnClearMonth")?.addEventListener("click", clearMonth);
    document.getElementById("btnAutoPlaner")?.addEventListener("click", runAutoPlaner);
    document.getElementById("btnClearStationPlan")?.addEventListener("click", clearStationPlan);
    document.getElementById("btnRenderValidation")?.addEventListener("click", renderValidation);
    document.getElementById("btnClearWishes")?.addEventListener("click", clearWishes);
    document.getElementById("btnSavePerson")?.addEventListener("click", savePerson);
    document.getElementById("btnClearPersonForm")?.addEventListener("click", clearPersonForm);
    document.getElementById("btnBackupExport")?.addEventListener("click", backupExport);
    document.getElementById("btnExportICS")?.addEventListener("click", () => exportAllICS(monthPicker?.value));
    document.getElementById("btnExportCSV")?.addEventListener("click", () => exportAtossCSV(monthPicker?.value));
    document.getElementById("btnCleanupOldData")?.addEventListener("click", cleanupOldData);
    document.getElementById("btnSaveStationLayout")?.addEventListener("click", addStation);
    document.getElementById("backupInput")?.addEventListener("change", (e) => {
        if(e.target.files.length) backupImport(e.target.files[0]);
    });

    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
            e.preventDefault();
            triggerUndo(() => {
                renderCalendar();
                renderStationPlan();
            });
        }
    });

    initWorker();

    renderStationPlan();
    renderCalendar();
    renderStationEditor();
    showSection("plan");
}

function initWorker() {
    if (window.Worker) {
        worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = async function(e) {
            document.getElementById("loadingOverlay")?.classList.add("hidden");
            const { plan, stationPlan } = e.data;
            state.plan = plan;
            state.stationPlan = stationPlan;
            await saveState();
            renderStationPlan();
            renderCalendar();
            showToast(t('toast_autoplan_success'), 'success');
        };
        worker.onerror = function(e) {
            document.getElementById("loadingOverlay")?.classList.add("hidden");
            showToast("Error in Autoplaner: " + e.message, "error");
        };
    }
}

async function runAutoPlaner() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (!confirm(t('alert_confirm_autoplan'))) return;

    await createSnapshot();

    document.getElementById("loadingOverlay")?.classList.remove("hidden");

    const [year, month] = monthValue.split("-").map(Number);
    const planWeeks = getWeeksInMonth(year, month);
    const activeStaff = getActiveStaff(monthValue);

    const stationLayout = state.customStationLayout || defaultStationLayout;

    if (worker) {
        worker.postMessage({
            year,
            month,
            state: {
                stationLayout,
                stationPlan: state.stationPlan,
                plan: state.plan,
                wishes: state.wishes,
                holidaySeasonMode: state.holidaySeasonMode
            },
            activeStaff,
            planWeeks
        });
    }
}

async function clearMonth() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (!confirm(t('alert_confirm_clear_month'))) return;

    await createSnapshot();
    getMonthDayKeys(monthValue).forEach((dayKey) => {
        state.plan[dayKey] = { AA: "", VISITE: "", OA: "" };
    });
    await saveState();
    renderCalendar();
}

async function clearStationPlan() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (!confirm(t('alert_confirm_clear_stations'))) return;

    await createSnapshot();
    const [year, month] = monthValue.split("-").map(Number);
    const weeks = getWeeksInMonth(year, month);
    const layout = state.customStationLayout || defaultStationLayout;

    weeks.forEach(week => {
        layout.forEach(row => {
            delete state.stationPlan[`${week.key}_${row.id}`];
        });
    });
    await saveState();
    renderStationPlan();
}

async function clearWishes() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (!confirm(t('alert_confirm_clear_wishes'))) return;

    await createSnapshot();
    getMonthDayKeys(monthValue).forEach((dayKey) => delete state.wishes[dayKey]);
    await saveState();
    renderCalendar();
}

// ... Additional rendering logic to be migrated ...


export function renderStationPlan() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const headerEl = document.getElementById("stationHeader");
    const bodyEl = document.getElementById("stationBody");
    const printTitle = document.getElementById("printHeaderStationTitle");
    if (!monthValue || !headerEl || !bodyEl || !printTitle) return;

    const [year, month] = monthValue.split("-").map(Number);
    const monthName = new Date(year, month - 1, 1).toLocaleString("de-DE", { month: "long" });
    printTitle.innerText = `${t('tab_stationen')} MED I - ${monthName} ${year}`;

    const weeks = getWeeksInMonth(year, month);
    headerEl.innerHTML = `
        <tr class="bg-slate-300 font-bold border-b border-slate-400 text-center align-middle">
            <th class="p-2 border-r border-slate-400 w-32" colspan="2">Kalenderwoche<br><span class="text-[9px] font-normal">1. Montag</span></th>
            ${weeks.map((week) => `<th class="p-2 border-r border-slate-400 w-24">${week.kw}<br><span class="text-[9px] font-normal">${week.mondayDateStr}</span></th>`).join("")}
        </tr>`;

    let tbody = "";
    let currentCategory = null;
    let categoryCount = 0;

    const layout = state.customStationLayout || defaultStationLayout;
    const activeStaff = getActiveStaff(monthValue);

    layout.forEach((row, index) => {
        if (row.category !== currentCategory) {
            currentCategory = row.category;
            categoryCount = layout.filter((item) => item.category === currentCategory).length;
        }

        let tableRow = `<tr class="border-b border-slate-300 text-center align-middle ${index % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-900"} hover:bg-slate-100 dark:hover:bg-slate-700 transition">`;
        const isFirstInCategory = layout.findIndex((item) => item.category === currentCategory) === index;
        const siblings = layout.filter((item) => item.category === currentCategory);
        const hasSubRows = siblings.some((item) => item.name !== item.category);

        if (isFirstInCategory) {
            const colSpan = hasSubRows ? "" : 'colspan="2"';
            tableRow += `<td class="p-2 font-bold border-r border-slate-300" ${colSpan} rowspan="${categoryCount}">${escapeHTML(row.category)}</td>`;
        }

        if (hasSubRows) {
            const subText = row.name !== row.category ? row.name : "";
            tableRow += `<td class="p-1 border-r border-slate-300 text-[10px] whitespace-nowrap">${escapeHTML(subText)}</td>`;
        }

        weeks.forEach((week) => {
            const cellKey = `${week.key}_${row.id}`;
            const currentValue = state.stationPlan[cellKey] || "";
            let options = '<option value=""></option>';

            activeStaff.forEach((person) => {
                let show = false;
                if (row.category === "Oberärzte") show = matchesRole(person, "OA");
                else if (row.category === "EPU") show = matchesRole(person, "EPU");
                else if (row.category.includes("Urlaub") || row.category.includes("Zeitausgleich")) show = true;
                else show = matchesRole(person, "AA");

                if (show) {
                    const escapedName = escapeHTML(person.name);
                    options += `<option value="${escapedName}" ${currentValue === person.name ? "selected" : ""}>${escapedName}</option>`;
                }
            });

            let cellClasses = "p-0 border-r border-slate-300 relative";
            if (currentValue) {
                const dateKeysForWeek = [0,1,2,3,4,5,6].map(off => {
                    const parts = week.mondayDateStr.split(".");
                    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    const d = new Date(Number(y), Number(parts[1]) - 1, Number(parts[0]) + off);
                    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                });

                let hasConflict = false;
                if (!row.category.includes("Urlaub") && !row.category.includes("Zeitausgleich")) {
                    for (const dk of dateKeysForWeek) {
                        if (state.wishes[dk] && state.wishes[dk].includes(currentValue)) {
                            hasConflict = true; break;
                        }
                    }
                }
                if (hasConflict) cellClasses += " wish-conflict";
            }

            tableRow += `
                <td class="${cellClasses}">
                    <select data-cellkey="${cellKey}" class="station-select w-full bg-transparent p-2 outline-none text-[11px] font-bold text-center print:appearance-none cursor-pointer">
                        ${options}
                    </select>
                </td>`;
        });

        tableRow += "</tr>";
        tbody += tableRow;
    });

    // Unassigned row
    let unassignedRow = `<tr class="border-b border-slate-300 text-center align-middle bg-slate-100 dark:bg-slate-700 no-print text-[10px]">
        <td class="p-2 font-bold border-r border-slate-300 text-slate-500 dark:text-slate-300" colspan="2">${t('unassigned')}</td>`;

    weeks.forEach((week) => {
        const assignedDocs = new Set();
        layout.forEach((row) => {
            const val = state.stationPlan[`${week.key}_${row.id}`];
            if (val) assignedDocs.add(val);
        });

        const unassigned = activeStaff.filter((person) => !assignedDocs.has(person.name) && matchesRole(person, "AA"));
        const namesList = escapeHTML(unassigned.map(p => p.name).join(", "));
        unassignedRow += `<td class="p-1 border-r border-slate-300 text-slate-500 dark:text-slate-300 max-w-[80px] truncate" title="${namesList}">${unassigned.length > 0 ? namesList : "-"}</td>`;
    });
    unassignedRow += "</tr>";

    bodyEl.innerHTML = tbody + unassignedRow;

    // Attach listeners
    document.querySelectorAll(".station-select").forEach(sel => {
        sel.addEventListener("focus", createSnapshot);
        sel.addEventListener("change", async (e) => {
            const key = e.target.dataset.cellkey;
            if (e.target.value) state.stationPlan[key] = e.target.value;
            else delete state.stationPlan[key];
            await saveState();
            renderStationPlan();
        });
    });

    renderValidation();
}

export function renderCalendar() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const monthTitleEl = document.getElementById("displayMonth");
    const printTitleEl = document.getElementById("printHeaderTitle");
    const calendarBody = document.getElementById("calendarBody");
    if (!monthValue || !monthTitleEl || !printTitleEl || !calendarBody) return;

    const [year, month] = monthValue.split("-").map(Number);
    const monthLabel = new Date(year, month - 1, 1).toLocaleString("de-DE", { month: "long", year: "numeric" });
    const daysInMonth = new Date(year, month, 0).getDate();

    monthTitleEl.innerText = monthLabel;
    printTitleEl.innerText = `${t('tab_planung')} - ${monthLabel}`;

    let html = "";
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const yesterdayKey = `${year}-${String(month).padStart(2, "0")}-${String(day - 1).padStart(2, "0")}`;
        const holidayName = isHoliday(date);
        const isSpecialDay = Boolean(holidayName) || date.getDay() === 0 || date.getDay() === 6;

        const checkCellClass = (role) => {
            const value = state.plan[dateKey]?.[role] || "";
            if (!value) return "";
            if ((state.wishes[dateKey] || []).includes(value)) return "wish-conflict";
            if (state.plan[yesterdayKey] && Object.values(state.plan[yesterdayKey]).includes(value)) return "conflict-red";

            // Check double assignment across plan and stationPlan
            const [y, m, d] = dateKey.split("-").map(Number);
            const isoDate = new Date(y, m - 1, d);
            isoDate.setHours(0, 0, 0, 0);
            isoDate.setDate(isoDate.getDate() + 4 - (isoDate.getDay() || 7));
            const yearStart = new Date(isoDate.getFullYear(), 0, 1);
            const weekOne = new Date(yearStart);
            weekOne.setDate(weekOne.getDate() + 4 - (weekOne.getDay() || 7));
            const weekNumber = 1 + Math.round(((isoDate.getTime() - weekOne.getTime()) / 86400000 - 3 + (weekOne.getDay() + 6) % 7) / 7);
            const weekKey = `${y}-KW${String(weekNumber).padStart(2, "0")}`;

            let isVacation = false;
            let countAssign = 0;

            if (role !== "VISITE") {
                const layout = state.customStationLayout || defaultStationLayout;
                layout.forEach((r) => {
                    const v = state.stationPlan[`${weekKey}_${r.id}`];
                    if (v === value) {
                        if (r.category.includes("Urlaub") || r.category.includes("Zeitausgleich")) isVacation = true;
                        else countAssign++;
                    }
                });

                if (isVacation) return "conflict-red"; // Can't be on plan if on vacation
            }

            return "";
        };

        const createSelect = (dateKey, role) => {
            const currentValue = state.plan[dateKey]?.[role] || "";
            let options = '<option value="">-</option>';
            const activeStaff = getActiveStaff(monthValue);

            activeStaff.filter((person) => matchesRole(person, role)).forEach((person) => {
                const isWarning = (state.wishes[dateKey] || []).includes(person.name);
                const label = person.name + (isWarning ? " (!)" : "");
                const escapedName = escapeHTML(person.name);
                const escapedLabel = escapeHTML(label);
                options += `<option value="${escapedName}" ${currentValue === person.name ? "selected" : ""}>${escapedLabel}</option>`;
            });

            return `<select data-datekey="${dateKey}" data-role="${role}" class="plan-select w-full bg-transparent p-1 outline-none text-[10px] print:font-bold">${options}</select>`;
        };

        html += `
            <tr class="${isSpecialDay ? "bg-slate-200 dark:bg-slate-700 holiday-bg" : "bg-white dark:bg-slate-800"} border-b border-slate-200 dark:border-slate-600 text-xs">
                <td class="p-1 text-center font-bold text-slate-500 dark:text-slate-400">${date.toLocaleDateString("de-DE", { weekday: "short" })}</td>
                <td class="p-1 text-center font-bold border-l border-r border-slate-200 dark:border-slate-600">${day}.${holidayName ? `<br><span class="text-[7px] text-red-600 dark:text-red-400 font-normal leading-tight">${escapeHTML(holidayName)}</span>` : ""}</td>
                <td class="p-0 ${checkCellClass("AA")}">${createSelect(dateKey, "AA")}</td>
                <td class="p-0 ${checkCellClass("VISITE")}">${isVisitDay(date) ? createSelect(dateKey, "VISITE") : ""}</td>
                <td class="p-0 ${checkCellClass("OA")}">${createSelect(dateKey, "OA")}</td>
            </tr>`;
    }

    calendarBody.innerHTML = html;

    document.querySelectorAll(".plan-select").forEach(sel => {
        sel.addEventListener("focus", createSnapshot);
        sel.addEventListener("change", async (e) => {
            const dk = e.target.dataset.datekey;
            const role = e.target.dataset.role;
            const val = e.target.value;
            if (!state.plan[dk]) state.plan[dk] = {};
            state.plan[dk][role] = val;
            await saveState();
            renderCalendar();
        });
    });

    renderStats();
    renderWishMatrix();
    renderValidation();
}

export function renderStats() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const statsTableAA = document.getElementById("statsTableAA");
    const statsTableOA = document.getElementById("statsTableOA");
    if (!monthValue || !statsTableAA || !statsTableOA) return;

    const [year, month] = monthValue.split("-").map(Number);
    const activeStaff = getActiveStaff(monthValue);

    ["AA", "OA"].forEach((role) => {
        const data = activeStaff.filter((person) => {
            if (role === "OA") return person.role === "OA" || person.role === "FOA" || person.role === "OA-EPU" || person.role === "FOA-EPU";
            return person.role === "AA" || person.role === "FOA" || person.role === "FOA-EPU";
        }).map((person) => {
            let monthDuty = 0;
            let monthVisit = 0;
            let sixMonthDuty = 0;
            let sixMonthVisit = 0;

            for (let offset = 0; offset < 6; offset += 1) {
                const currentMonth = new Date(year, month - 1 - offset, 1);
                const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;

                Object.keys(state.plan).forEach((dateKey) => {
                    if (!dateKey.startsWith(monthKey)) return;
                    if (state.plan[dateKey].AA === person.name || state.plan[dateKey].OA === person.name) {
                        sixMonthDuty += 1;
                        if (offset === 0) monthDuty += 1;
                    }
                    if (state.plan[dateKey].VISITE === person.name) {
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

        let table = '<table class="w-full border-collapse border text-xs text-center dark:border-slate-600"><thead><tr class="bg-slate-100 dark:bg-slate-700"><th class="p-2 border dark:border-slate-600 text-left">Arzt</th><th class="p-2 border dark:border-slate-600">24h (M)</th><th class="p-2 border dark:border-slate-600">Visite (M)</th><th class="p-2 border dark:border-slate-600">24h (6M)</th><th class="p-2 border dark:border-slate-600">Visite (6M)</th></tr></thead><tbody>';

        data.forEach((row) => {
            table += `<tr class="dark:bg-slate-800">
                <td class="p-2 border dark:border-slate-600 text-left font-bold">${escapeHTML(row.name)}</td>
                <td class="p-2 border dark:border-slate-600" style="background:${getHeatmapColor(row.monthDuty, monthDutyRange.min, monthDutyRange.max)}">${row.monthDuty}</td>
                <td class="p-2 border dark:border-slate-600" style="background:${getHeatmapColor(row.monthVisit, monthVisitRange.min, monthVisitRange.max)}">${row.monthVisit}</td>
                <td class="p-2 border dark:border-slate-600" style="background:${getHeatmapColor(row.sixMonthDuty, sixMonthDutyRange.min, sixMonthDutyRange.max)}">${row.sixMonthDuty}</td>
                <td class="p-2 border dark:border-slate-600" style="background:${getHeatmapColor(row.sixMonthVisit, sixMonthVisitRange.min, sixMonthVisitRange.max)}">${row.sixMonthVisit}</td>
            </tr>`;
        });

        container.innerHTML = `${table}</tbody></table>`;
    });
}

export function renderStaff() {
    const staffList = document.getElementById("staffList");
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!staffList) return;

    const activeStaff = getActiveStaff(monthValue);

    staffList.innerHTML = activeStaff.map((person, index) => {
        const details = [person.role, `${getWorkPercent(person)}%`];
        if (person.id) details.unshift(person.id);
        if (person.isRotant) details.push(t('rotant'));
        if (person.canDoShifts === false) details.push("Keine Dienste");
        const escapedName = escapeHTML(person.name);
        return `<div class="bg-slate-50 dark:bg-slate-800 p-1 border dark:border-slate-600 rounded flex justify-between text-[10px] items-center mb-1 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition" data-index="${index}">
            <span><span class="font-bold">${escapedName}</span> <span class="text-slate-500 dark:text-slate-400">(${escapeHTML(details.join(" | "))})</span></span>
            <button data-deleteindex="${index}" class="text-red-500 font-bold px-2 hover:bg-red-100 dark:hover:bg-red-900 rounded">X</button>
        </div>`;
    }).join("");

    document.querySelectorAll("[data-index]").forEach(el => {
        el.addEventListener("click", () => loadPerson(el.dataset.index));
    });
    document.querySelectorAll("[data-deleteindex]").forEach(el => {
        el.addEventListener("click", (e) => {
            e.stopPropagation();
            removePerson(el.dataset.deleteindex);
        });
    });
}

function loadPerson(index) {
    const monthValue = document.getElementById("monthPicker")?.value;
    const activeStaffList = getActiveStaff(monthValue);
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

async function savePerson() {
    const name = document.getElementById("pName")?.value.trim() || "";
    const id = document.getElementById("pId")?.value.trim() || "";
    const role = document.getElementById("pRole")?.value || "AA";
    const workInput = Number(document.getElementById("pWork")?.value);
    const work = workInput > 0 ? Math.min(workInput, 100) : 100;
    const isRotant = document.getElementById("pRotant")?.checked || false;
    const canDoShifts = document.getElementById("pCanDoShifts")?.checked !== false;

    if (!name) {
        showToast(t('alert_name_required'), "warning");
        return;
    }

    const monthValue = document.getElementById("monthPicker")?.value || getCurrentMonthValue();
    const existingIndex = state.staff.findIndex((person) => person.name.toLowerCase() === name.toLowerCase());

    if (existingIndex !== -1) {
        const person = state.staff[existingIndex];
        if (!person.history) person.history = {};
        person.history[monthValue] = { role, work, isRotant, canDoShifts };
        person.id = id;
        showToast(t('alert_saved', name), "success");
    } else {
        const history = {};
        history[monthValue] = { role, work, isRotant, canDoShifts };
        state.staff.push({ name, id, history });
        showToast(t('alert_added', name), "success");
    }

    await saveState();
    renderStaff();
    renderCalendar();
    renderStationPlan();
    clearPersonForm();
}

async function removePerson(index) {
    const person = state.staff[index];
    if (!person) return;
    if (!confirm(t('alert_confirm_delete', person.name))) return;

    state.staff.splice(index, 1);

    Object.keys(state.plan).forEach((dateKey) => {
        ["AA", "VISITE", "OA"].forEach((role) => {
            if (state.plan[dateKey]?.[role] === person.name) state.plan[dateKey][role] = "";
        });
    });

    Object.keys(state.wishes).forEach((dateKey) => {
        state.wishes[dateKey] = (state.wishes[dateKey] || []).filter((name) => name !== person.name);
        if (!state.wishes[dateKey].length) delete state.wishes[dateKey];
    });

    Object.keys(state.stationPlan).forEach((key) => {
        if (state.stationPlan[key] === person.name) delete state.stationPlan[key];
    });

    await saveState();
    renderStaff();
    renderCalendar();
    renderStationPlan();
}

export function renderWishMatrix() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const container = document.getElementById("wishTableContainer");
    if (!monthValue || !container) return;

    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const activeStaff = getActiveStaff(monthValue);
    const groupAA = activeStaff.filter(p => p.role === "AA" || p.role === "FOA");
    const groupOA = activeStaff.filter(p => p.role === "OA");
    const groupEPU = activeStaff.filter(p => p.role === "OA-EPU" || p.role === "FOA-EPU");

    const sortedStaff = [...groupAA, ...groupOA, ...groupEPU];

    let head = `<tr class="dark:bg-slate-800"><th class="border dark:border-slate-600 p-1 bg-slate-100 dark:bg-slate-700" rowspan="2">${t('day')}</th>`;

    if (groupAA.length > 0) head += `<th class="border dark:border-slate-600 p-1 bg-blue-50 dark:bg-blue-900 text-center" colspan="${groupAA.length}">${t('role_assistant')}</th>`;
    if (groupOA.length > 0) head += `<th class="border dark:border-slate-600 p-1 bg-purple-50 dark:bg-purple-900 text-center" colspan="${groupOA.length}">${t('role_oberarzt')}</th>`;
    if (groupEPU.length > 0) head += `<th class="border dark:border-slate-600 p-1 bg-green-50 dark:bg-green-900 text-center" colspan="${groupEPU.length}">${t('role_epu_oberarzt')}</th>`;

    head += '</tr><tr class="dark:bg-slate-800">';

    sortedStaff.forEach((person) => {
        head += `<th class="border dark:border-slate-600 p-1 text-[8px] h-24 align-bottom" style="writing-mode: vertical-rl;">${escapeHTML(person.name)}</th>`;
    });
    head += "</tr>";

    let body = "";
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let row = `<tr class="dark:bg-slate-800"><td class="p-1 border dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-center font-bold text-[10px]">${day}</td>`;
        sortedStaff.forEach((person) => {
            const isSet = (state.wishes[dateKey] || []).includes(person.name);
            row += `<td data-datekey="${dateKey}" data-name="${escapeHTML(person.name)}" class="wish-cell border dark:border-slate-600 text-center cursor-pointer ${isSet ? "bg-purple-500 text-white" : ""}">${isSet ? "X" : ""}</td>`;
        });
        body += `${row}</tr>`;
    }

    container.innerHTML = `<h2 class="text-xl font-bold mb-4 text-purple-700 dark:text-purple-400 uppercase">${t('tab_wuensche')} / Sperren</h2><table class="w-full text-xs border-collapse">${head}${body}</table>`;

    document.querySelectorAll(".wish-cell").forEach(cell => {
        cell.addEventListener("click", async (e) => {
            const dateKey = e.target.dataset.datekey;
            const name = e.target.dataset.name;
            await createSnapshot();
            if (!state.wishes[dateKey]) state.wishes[dateKey] = [];
            state.wishes[dateKey] = state.wishes[dateKey].includes(name)
                ? state.wishes[dateKey].filter((item) => item !== name)
                : [...state.wishes[dateKey], name];
            await saveState();
            renderCalendar();
            renderWishMatrix();
        });
    });
}

export function renderValidation() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const summaryEl = document.getElementById("validationSummary");
    const listEl = document.getElementById("validationList");
    if (!summaryEl || !listEl) return;

    if (!monthValue) {
        summaryEl.innerHTML = "";
        listEl.innerHTML = `<div class="validation-empty">${t('validation_empty')}</div>`;
        return;
    }

    const issues = getValidationIssues(monthValue, state);
    const errorCount = issues.filter((issue) => issue.severity === "error").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
    const blockerCount = issues.filter((issue) => issue.blocks && issue.blocks.length).length;

    summaryEl.innerHTML = `
        <div class="validation-card validation-card-error dark:bg-red-900 dark:text-red-100">
            <strong>${errorCount}</strong>
            <span>${t('validation_error')}</span>
        </div>
        <div class="validation-card validation-card-warning dark:bg-yellow-900 dark:text-yellow-100">
            <strong>${warningCount}</strong>
            <span>${t('validation_warning')}</span>
        </div>
        <div class="validation-card ${blockerCount ? "validation-card-warning dark:bg-yellow-900 dark:text-yellow-100" : "validation-card-ok dark:bg-green-900 dark:text-green-100"}">
            <strong>${blockerCount}</strong>
            <span>Export-relevante Punkte</span>
        </div>`;

    if (!issues.length) {
        listEl.innerHTML = `<div class="validation-empty dark:bg-green-900 dark:text-green-100">${t('validation_no_issues')}</div>`;
        return;
    }

    const badgeClass = {
        error: "validation-badge validation-badge-error dark:bg-red-800 dark:text-red-100",
        warning: "validation-badge validation-badge-warning dark:bg-yellow-800 dark:text-yellow-100",
        info: "validation-badge validation-badge-info dark:bg-blue-800 dark:text-blue-100"
    };

    const rows = issues.map((issue) => {
        const exportInfo = issue.blocks?.length ? t('validation_blocks', issue.blocks.join(", ").toUpperCase()) : t('validation_no_blocks');
        const severityStr = issue.severity === "error" ? t('validation_error') : issue.severity === "warning" ? t('validation_warning') : t('validation_info');
        return `
            <tr class="validation-row-${issue.severity} dark:bg-slate-800">
                <td class="dark:border-slate-600"><span class="${badgeClass[issue.severity]}">${severityStr}</span></td>
                <td class="dark:border-slate-600 dark:text-slate-300">${escapeHTML(issue.area)}</td>
                <td class="dark:border-slate-600 dark:text-slate-300">${escapeHTML(issue.reference)}</td>
                <td class="dark:border-slate-600 dark:text-slate-300">${escapeHTML(issue.message)}<div class="validation-meta mt-1 dark:text-slate-400">${exportInfo}</div></td>
            </tr>`;
    }).join("");

    listEl.innerHTML = `
        <table class="validation-table dark:border-slate-600">
            <thead class="dark:bg-slate-700">
                <tr>
                    <th class="dark:border-slate-600 dark:text-slate-200">Status</th>
                    <th class="dark:border-slate-600 dark:text-slate-200">${t('validation_area')}</th>
                    <th class="dark:border-slate-600 dark:text-slate-200">${t('validation_ref')}</th>
                    <th class="dark:border-slate-600 dark:text-slate-200">${t('validation_desc')}</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
} else {
    bootstrap();
}

window.addEventListener("beforeunload", async () => {
    // Attempt Auto-Save Snapshot to History
    try {
        await createSnapshot();
    } catch {
        // Suppress on close
    }
});
