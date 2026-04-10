// Shared domain constants and pure helper functions.

const defaultAtossHours = {
    AA: { weekday: 17, weekendHoliday: 17 },
    VISITE: { weekday: 5, weekendHoliday: 5 },
    OA: { weekday: 17, weekendHoliday: 17 }
};

const roleLabels = {
    AA: "24h Dienst (AA)",
    VISITE: "Visite (WE/FT)",
    OA: "Hintergrund (OA)"
};

const planRoles = ["AA", "VISITE", "OA"];
const autoAdjacentDayBlockRoles = ["AA", "VISITE"];

const stationLayout = [
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

function matchesRole(person, role) {
    if (role === "OA") return person.role === "OA" || person.role === "OA-EPU";
    if (role === "EPU") return person.role === "OA-EPU";
    return person.role === "AA";
}

function getWorkPercent(person) {
    const parsed = Number(person?.work);
    return parsed > 0 ? parsed : 100;
}

function normalizeAtossId(value) {
    return String(value || "").trim().toUpperCase();
}

function normalizeHourValue(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeAtossHours(source = {}) {
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

function getPersonValidationError(candidate, dataStaff = staff) {
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

function getDuplicateAtossAssignments(dataStaff = staff) {
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

function getMonthDayKeys(monthValue) {
    if (!monthValue) return [];
    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
        return `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    });
}

function getDateFromKey(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatDateKey(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-");
    return `${day}.${month}.${year}`;
}

function getCurrentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getEasterSunday(year) {
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

function getHolidayName(date, holidayMode = holidaySeasonMode) {
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

function isHoliday(date) {
    return getHolidayName(date, holidaySeasonMode);
}

function isVisitDay(date, holidayMode = holidaySeasonMode) {
    return isWeekendOrHoliday(date, holidayMode);
}

function isWeekendOrHoliday(date, holidayMode = holidaySeasonMode) {
    return date.getDay() === 0 || date.getDay() === 6 || Boolean(getHolidayName(date, holidayMode));
}

function isRoleActiveOnDate(role, date, holidayMode = holidaySeasonMode) {
    return role !== "VISITE" || isVisitDay(date, holidayMode);
}

function isRoleActiveOnDateKey(role, dateKey, holidayMode = holidaySeasonMode) {
    return isRoleActiveOnDate(role, getDateFromKey(dateKey), holidayMode);
}

function getICSStartTime(dateKey, role, holidayMode = holidaySeasonMode) {
    if (role === "VISITE") return "090000";
    return isWeekendOrHoliday(getDateFromKey(dateKey), holidayMode) ? "090000" : "150000";
}

function escapeICSText(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}

function cloneStateValue(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getDateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateToKey(date) {
    return getDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function shiftDate(date, offset) {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + offset);
    shifted.setHours(0, 0, 0, 0);
    return shifted;
}

function shiftDateKey(dateKey, offset) {
    return dateToKey(shiftDate(getDateFromKey(dateKey), offset));
}

function createPlanEntry(existing = {}) {
    return {
        AA: existing.AA || "",
        VISITE: existing.VISITE || "",
        OA: existing.OA || ""
    };
}

function ensurePlanEntry(dateKey) {
    plan[dateKey] = createPlanEntry(plan[dateKey]);
    return plan[dateKey];
}

function isVacationRow(row) {
    return row.category.includes("Urlaub") || row.category.includes("Zeitausgleich");
}

function getAssignedNamesForDates(dateKeys, role, dataPlan = plan) {
    return [...new Set(dateKeys.map((dateKey) => dataPlan[dateKey]?.[role]).filter(Boolean))];
}

function getUniqueAssignedName(dateKeys, role, dataPlan = plan) {
    const names = getAssignedNamesForDates(dateKeys, role, dataPlan);
    if (!names.length) return null;
    return names.length === 1 ? names[0] : false;
}

function getRoleWeight(role) {
    return role === "VISITE" ? 0.2 : 1;
}

function getWeekForDate(date, weeks) {
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return weeks.find((week) => compareDate >= week.mondayDate && compareDate <= week.sundayDate) || null;
}

function getVacationDoctorsForWeek(week, dataStationPlan = stationPlan) {
    const blocked = new Set();
    stationLayout.forEach((row) => {
        if (!isVacationRow(row)) return;
        const value = dataStationPlan[`${week.key}_${row.id}`];
        if (value) blocked.add(value);
    });
    return blocked;
}

function getVacationDoctorsForDate(dateKey, weeks, dataStationPlan = stationPlan) {
    const week = getWeekForDate(getDateFromKey(dateKey), weeks);
    return week ? getVacationDoctorsForWeek(week, dataStationPlan) : new Set();
}

function hasVacationDutyConflict(personName, dateKey, weeks, dataStationPlan = stationPlan) {
    if (!personName) return false;
    return getVacationDoctorsForDate(dateKey, weeks, dataStationPlan).has(personName);
}

function hasSameDayRoleConflict(personName, dateKey, role, dataPlan = plan) {
    return planRoles.some((roleKey) => roleKey !== role && dataPlan[dateKey]?.[roleKey] === personName);
}

function hasAdjacentDayConflict(personName, dateKey, dataPlan = plan, roleKeys = planRoles) {
    return [-1, 1].some((offset) => {
        const adjacentEntry = dataPlan[shiftDateKey(dateKey, offset)];
        return adjacentEntry && roleKeys.some((roleKey) => adjacentEntry[roleKey] === personName);
    });
}

function canAssignPersonToRole(
    person,
    dateKey,
    role,
    weeks,
    dataPlan = plan,
    dataWishes = wishes,
    dataStationPlan = stationPlan,
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

function getBestDoctorForDates(role, dateKeys, counters, weeks, excludedNames = []) {
    const normalizedDateKeys = [...new Set(dateKeys.filter(Boolean))];
    if (!normalizedDateKeys.length) return null;

    const candidates = staff
        .filter((person) => matchesRole(person, role) && !excludedNames.includes(person.name))
        .map((person) => {
            const fillableCount = normalizedDateKeys.filter((dateKey) => {
                return canAssignPersonToRole(person, dateKey, role, weeks, plan, wishes, stationPlan, excludedNames);
            }).length;

            if (!fillableCount) return null;

            const adjacencyPenalty = normalizedDateKeys.reduce((penalty, dateKey) => {
                const roleKeys = role === "OA" ? planRoles : autoAdjacentDayBlockRoles;
                return penalty + (hasAdjacentDayConflict(person.name, dateKey, plan, roleKeys) ? 1 : 0);
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

function buildStationLoadCounters(weeks, dataStationPlan = stationPlan) {
    const counters = {};
    staff.forEach((person) => {
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

function syncDienstRowsFromPlan(monthValue, options = {}) {
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
                if (!preserveExisting) delete stationPlan[cellKey];
                return;
            }

            if (preserveExisting && stationPlan[cellKey]) return;
            stationPlan[cellKey] = derivedDoctor;
        });
    });
}

function parseStationCellKey(cellKey) {
    const [weekKey, ...rowParts] = String(cellKey || "").split("_");
    return {
        weekKey,
        rowId: rowParts.join("_")
    };
}

function getWeekForStationCellKey(cellKey, monthValue) {
    const { weekKey, rowId } = parseStationCellKey(cellKey);
    if (!weekKey || !rowId || !monthValue) return { week: null, rowId };

    const [year, month] = monthValue.split("-").map(Number);
    const week = getWeeksInMonth(year, month).find((entry) => entry.key === weekKey) || null;
    return { week, rowId };
}

function getDienstDateKeysForRow(week, rowId) {
    if (!week) return [];
    if (rowId === "da_1") return week.dienstGroupA;
    if (rowId === "da_2") return week.dienstGroupB;
    return [];
}

function applyDienstRowToPlan(monthValue, cellKey, doctorName) {
    const { week, rowId } = getWeekForStationCellKey(cellKey, monthValue);
    const dateKeys = getDienstDateKeysForRow(week, rowId);
    if (!dateKeys.length || !doctorName) return false;

    dateKeys.forEach((dateKey) => {
        const entry = ensurePlanEntry(dateKey);
        entry.AA = doctorName;
    });

    return true;
}

function withTemporaryState(source, callback) {
    const previousState = {
        staff,
        plan,
        wishes,
        stationPlan,
        holidaySeasonMode,
        atossHours,
        undoSnapshots
    };

    try {
        if (Object.prototype.hasOwnProperty.call(source, "staff")) staff = cloneStateValue(source.staff) || [];
        if (Object.prototype.hasOwnProperty.call(source, "plan")) plan = cloneStateValue(source.plan) || {};
        if (Object.prototype.hasOwnProperty.call(source, "wishes")) wishes = cloneStateValue(source.wishes) || {};
        if (Object.prototype.hasOwnProperty.call(source, "stationPlan")) stationPlan = cloneStateValue(source.stationPlan) || {};
        if (Object.prototype.hasOwnProperty.call(source, "holidaySeasonMode")) holidaySeasonMode = Boolean(source.holidaySeasonMode);
        if (Object.prototype.hasOwnProperty.call(source, "atossHours")) atossHours = normalizeAtossHours(source.atossHours);
        if (Object.prototype.hasOwnProperty.call(source, "undoSnapshots")) undoSnapshots = normalizeUndoSnapshots(source.undoSnapshots);

        return callback();
    } finally {
        staff = previousState.staff;
        plan = previousState.plan;
        wishes = previousState.wishes;
        stationPlan = previousState.stationPlan;
        holidaySeasonMode = previousState.holidaySeasonMode;
        atossHours = previousState.atossHours;
        undoSnapshots = previousState.undoSnapshots;
    }
}
