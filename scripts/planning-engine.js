import { appState } from './state.js';
import { matchesRole, getWorkPercent, getMonthDayKeys, isVisitDay, getDateKey, dateToKey, shiftDate, ensurePlanEntry, isVacationRow, getUniqueAssignedName, getRoleWeight, getVacationDoctorsForWeek, canAssignPersonToRole, getBestDoctorForDates, buildStationLoadCounters, syncDienstRowsFromPlan, planRoles, stationLayout } from './core.js';
import { createUndoSnapshot } from './storage.js';
import { getSelectedMonthValue, saveAndRenderPlanningViews, saveAndRenderStationView, showLoading, hideLoading } from './ui-common.js';

// Planning engine and automatic allocation rules.

export function fillPlanMonth(monthValue) {
    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthDayKeys = getMonthDayKeys(monthValue);
    const weeks = getWeeksInMonth(year, month);
    const blockedSplitAAKeys = new Set();
    const blockedWeekendOAKeys = new Set();

    monthDayKeys.forEach((dateKey) => {
        ensurePlanEntry(dateKey);
    });

    const counters = {};
    appState.staff.forEach((person) => {
        counters[person.name] = 0;
    });

    monthDayKeys.forEach((dateKey) => {
        planRoles.forEach((role) => {
            const assignedName = appState.plan[dateKey]?.[role];
            if (!assignedName) return;
            if (!Object.prototype.hasOwnProperty.call(counters, assignedName)) counters[assignedName] = 0;
            counters[assignedName] += getRoleWeight(role);
        });
    });

    const assignRoleIfEmpty = (dateKey, role, person) => {
        if (!person) return false;
        const entry = ensurePlanEntry(dateKey);
        if (entry[role]) return false;
        if (!canAssignPersonToRole(person, dateKey, role, weeks)) return false;

        entry[role] = person.name;
        if (!Object.prototype.hasOwnProperty.call(counters, person.name)) counters[person.name] = 0;
        counters[person.name] += getRoleWeight(role);
        return true;
    };

    const getBest = (role, dateKeys, excludedNames = []) => {
        const normalizedDateKeys = Array.isArray(dateKeys) ? dateKeys : [dateKeys];
        return getBestDoctorForDates(role, normalizedDateKeys, counters, weeks, excludedNames);
    };

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        const dayIndex = date.getDay();
        const dateKey = getDateKey(year, month, day);

        if (dayIndex === 5) {
            const weekendKeys = [0, 1, 2]
                .map((offset) => (day + offset <= daysInMonth ? getDateKey(year, month, day + offset) : null))
                .filter(Boolean);
            const fixedWeekendOA = getUniqueAssignedName(weekendKeys, "OA");
            if (fixedWeekendOA === false) weekendKeys.forEach((targetKey) => blockedWeekendOAKeys.add(targetKey));
            const weekendDoctor = fixedWeekendOA && fixedWeekendOA !== false
                ? appState.staff.find((person) => person.name === fixedWeekendOA)
                : fixedWeekendOA === false
                    ? null
                    : getBest("OA", weekendKeys);

            weekendKeys.forEach((targetKey) => {
                assignRoleIfEmpty(targetKey, "OA", weekendDoctor);
            });
        }

        if (!appState.plan[dateKey].OA && !blockedWeekendOAKeys.has(dateKey)) {
            assignRoleIfEmpty(dateKey, "OA", getBest("OA", dateKey));
        }

        if (dayIndex === 0) {
            const splitGroupAKeys = [0, 2, 4]
                .map((offset) => (day + offset <= daysInMonth ? getDateKey(year, month, day + offset) : null))
                .filter(Boolean);
            const fixedSplitA = getUniqueAssignedName(splitGroupAKeys, "AA");
            if (fixedSplitA === false) splitGroupAKeys.forEach((targetKey) => blockedSplitAAKeys.add(targetKey));
            const splitDoctorA = fixedSplitA && fixedSplitA !== false
                ? appState.staff.find((person) => person.name === fixedSplitA)
                : fixedSplitA === false
                    ? null
                    : getBest("AA", splitGroupAKeys);

            splitGroupAKeys.forEach((targetKey) => {
                assignRoleIfEmpty(targetKey, "AA", splitDoctorA);
            });

            const splitGroupBKeys = [1, 3, 5]
                .map((offset) => (day + offset <= daysInMonth ? getDateKey(year, month, day + offset) : null))
                .filter(Boolean);
            const fixedSplitB = getUniqueAssignedName(splitGroupBKeys, "AA");
            if (fixedSplitB === false) splitGroupBKeys.forEach((targetKey) => blockedSplitAAKeys.add(targetKey));
            const excludedForGroupB = fixedSplitB ? [] : splitDoctorA ? [splitDoctorA.name] : [];
            const splitDoctorB = fixedSplitB && fixedSplitB !== false
                ? appState.staff.find((person) => person.name === fixedSplitB)
                : fixedSplitB === false
                    ? null
                    : getBest("AA", splitGroupBKeys, excludedForGroupB);

            splitGroupBKeys.forEach((targetKey) => {
                assignRoleIfEmpty(targetKey, "AA", splitDoctorB);
            });
        }

        if (isVisitDay(date)) {
            if (!appState.plan[dateKey].AA && !blockedSplitAAKeys.has(dateKey)) {
                assignRoleIfEmpty(dateKey, "AA", getBest("AA", dateKey));
            }

            if (!appState.plan[dateKey].VISITE) {
                const excludedNames = appState.plan[dateKey].AA ? [appState.plan[dateKey].AA] : [];
                assignRoleIfEmpty(dateKey, "VISITE", getBest("VISITE", dateKey, excludedNames));
            }
        }

        if (!appState.plan[dateKey].AA && !blockedSplitAAKeys.has(dateKey)) {
            assignRoleIfEmpty(dateKey, "AA", getBest("AA", dateKey));
        }
    }

    syncDienstRowsFromPlan(monthValue, { preserveExisting: false });
}

export function autoPlan() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (!confirm("Moechten Sie den Autoplaner wirklich ausfuehren? Bereits eingetragene Dienste bleiben erhalten, freie Felder werden anhand der Regeln ergaenzt.")) return;

    showLoading();
    // Yield to let browser render the loading overlay
    setTimeout(() => {
        createUndoSnapshot(`Vor Autoplaner ${monthValue}`);
        fillPlanMonth(monthValue);
        const saveResult = saveAndRenderPlanningViews();
        hideLoading();
        if (saveResult.ok) alert("Planung ergaenzt. Bestehende Eingaben wurden beibehalten.");
    }, 50);
}

export function fillStationPlanMonth(monthValue) {
    const [year, month] = monthValue.split("-").map(Number);
    const weeks = getWeeksInMonth(year, month);
    const stationCounters = buildStationLoadCounters(weeks);

    syncDienstRowsFromPlan(monthValue, { preserveExisting: true });

    weeks.forEach((week) => {
        const blockedByVacation = getVacationDoctorsForWeek(week);
        const usedDocs = new Set();

        stationLayout.forEach((row) => {
            const value = appState.stationPlan[`${week.key}_${row.id}`];
            if (value) usedDocs.add(value);
        });

        const assignStationCellIfEmpty = (rowId, doctorName) => {
            if (!doctorName || blockedByVacation.has(doctorName)) return false;

            const cellKey = `${week.key}_${rowId}`;
            if (appState.stationPlan[cellKey]) return false;

            appState.stationPlan[cellKey] = doctorName;
            usedDocs.add(doctorName);
            if (!Object.prototype.hasOwnProperty.call(stationCounters, doctorName)) stationCounters[doctorName] = 0;
            stationCounters[doctorName] += 1;
            return true;
        };

        const getAvailableDoctor = (predicate) => {
            const available = appState.staff
                .filter((person) => predicate(person) && !usedDocs.has(person.name) && !blockedByVacation.has(person.name))
                .sort((a, b) => {
                    const loadA = (stationCounters[a.name] || 0) / getWorkPercent(a);
                    const loadB = (stationCounters[b.name] || 0) / getWorkPercent(b);
                    if (loadA !== loadB) return loadA - loadB;
                    if (getWorkPercent(b) !== getWorkPercent(a)) return getWorkPercent(b) - getWorkPercent(a);
                    return a.name.localeCompare(b.name, "de-DE");
                });

            const picked = available[0]?.name;
            return picked || null;
        };

        stationLayout.forEach((row) => {
            if (row.id === "hkl" || row.id.startsWith("echo_") || row.id.startsWith("da_") || isVacationRow(row)) return;

            const cellKey = `${week.key}_${row.id}`;
            if (appState.stationPlan[cellKey]) return;

            let doctor = null;
            if (row.id.startsWith("epu_")) doctor = getAvailableDoctor((person) => matchesRole(person, "EPU"));
            else if (row.id.startsWith("oa_")) doctor = getAvailableDoctor((person) => matchesRole(person, "OA"));
            else if (row.category.includes("Station") || row.id === "cpu" || row.id === "tk") {
                doctor = getAvailableDoctor((person) => matchesRole(person, "AA"));
            }

            if (doctor) assignStationCellIfEmpty(row.id, doctor);
        });

        stationLayout.forEach((row) => {
            if (row.id !== "hkl" && !row.id.startsWith("echo_")) return;

            const cellKey = `${week.key}_${row.id}`;
            if (appState.stationPlan[cellKey]) return;

            const doctor = getAvailableDoctor((person) => matchesRole(person, "AA"));
            if (doctor) assignStationCellIfEmpty(row.id, doctor);
        });
    });
}

export function autoStationPlan() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (!confirm("Moechten Sie den Stationsplan automatisch besetzen? Bestehende Eintraege bleiben erhalten, freie Felder werden ergaenzt. Urlaub bleibt erhalten.")) return;

    showLoading();
    // Yield to let browser render the loading overlay
    setTimeout(() => {
        createUndoSnapshot(`Vor Auto-Stationsplan ${monthValue}`);
        fillStationPlanMonth(monthValue);
        const saveResult = saveAndRenderStationView();
        hideLoading();
        if (saveResult.ok) alert("Stationsplan erfolgreich, soweit moeglich, ergaenzt.");
    }, 50);
}


export function getWeeksInMonth(year, month) {
    const weeks = [];
    const date = new Date(year, month - 1, 1);

    while (date.getDay() !== 1) {
        date.setDate(date.getDate() - 1);
    }

    const cursor = new Date(date);
    const endMonth = new Date(year, month, 0);

    while (cursor <= endMonth) {
        const isoDate = new Date(cursor);
        isoDate.setHours(0, 0, 0, 0);
        isoDate.setDate(isoDate.getDate() + 4 - (isoDate.getDay() || 7));
        const isoYear = isoDate.getFullYear();
        const yearStart = new Date(isoDate.getFullYear(), 0, 1);
        const weekOne = new Date(yearStart);
        weekOne.setDate(weekOne.getDate() + 4 - (weekOne.getDay() || 7));
        const weekNumber = 1 + Math.round(((isoDate.getTime() - weekOne.getTime()) / 86400000 - 3 + (weekOne.getDay() + 6) % 7) / 7);
        const mondayDate = new Date(cursor);
        mondayDate.setHours(0, 0, 0, 0);
        const sundayDate = shiftDate(mondayDate, 6);
        const sundayBefore = shiftDate(mondayDate, -1);

        weeks.push({
            kw: weekNumber,
            mondayDateStr: `${String(cursor.getDate()).padStart(2, "0")}.${String(cursor.getMonth() + 1).padStart(2, "0")}.${String(cursor.getFullYear()).slice(-2)}`,
            key: `${isoYear}-KW${String(weekNumber).padStart(2, "0")}`,
            mondayDate,
            sundayDate,
            dienstGroupA: [
                dateToKey(mondayDate),
                dateToKey(shiftDate(mondayDate, 2)),
                dateToKey(shiftDate(mondayDate, 4))
            ],
            dienstGroupB: [
                dateToKey(sundayBefore),
                dateToKey(shiftDate(mondayDate, 1)),
                dateToKey(shiftDate(mondayDate, 3))
            ]
        });
        cursor.setDate(cursor.getDate() + 7);
    }

    return weeks;
}

