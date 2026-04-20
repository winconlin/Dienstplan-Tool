import { appState } from './state.js';
import { normalizeUndoSnapshots } from './storage.js';
import { getWeeksInMonth } from './planning-engine.js';


export function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export function initializeState(readStorageFn) {
    appState.staff = readStorageFn("mp_staff", []);
    appState.plan = readStorageFn("mp_plan", {});
    appState.wishes = readStorageFn("mp_wishes", {});
    appState.stationPlan = readStorageFn("mp_station", {});
    appState.stationLayout = readStorageFn("mp_station_layout", null);
    appState.holidaySeasonMode = readStorageFn("mp_holiday_mode", false);
    appState.atossHours = readStorageFn("mp_atoss_hours", appState.atossHours);
    appState.undoSnapshots = readStorageFn("mp_undo_snapshots", []);
    if (appState.stationLayout && Array.isArray(appState.stationLayout)) {
        updateStationLayout(appState.stationLayout);
    }
}

// Shared domain constants and pure helper functions.

export const defaultAtossHours = {
    AA: { weekday: 17, weekendHoliday: 17 },
    VISITE: { weekday: 5, weekendHoliday: 5 },
    OA: { weekday: 17, weekendHoliday: 17 }
};

export const roleLabels = {
    AA: "24h Dienst (AA)",
    VISITE: "Visite (WE/FT)",
    OA: "Hintergrund (OA)"
};

export const planRoles = ["AA", "VISITE", "OA"];
export const autoAdjacentDayBlockRoles = ["AA", "VISITE"];

export const defaultStationLayout = [
    { id: "s71_1", name: "Zimmer 1-4", category: "Station 7 - 1" },
    { id: "s71_2", name: "Zimmer 5-8", category: "Station 7 - 1" },
    { id: "s71_3", name: "Zimmer 13-18", category: "Station 7 - 1" },
    { id: "s51_1", name: "Zimmer 8-10", category: "Station 5 - 1" },
    { id: "s51_2", name: "Zimmer 11-14", category: "Station 5 - 1" },
    { id: "hkl", name: "HKL", category: "HKL" },
    { id: "cpu", name: "CPU", category: "CPU" },
    { id: "tk", name: "Tagesklinik/UKG", category: "Tagesklinik/UKG" },
    { id: "echo_1", name: "Echokardiographie", category: "Echokardiographie" },
    { id: "echo_2", name: "Echokardiographie", category: "Echokardiographie" },
    { id: "oa_1", name: "Oberaerzte", category: "Oberaerzte" },
    { id: "oa_2", name: "Oberaerzte", category: "Oberaerzte" },
    { id: "oa_3", name: "Oberaerzte", category: "Oberaerzte" },
    { id: "oa_4", name: "Oberaerzte", category: "Oberaerzte" },
    { id: "oa_5", name: "Oberaerzte", category: "Oberaerzte" },
    { id: "oa_6", name: "Oberaerzte", category: "Oberaerzte" },
    { id: "epu_1", name: "EPU", category: "EPU" },
    { id: "epu_2", name: "EPU", category: "EPU" },
    { id: "da_1", name: "Mo, Mi, Fr", category: "Dienstaerzte" },
    { id: "da_2", name: "So, Di, Do", category: "Dienstaerzte" },
    { id: "u1", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u2", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u3", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u4", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u5", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u6", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" }
];

export let stationLayout = [...defaultStationLayout];

export function updateStationLayout(newLayout) {
    stationLayout = newLayout;
}

export function matchesRole(person, role) {
    if (role === "OA") return person.role === "OA";
    if (role === "OA_STATION") return person.role === "OA" || person.role === "OA-EPU" || person.role === "FOA" || person.role === "FOA-EPU";
    if (role === "EPU") return person.role === "OA-EPU" || person.role === "FOA-EPU";
    return person.role === "AA" || person.role === "FOA" || person.role === "FOA-EPU";
}

export function getWorkPercent(person) {
    const parsed = Number(person?.work);
    return parsed > 0 ? parsed : 100;
}

export function normalizeAtossId(value) {
    return String(value || "").trim().toUpperCase();
}

export function normalizeHourValue(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normalizeAtossHours(source = {}) {
    const normalized = {};

    Object.entries(defaultAtossHours).forEach(([role, defaults]) => {
        const roleSource = isPlainObject(source?.[role]) ? source[role] : {};
        normalized[role] = {
            weekday: normalizeHourValue(roleSource.weekday, defaults.weekday),
            weekendHoliday: normalizeHourValue(roleSource.weekendHoliday, defaults.weekendHoliday)
        };
    });

    return normalized;
}

export function getPersonValidationError(candidate, dataStaff = appState.staff) {
    const name = String(candidate?.name || "").trim();
    const normalizedId = normalizeAtossId(candidate?.id);

    if (!name) return "Bitte einen Namen eingeben.";
    if (dataStaff.some((person) => person.name.toLowerCase() === name.toLowerCase())) {
        return "Dieser Name ist bereits angelegt.";
    }

    if (normalizedId && dataStaff.some((person) => normalizeAtossId(person.id) === normalizedId)) {
        return `Die Atoss-ID ${normalizedId} ist bereits vergeben.`;
    }

    return "";
}

export function getDuplicateAtossAssignments(dataStaff = appState.staff) {
    const assignments = {};

    dataStaff.forEach((person) => {
        const normalizedId = normalizeAtossId(person.id);
        if (!normalizedId) return;
        if (!assignments[normalizedId]) assignments[normalizedId] = [];
        assignments[normalizedId].push(person.name);
    });

    return Object.entries(assignments)
        .filter(([, names]) => names.length > 1)
        .map(([id, names]) => ({ id, names }));
}

export function getMonthDayKeys(monthValue) {
    if (!monthValue) return [];
    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
        return `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    });
}

export function getDateFromKey(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function formatDateKey(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-");
    return `${day}.${month}.${year}`;
}

export function getCurrentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

export function getHolidayName(date, holidayMode = appState.holidaySeasonMode) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const fixedHolidays = {
        "1.1": "Neujahr",
        "6.1": "Hl. 3 Koenige",
        "1.5": "Tag d. Arbeit",
        "15.8": "Mariae Himmelfahrt",
        "3.10": "Tag d. Dt. Einheit",
        "1.11": "Allerheiligen",
        "25.12": "1. Weihnachtstag",
        "26.12": "2. Weihnachtstag"
    };

    if (holidayMode) {
        const start = new Date(year, 11, 24);
        while (start.getDay() !== 6) start.setDate(start.getDate() - 1);

        const end = month === 1 && day <= 15 ? new Date(year, 0, 6) : new Date(year + 1, 0, 6);
        while (end.getDay() !== 0) end.setDate(end.getDate() + 1);

        if (date >= start && date <= end) return "Winterplan";
    }

    const fixedName = fixedHolidays[`${day}.${month}`];
    if (fixedName) return fixedName;

    const easter = getEasterSunday(year);
    const diff = Math.round((date - easter) / 86400000);
    if (diff === -2) return "Karfreitag";
    if (diff === 1) return "Ostermontag";
    if (diff === 39) return "Christi Himmelfahrt";
    if (diff === 50) return "Pfingstmontag";
    if (diff === 60) return "Fronleichnam";

    const bussUndBettag = new Date(year, 10, 22);
    while (bussUndBettag.getDay() !== 3) bussUndBettag.setDate(bussUndBettag.getDate() - 1);
    if (day === bussUndBettag.getDate() && month === 11) return "Buss- & Bettag";

    return null;
}

export function isHoliday(date) {
    return getHolidayName(date, appState.holidaySeasonMode);
}

export function isVisitDay(date, holidayMode = appState.holidaySeasonMode) {
    return isWeekendOrHoliday(date, holidayMode);
}

export function isWeekendOrHoliday(date, holidayMode = appState.holidaySeasonMode) {
    return date.getDay() === 0 || date.getDay() === 6 || Boolean(getHolidayName(date, holidayMode));
}

export function isRoleActiveOnDate(role, date, holidayMode = appState.holidaySeasonMode) {
    return role !== "VISITE" || isVisitDay(date, holidayMode);
}

export function isRoleActiveOnDateKey(role, dateKey, holidayMode = appState.holidaySeasonMode) {
    return isRoleActiveOnDate(role, getDateFromKey(dateKey), holidayMode);
}

export function getICSStartTime(dateKey, role, holidayMode = appState.holidaySeasonMode) {
    if (role === "VISITE") return "090000";
    return isWeekendOrHoliday(getDateFromKey(dateKey), holidayMode) ? "090000" : "150000";
}

export function escapeICSText(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}

export function cloneStateValue(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getDateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateToKey(date) {
    return getDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function shiftDate(date, offset) {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + offset);
    shifted.setHours(0, 0, 0, 0);
    return shifted;
}

export function shiftDateKey(dateKey, offset) {
    return dateToKey(shiftDate(getDateFromKey(dateKey), offset));
}

export function createPlanEntry(existing = {}) {
    return {
        AA: existing.AA || "",
        VISITE: existing.VISITE || "",
        OA: existing.OA || ""
    };
}

export function ensurePlanEntry(dateKey) {
    appState.plan[dateKey] = createPlanEntry(appState.plan[dateKey]);
    return appState.plan[dateKey];
}

export function isVacationRow(row) {
    return row.category.includes("Urlaub") || row.category.includes("Zeitausgleich");
}

export function getAssignedNamesForDates(dateKeys, role, dataPlan = appState.plan) {
    return [...new Set(dateKeys.map((dateKey) => dataPlan[dateKey]?.[role]).filter(Boolean))];
}

export function getUniqueAssignedName(dateKeys, role, dataPlan = appState.plan) {
    const names = getAssignedNamesForDates(dateKeys, role, dataPlan);
    if (!names.length) return null;
    return names.length === 1 ? names[0] : false;
}

export function getRoleWeight(role) {
    return role === "VISITE" ? 0.2 : 1;
}

export function getWeekForDate(date, weeks) {
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return weeks.find((week) => compareDate >= week.mondayDate && compareDate <= week.sundayDate) || null;
}

export function getVacationDoctorsForWeek(week, dataStationPlan = appState.stationPlan) {
    const blocked = new Set();
    stationLayout.forEach((row) => {
        if (!isVacationRow(row)) return;
        const value = dataStationPlan[`${week.key}_${row.id}`];
        if (value) blocked.add(value);
    });
    return blocked;
}

export function getVacationDoctorsForDate(dateKey, weeks, dataStationPlan = appState.stationPlan) {
    const week = getWeekForDate(getDateFromKey(dateKey), weeks);
    return week ? getVacationDoctorsForWeek(week, dataStationPlan) : new Set();
}

export function hasVacationDutyConflict(personName, dateKey, weeks, dataStationPlan = appState.stationPlan) {
    if (!personName) return false;
    return getVacationDoctorsForDate(dateKey, weeks, dataStationPlan).has(personName);
}

export function hasSameDayRoleConflict(personName, dateKey, role, dataPlan = appState.plan) {
    return planRoles.some((roleKey) => roleKey !== role && dataPlan[dateKey]?.[roleKey] === personName);
}

export function hasAdjacentDayConflict(personName, dateKey, dataPlan = appState.plan, roleKeys = planRoles) {
    return [-1, 1].some((offset) => {
        const adjacentEntry = dataPlan[shiftDateKey(dateKey, offset)];
        return adjacentEntry && roleKeys.some((roleKey) => adjacentEntry[roleKey] === personName);
    });
}

export function canAssignPersonToRole(
    person,
    dateKey,
    role,
    weeks,
    dataPlan = appState.plan,
    dataWishes = appState.wishes,
    dataStationPlan = appState.stationPlan,
    excludedNames = []
) {
    if (!person || !matchesRole(person, role) || excludedNames.includes(person.name)) return false;
    if ((dataWishes[dateKey] || []).includes(person.name)) return false;
    if (getVacationDoctorsForDate(dateKey, weeks, dataStationPlan).has(person.name)) return false;

    const currentValue = dataPlan[dateKey]?.[role] || "";
    if (currentValue && currentValue !== person.name) return false;
    if (hasSameDayRoleConflict(person.name, dateKey, role, dataPlan)) return false;
    if (autoAdjacentDayBlockRoles.includes(role) && hasAdjacentDayConflict(person.name, dateKey, dataPlan, autoAdjacentDayBlockRoles)) return false;

    return true;
}

export function getBestDoctorForDates(role, dateKeys, counters, weeks, excludedNames = []) {
    const normalizedDateKeys = [...new Set(dateKeys.filter(Boolean))];
    if (!normalizedDateKeys.length) return null;

    const candidates = appState.staff
        .filter((person) => matchesRole(person, role) && !excludedNames.includes(person.name))
        .map((person) => {
            const fillableCount = normalizedDateKeys.filter((dateKey) => {
                return canAssignPersonToRole(person, dateKey, role, weeks, appState.plan, appState.wishes, appState.stationPlan, excludedNames);
            }).length;

            if (!fillableCount) return null;

            const adjacencyPenalty = normalizedDateKeys.reduce((penalty, dateKey) => {
                const roleKeys = role === "OA" ? planRoles : autoAdjacentDayBlockRoles;
                return penalty + (hasAdjacentDayConflict(person.name, dateKey, appState.plan, roleKeys) ? 1 : 0);
            }, 0);

            return {
                person,
                fillableCount,
                score: ((counters[person.name] || 0) / getWorkPercent(person)) + adjacencyPenalty * 1000
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (b.fillableCount !== a.fillableCount) return b.fillableCount - a.fillableCount;
            if (a.score !== b.score) return a.score - b.score;
            if (getWorkPercent(b.person) !== getWorkPercent(a.person)) return getWorkPercent(b.person) - getWorkPercent(a.person);
            return a.person.name.localeCompare(b.person.name, "de-DE");
        });

    return candidates[0]?.person || null;
}

export function buildStationLoadCounters(weeks, dataStationPlan = appState.stationPlan) {
    const counters = {};
    appState.staff.forEach((person) => {
        counters[person.name] = 0;
    });

    weeks.forEach((week) => {
        stationLayout.forEach((row) => {
            if (isVacationRow(row)) return;
            const value = dataStationPlan[`${week.key}_${row.id}`];
            if (!value) return;
            if (!Object.prototype.hasOwnProperty.call(counters, value)) counters[value] = 0;
            counters[value] += 1;
        });
    });

    return counters;
}

export function syncDienstRowsFromPlan(monthValue, options = {}) {
    if (!monthValue) return;

    const { preserveExisting = true } = options;
    const [year, month] = monthValue.split("-").map(Number);
    const weeks = getWeeksInMonth(year, month);

    weeks.forEach((week) => {
        const blockedByVacation = getVacationDoctorsForWeek(week);
        [
            ["da_1", week.dienstGroupA],
            ["da_2", week.dienstGroupB]
        ].forEach(([rowId, dateKeys]) => {
            const derivedDoctor = getUniqueAssignedName(dateKeys, "AA");
            const cellKey = `${week.key}_${rowId}`;

            if (!derivedDoctor || derivedDoctor === false || blockedByVacation.has(derivedDoctor)) {
                if (!preserveExisting) delete appState.stationPlan[cellKey];
                return;
            }

            if (preserveExisting && appState.stationPlan[cellKey]) return;
            appState.stationPlan[cellKey] = derivedDoctor;
        });
    });
}

export function parseStationCellKey(cellKey) {
    const [weekKey, ...rowParts] = String(cellKey || "").split("_");
    return {
        weekKey,
        rowId: rowParts.join("_")
    };
}

export function getWeekForStationCellKey(cellKey, monthValue) {
    const { weekKey, rowId } = parseStationCellKey(cellKey);
    if (!weekKey || !rowId || !monthValue) return { week: null, rowId };

    const [year, month] = monthValue.split("-").map(Number);
    const week = getWeeksInMonth(year, month).find((entry) => entry.key === weekKey) || null;
    return { week, rowId };
}

export function getDienstDateKeysForRow(week, rowId) {
    if (!week) return [];
    if (rowId === "da_1") return week.dienstGroupA;
    if (rowId === "da_2") return week.dienstGroupB;
    return [];
}

export function applyDienstRowToPlan(monthValue, cellKey, doctorName) {
    const { week, rowId } = getWeekForStationCellKey(cellKey, monthValue);
    const dateKeys = getDienstDateKeysForRow(week, rowId);
    if (!dateKeys.length || !doctorName) return false;

    dateKeys.forEach((dateKey) => {
        const entry = ensurePlanEntry(dateKey);
        entry.AA = doctorName;
    });

    return true;
}

export function withTemporaryState(source, callback) {
    const previousState = {
        staff: appState.staff,
        plan: appState.plan,
        wishes: appState.wishes,
        stationPlan: appState.stationPlan,
        holidaySeasonMode: appState.holidaySeasonMode,
        atossHours: appState.atossHours,
        undoSnapshots: appState.undoSnapshots
    };

    try {
        if (Object.prototype.hasOwnProperty.call(source, "staff")) appState.staff = cloneStateValue(source.staff) || [];
        if (Object.prototype.hasOwnProperty.call(source, "plan")) appState.plan = cloneStateValue(source.plan) || {};
        if (Object.prototype.hasOwnProperty.call(source, "wishes")) appState.wishes = cloneStateValue(source.wishes) || {};
        if (Object.prototype.hasOwnProperty.call(source, "stationPlan")) appState.stationPlan = cloneStateValue(source.stationPlan) || {};
        if (Object.prototype.hasOwnProperty.call(source, "holidaySeasonMode")) appState.holidaySeasonMode = Boolean(source.holidaySeasonMode);
        if (Object.prototype.hasOwnProperty.call(source, "atossHours")) appState.atossHours = normalizeAtossHours(source.atossHours);
        if (Object.prototype.hasOwnProperty.call(source, "undoSnapshots")) appState.undoSnapshots = normalizeUndoSnapshots(source.undoSnapshots);

        return callback();
    } finally {
        appState.staff = previousState.staff;
        appState.plan = previousState.plan;
        appState.wishes = previousState.wishes;
        appState.stationPlan = previousState.stationPlan;
        appState.holidaySeasonMode = previousState.holidaySeasonMode;
        appState.atossHours = previousState.atossHours;
        appState.undoSnapshots = previousState.undoSnapshots;
    }
}
