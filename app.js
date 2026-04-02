function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

let staff = readStorage("mp_staff", []);
let plan = readStorage("mp_plan", {});
let wishes = readStorage("mp_wishes", {});
let stationPlan = readStorage("mp_station", {});
let holidaySeasonMode = readStorage("mp_holiday_mode", false);

const roleLabels = {
    AA: "24h Dienst (AA)",
    VISITE: "Visite (WE/FT)",
    OA: "Hintergrund (OA)"
};

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
    { id: "oa_1", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_2", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_3", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_4", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_5", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_6", name: "Oberärzte", category: "Oberärzte" },
    { id: "epu_1", name: "EPU", category: "EPU" },
    { id: "epu_2", name: "EPU", category: "EPU" },
    { id: "da_1", name: "Mo, Mi, Fr", category: "Dienstärzte" },
    { id: "da_2", name: "So, Di, Do", category: "Dienstärzte" },
    { id: "u1", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u2", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u3", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u4", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u5", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u6", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" }
];

function save() {
    localStorage.setItem("mp_staff", JSON.stringify(staff));
    localStorage.setItem("mp_plan", JSON.stringify(plan));
    localStorage.setItem("mp_wishes", JSON.stringify(wishes));
    localStorage.setItem("mp_station", JSON.stringify(stationPlan));
    localStorage.setItem("mp_holiday_mode", JSON.stringify(holidaySeasonMode));
}

function saveHolidaySeasonMode() {
    const checkbox = document.getElementById("holidaySeasonMode");
    holidaySeasonMode = checkbox ? checkbox.checked : false;
    save();
}

function matchesRole(person, role) {
    if (role === "OA") return person.role === "OA" || person.role === "FOA";
    if (role === "EPU") return person.role === "OA-EPU" || person.role === "FOA-EPU";
    return person.role === "AA" || person.role === "FOA" || person.role === "FOA-EPU";
}

function getWorkPercent(person) {
    const parsed = Number(person.work);
    return parsed > 0 ? parsed : 100;
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
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-");
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
        "6.1": "Hl. 3 Könige",
        "1.5": "Tag d. Arbeit",
        "15.8": "Mariä Himmelfahrt",
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
    if (day === bussUndBettag.getDate() && month === 11) return "Buß- & Bettag";

    return null;
}

function isHoliday(date) {
    return getHolidayName(date, holidaySeasonMode);
}

function isVisitDay(date, holidayMode = holidaySeasonMode) {
    return date.getDay() === 0 || date.getDay() === 6 || Boolean(getHolidayName(date, holidayMode));
}

function isWeekendOrHoliday(date, holidayMode = holidaySeasonMode) {
    return date.getDay() === 0 || date.getDay() === 6 || Boolean(getHolidayName(date, holidayMode));
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

function clearMonth() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (!confirm("Möchten Sie den gesamten Plan für diesen Monat unwiderruflich löschen?")) return;

    getMonthDayKeys(monthValue).forEach((dayKey) => {
        plan[dayKey] = { AA: "", VISITE: "", OA: "" };
    });
    save();
    renderCalendar();
}

function clearWishes() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (!confirm("Möchten Sie alle Wünsche und Sperren für diesen Monat löschen?")) return;

    getMonthDayKeys(monthValue).forEach((dayKey) => delete wishes[dayKey]);
    save();
    renderCalendar();
}

function runAutoPlaner() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (!confirm("Möchten Sie den kombinierten Autoplaner ausführen? Der Stationsplan und Dienstplan werden (soweit möglich) neu berechnet und bestehende Einträge überschrieben. Urlaub bleibt erhalten.")) return;

    // --- STATION PLAN LOGIC ---
    const [year, month] = monthValue.split("-").map(Number);
    const planWeeks = getWeeksInMonth(year, month);

    planWeeks.forEach((week) => {
        const parts = week.mondayDateStr.split(".");
        const fullYear = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const weekStartDate = new Date(Number(fullYear), Number(parts[1]) - 1, Number(parts[0]));

        const monday = new Date(weekStartDate);
        const sunday = new Date(weekStartDate);
        sunday.setDate(sunday.getDate() - 1);

        const mondayKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
        const sundayKey = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

        const splitAA_Monday = plan[mondayKey]?.AA || null;
        const splitAA_Sunday = plan[sundayKey]?.AA || null;
        const dienstRowA = stationLayout.find((row) => row.id === "da_1");
        const dienstRowB = stationLayout.find((row) => row.id === "da_2");

        const blockedByVacation = new Set();
        stationLayout.forEach((row) => {
            if (!row.category.includes("Urlaub") && !row.category.includes("Zeitausgleich")) return;
            const value = stationPlan[`${week.key}_${row.id}`];
            if (value) blockedByVacation.add(value);
        });

        if (splitAA_Monday && dienstRowA) stationPlan[`${week.key}_${dienstRowA.id}`] = splitAA_Monday;
        if (splitAA_Sunday && dienstRowB) stationPlan[`${week.key}_${dienstRowB.id}`] = splitAA_Sunday;

        const usedDocs = new Set();
        stationLayout.forEach((row) => {
            const value = stationPlan[`${week.key}_${row.id}`];
            if (value) usedDocs.add(value);
        });

        const getAvailableDoctor = (predicate) => {
            const available = staff.filter((person) => predicate(person) && !usedDocs.has(person.name) && !blockedByVacation.has(person.name));
            if (!available.length) return null;
            available.sort((a, b) => getWorkPercent(a) - getWorkPercent(b));
            const picked = available[0].name;
            usedDocs.add(picked);
            return picked;
        };

        stationLayout.forEach((row) => {
            if (row.category === "HKL" || row.category === "Echokardiographie" || row.category === "Dienstärzte") return;

            const cellKey = `${week.key}_${row.id}`;
            if (stationPlan[cellKey]) return;

            let doctor = null;
            if (row.category === "EPU") doctor = getAvailableDoctor((person) => matchesRole(person, "EPU"));
            else if (row.category === "Oberärzte") doctor = getAvailableDoctor((person) => matchesRole(person, "OA"));
            else if (row.category.includes("Station") || row.category === "CPU" || row.category === "Tagesklinik/UKG") {
                doctor = getAvailableDoctor((person) => matchesRole(person, "AA"));
            }

            if (doctor) stationPlan[cellKey] = doctor;
        });

        stationLayout.forEach((row) => {
            if (row.category !== "HKL" && row.category !== "Echokardiographie") return;
            const cellKey = `${week.key}_${row.id}`;
            if (stationPlan[cellKey]) return;
            const doctor = getAvailableDoctor((person) => matchesRole(person, "AA"));
            if (doctor) stationPlan[cellKey] = doctor;
        });
    });


    // --- END STATION PLAN LOGIC ---

    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day += 1) {
        plan[`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`] = { AA: "", VISITE: "", OA: "" };
    }

    planWeeks.forEach((week) => {
        const dienstA = stationLayout.find((row) => row.id === "da_1");
        const dienstB = stationLayout.find((row) => row.id === "da_2");
        const docA = dienstA ? stationPlan[`${week.key}_${dienstA.id}`] : null;
        const docB = dienstB ? stationPlan[`${week.key}_${dienstB.id}`] : null;

        const parts = week.mondayDateStr.split(".");
        const fullYear = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const weekStart = new Date(Number(fullYear), Number(parts[1]) - 1, Number(parts[0]));

        for (let offset = 0; offset < 7; offset += 1) {
            const current = new Date(weekStart);
            current.setDate(current.getDate() + offset);
            if (current.getMonth() + 1 !== month) continue;

            const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
            const dayIndex = current.getDay();

            if (docA && (dayIndex === 1 || dayIndex === 3 || dayIndex === 5)) {
                plan[dateKey].AA = docA;
            }
            if (docB && (dayIndex === 0 || dayIndex === 2 || dayIndex === 4)) {
                plan[dateKey].AA = docB;
            }
        }
    });

    const counters = {};
    staff.forEach((person) => {
        counters[person.name] = 0;
    });

    const getBest = (role, dateKey, excludedNames = []) => {
        return staff
            .filter((person) => {
                if (!matchesRole(person, role) || excludedNames.includes(person.name) || (wishes[dateKey] || []).includes(person.name)) {
                    return false;
                }

                // Determine the week of this dateKey to check vacation status in stationPlan
                const dateObj = getDateFromKey(dateKey);
                // Adjust date to the start of its ISO week (Monday)
                const isoDate = new Date(dateObj);
                isoDate.setHours(0, 0, 0, 0);
                isoDate.setDate(isoDate.getDate() + 4 - (isoDate.getDay() || 7));
                const yearStart = new Date(isoDate.getFullYear(), 0, 1);
                const weekOne = new Date(yearStart);
                weekOne.setDate(weekOne.getDate() + 4 - (weekOne.getDay() || 7));
                const weekNumber = 1 + Math.round(((isoDate.getTime() - weekOne.getTime()) / 86400000 - 3 + (weekOne.getDay() + 6) % 7) / 7);
                const weekKey = `${dateObj.getFullYear()}-KW${String(weekNumber).padStart(2, "0")}`;

                let isOnVacation = false;
                stationLayout.forEach((row) => {
                    if (!row.category.includes("Urlaub") && !row.category.includes("Zeitausgleich")) return;
                    if (stationPlan[`${weekKey}_${row.id}`] === person.name) isOnVacation = true;
                });

                return !isOnVacation;
            })
            .sort((a, b) => {
                const penaltyA = (role === "AA" && (a.role === "FOA" || a.role === "FOA-EPU")) ? 1000 : 0;
                const penaltyB = (role === "AA" && (b.role === "FOA" || b.role === "FOA-EPU")) ? 1000 : 0;
                return ((counters[a.name] / getWorkPercent(a)) + penaltyA) - ((counters[b.name] / getWorkPercent(b)) + penaltyB);
            })[0];
    };

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        const dayIndex = date.getDay();
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (dayIndex === 5) {
            const oa = getBest("OA", dateKey);
            if (oa) {
                [0, 1, 2].forEach((offset) => {
                    const targetDay = day + offset;
                    if (targetDay > daysInMonth) return;
                    const targetKey = `${year}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
                    if (!(wishes[targetKey] || []).includes(oa.name)) {
                        plan[targetKey].OA = oa.name;
                        counters[oa.name] += 1;
                    }
                });
            }
        } else if (!plan[dateKey].OA) {
            const oa = getBest("OA", dateKey);
            if (oa) {
                plan[dateKey].OA = oa.name;
                counters[oa.name] += 1;
            }
        }

        if (dayIndex === 0) {
            const splitDoctorA = getBest("AA", dateKey);
            if (splitDoctorA) {
                [0, 2, 4].forEach((offset) => {
                    const targetDay = day + offset;
                    if (targetDay > daysInMonth) return;
                    const targetKey = `${year}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
                    if (!plan[targetKey].AA && !(wishes[targetKey] || []).includes(splitDoctorA.name)) {
                        plan[targetKey].AA = splitDoctorA.name;
                        counters[splitDoctorA.name] += 1;
                    }
                });
            }

            const splitDoctorB = day + 1 <= daysInMonth
                ? getBest("AA", `${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`, [splitDoctorA?.name])
                : null;

            if (splitDoctorB) {
                [1, 3, 5].forEach((offset) => {
                    const targetDay = day + offset;
                    if (targetDay > daysInMonth) return;
                    const targetKey = `${year}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
                    if (!plan[targetKey].AA && !(wishes[targetKey] || []).includes(splitDoctorB.name)) {
                        plan[targetKey].AA = splitDoctorB.name;
                        counters[splitDoctorB.name] += 1;
                    }
                });
            }
        }

        if (isVisitDay(date)) {
            if (!plan[dateKey].AA) {
                const aa = getBest("AA", dateKey);
                if (aa) {
                    plan[dateKey].AA = aa.name;
                    counters[aa.name] += 1;
                }
            }

            const visitDoctor = getBest("AA", dateKey, [plan[dateKey].AA]);
            if (visitDoctor) {
                plan[dateKey].VISITE = visitDoctor.name;
                counters[visitDoctor.name] += 0.2;
            }
        }

        if (!plan[dateKey].AA) {
            const fallbackAA = getBest("AA", dateKey);
            if (fallbackAA) {
                plan[dateKey].AA = fallbackAA.name;
                counters[fallbackAA.name] += 1;
            }
        }
    }

    save();
    renderStationPlan();
    renderCalendar();
    alert("Stations- und Dienstplan erfolgreich generiert!");
}



function getWeeksInMonth(year, month) {
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
        const yearStart = new Date(isoDate.getFullYear(), 0, 1);
        const weekOne = new Date(yearStart);
        weekOne.setDate(weekOne.getDate() + 4 - (weekOne.getDay() || 7));
        const weekNumber = 1 + Math.round(((isoDate.getTime() - weekOne.getTime()) / 86400000 - 3 + (weekOne.getDay() + 6) % 7) / 7);

        weeks.push({
            kw: weekNumber,
            mondayDateStr: `${String(cursor.getDate()).padStart(2, "0")}.${String(cursor.getMonth() + 1).padStart(2, "0")}.${String(cursor.getFullYear()).slice(-2)}`,
            key: `${year}-KW${String(weekNumber).padStart(2, "0")}`
        });
        cursor.setDate(cursor.getDate() + 7);
    }

    return weeks;
}

function renderStationPlan() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const headerEl = document.getElementById("stationHeader");
    const bodyEl = document.getElementById("stationBody");
    const printTitle = document.getElementById("printHeaderStationTitle");
    if (!monthValue || !headerEl || !bodyEl || !printTitle) return;

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
            const currentValue = stationPlan[cellKey] || "";
            let options = '<option value=""></option>';

            staff.forEach((person) => {
                let show = false;
                if (row.category === "Oberärzte") show = matchesRole(person, "OA");
                else if (row.category === "EPU") show = matchesRole(person, "EPU");
                else if (row.category.includes("Urlaub") || row.category.includes("Zeitausgleich")) show = true;
                else show = matchesRole(person, "AA");

                if (show) {
                    options += `<option value="${person.name}" ${currentValue === person.name ? "selected" : ""}>${person.name}</option>`;
                }
            });

            tableRow += `
                <td class="p-0 border-r border-slate-300 relative">
                    <select onchange="saveStationPlan('${cellKey}', this.value)" class="w-full bg-transparent p-2 outline-none text-[11px] font-bold text-center print:appearance-none cursor-pointer">
                        ${options}
                    </select>
                </td>`;
        });

        tableRow += "</tr>";
        tbody += tableRow;
    });

    bodyEl.innerHTML = tbody;
    renderValidation();
}

function saveStationPlan(key, value) {
    if (value) stationPlan[key] = value;
    else delete stationPlan[key];
    save();
    renderValidation();
}

function getHeatmapColor(value, min, max) {
    if (max <= min) return "transparent";
    const position = (value - min) / (max - min);
    return position < 0.5
        ? `rgba(${Math.floor(255 * position * 2)}, 255, 0, 0.3)`
        : `rgba(255, ${Math.floor(255 * (2 - position * 2))}, 0, 0.3)`;
}

function renderCalendar() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const monthTitleEl = document.getElementById("displayMonth");
    const printTitleEl = document.getElementById("printHeaderTitle");
    const calendarBody = document.getElementById("calendarBody");
    if (!monthValue || !monthTitleEl || !printTitleEl || !calendarBody) return;

    const [year, month] = monthValue.split("-").map(Number);
    const monthLabel = new Date(year, month - 1, 1).toLocaleString("de-DE", { month: "long", year: "numeric" });
    const daysInMonth = new Date(year, month, 0).getDate();

    monthTitleEl.innerText = monthLabel;
    printTitleEl.innerText = `Dienstplan - ${monthLabel}`;

    let html = "";
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const yesterdayKey = `${year}-${String(month).padStart(2, "0")}-${String(day - 1).padStart(2, "0")}`;
        const holidayName = isHoliday(date);
        const isSpecialDay = Boolean(holidayName) || date.getDay() === 0 || date.getDay() === 6;

        const checkCellClass = (role) => {
            const value = plan[dateKey]?.[role] || "";
            if (!value) return "";
            if ((wishes[dateKey] || []).includes(value)) return "wish-conflict";
            if (plan[yesterdayKey] && Object.values(plan[yesterdayKey]).includes(value)) return "conflict-red";
            return "";
        };

        html += `
            <tr class="${isSpecialDay ? "holiday-bg" : ""} border-b text-xs">
                <td class="p-1 text-center font-bold text-slate-500">${date.toLocaleDateString("de-DE", { weekday: "short" })}</td>
                <td class="p-1 text-center font-bold border-l border-r">${day}.${holidayName ? `<br><span class="text-[7px] text-red-600 font-normal leading-tight">${holidayName}</span>` : ""}</td>
                <td class="p-0 ${checkCellClass("AA")}">${createSelect(dateKey, "AA")}</td>
                <td class="p-0 ${checkCellClass("VISITE")}">${isVisitDay(date) ? createSelect(dateKey, "VISITE") : ""}</td>
                <td class="p-0 ${checkCellClass("OA")}">${createSelect(dateKey, "OA")}</td>
            </tr>`;
    }

    calendarBody.innerHTML = html;
    renderStats();
    renderWishMatrix();
    renderValidation();
}

function renderStats() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const statsTableAA = document.getElementById("statsTableAA");
    const statsTableOA = document.getElementById("statsTableOA");
    if (!monthValue || !statsTableAA || !statsTableOA) return;

    const [year, month] = monthValue.split("-").map(Number);

    ["AA", "OA"].forEach((role) => {
        const data = staff.filter((person) => matchesRole(person, role)).map((person) => {
            let monthDuty = 0;
            let monthVisit = 0;
            let sixMonthDuty = 0;
            let sixMonthVisit = 0;

            for (let offset = 0; offset < 6; offset += 1) {
                const currentMonth = new Date(year, month - 1 - offset, 1);
                const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;

                Object.keys(plan).forEach((dateKey) => {
                    if (!dateKey.startsWith(monthKey)) return;
                    if (plan[dateKey].AA === person.name || plan[dateKey].OA === person.name) {
                        sixMonthDuty += 1;
                        if (offset === 0) monthDuty += 1;
                    }
                    if (plan[dateKey].VISITE === person.name) {
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

function createSelect(dateKey, role) {
    const currentValue = plan[dateKey]?.[role] || "";
    let options = '<option value="">-</option>';

    staff.filter((person) => matchesRole(person, role)).forEach((person) => {
        const isWarning = (wishes[dateKey] || []).includes(person.name);
        const label = person.name + (isWarning ? " (!)" : "");
        options += `<option value="${person.name}" ${currentValue === person.name ? "selected" : ""}>${label}</option>`;
    });

    return `<select onchange="savePlan('${dateKey}', '${role}', this.value)" class="w-full bg-transparent p-1 outline-none text-[10px] print:font-bold">${options}</select>`;
}

function savePlan(dateKey, role, value) {
    if (!plan[dateKey]) plan[dateKey] = {};
    plan[dateKey][role] = value;
    save();
    renderCalendar();
}

function showSection(id) {
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

function savePerson() {
    const name = document.getElementById("pName")?.value.trim() || "";
    const id = document.getElementById("pId")?.value.trim() || "";
    const role = document.getElementById("pRole")?.value || "AA";
    const workInput = Number(document.getElementById("pWork")?.value);
    const work = workInput > 0 ? Math.min(workInput, 100) : 100;

    if (!name) {
        alert("Bitte einen Namen eingeben.");
        return;
    }
    if (staff.some((person) => person.name.toLowerCase() === name.toLowerCase())) {
        alert("Dieser Name ist bereits angelegt.");
        return;
    }

    staff.push({ name, id, role, work });
    save();
    renderStaff();
    renderCalendar();
    renderStationPlan();

    document.getElementById("pName").value = "";
    document.getElementById("pId").value = "";
    document.getElementById("pWork").value = "";
}

function removePerson(index) {
    const person = staff[index];
    if (!person) return;
    if (!confirm(`Soll ${person.name} wirklich entfernt werden? Zugeordnete Dienste, Sperren und Stationsfelder werden ebenfalls geleert.`)) return;

    staff.splice(index, 1);

    Object.keys(plan).forEach((dateKey) => {
        ["AA", "VISITE", "OA"].forEach((role) => {
            if (plan[dateKey]?.[role] === person.name) plan[dateKey][role] = "";
        });
    });

    Object.keys(wishes).forEach((dateKey) => {
        wishes[dateKey] = (wishes[dateKey] || []).filter((name) => name !== person.name);
        if (!wishes[dateKey].length) delete wishes[dateKey];
    });

    Object.keys(stationPlan).forEach((key) => {
        if (stationPlan[key] === person.name) delete stationPlan[key];
    });

    save();
    renderStaff();
    renderCalendar();
    renderStationPlan();
}

function renderStaff() {
    const staffList = document.getElementById("staffList");
    if (!staffList) return;

    staffList.innerHTML = staff.map((person, index) => {
        const details = [person.role, `${getWorkPercent(person)}%`];
        if (person.id) details.unshift(person.id);
        return `<div class="bg-slate-50 p-1 border rounded flex justify-between text-[10px] items-center mb-1"><span><span class="font-bold">${person.name}</span> <span class="text-slate-500">(${details.join(" | ")})</span></span><button onclick="removePerson(${index})" class="text-red-500 font-bold px-2">X</button></div>`;
    }).join("");
}

function renderWishMatrix() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const container = document.getElementById("wishTableContainer");
    if (!monthValue || !container) return;

    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let head = '<tr><th class="border p-1 bg-slate-100">Tag</th>';
    staff.forEach((person) => {
        head += `<th class="border p-1 text-[8px] h-24 align-bottom" style="writing-mode: vertical-rl;">${person.name}</th>`;
    });
    head += "</tr>";

    let body = "";
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let row = `<tr><td class="p-1 border bg-slate-50 text-center font-bold text-[10px]">${day}</td>`;
        staff.forEach((person) => {
            const isSet = (wishes[dateKey] || []).includes(person.name);
            row += `<td class="border text-center cursor-pointer ${isSet ? "bg-purple-500 text-white" : ""}" onclick="toggleWish('${dateKey}', '${person.name}')">${isSet ? "X" : ""}</td>`;
        });
        body += `${row}</tr>`;
    }

    container.innerHTML = `<h2 class="text-xl font-bold mb-4 text-purple-700 uppercase">Wünsche / Sperren</h2><table class="w-full text-xs border-collapse">${head}${body}</table>`;
}

function toggleWish(dateKey, name) {
    if (!wishes[dateKey]) wishes[dateKey] = [];
    wishes[dateKey] = wishes[dateKey].includes(name)
        ? wishes[dateKey].filter((item) => item !== name)
        : [...wishes[dateKey], name];
    save();
    renderCalendar();
}

function backupExport() {
    const payload = JSON.stringify({ staff, plan, wishes, stationPlan, holidaySeasonMode });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    anchor.download = "MediPlan_Backup.json";
    anchor.click();
}

function backupImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const data = JSON.parse(loadEvent.target.result);
            staff = Array.isArray(data.staff) ? data.staff : [];
            plan = data.plan && typeof data.plan === "object" ? data.plan : {};
            wishes = data.wishes && typeof data.wishes === "object" ? data.wishes : {};
            stationPlan = data.stationPlan && typeof data.stationPlan === "object" ? data.stationPlan : {};
            holidaySeasonMode = Boolean(data.holidaySeasonMode);

            const checkbox = document.getElementById("holidaySeasonMode");
            if (checkbox) checkbox.checked = holidaySeasonMode;

            save();
            renderCalendar();
            renderStationPlan();
            renderStaff();
            alert("Daten geladen!");
        } catch {
            alert("Backup konnte nicht gelesen werden.");
        } finally {
            event.target.value = "";
        }
    };
    reader.readAsText(file);
}

function getValidationIssues(monthValue, source = {}) {
    if (!monthValue) return [];

    const dataStaff = source.staff || staff;
    const dataPlan = source.plan || plan;
    const dataStationPlan = source.stationPlan || stationPlan;
    const holidayMode = Object.prototype.hasOwnProperty.call(source, "holidaySeasonMode") ? source.holidaySeasonMode : holidaySeasonMode;
    const staffByName = Object.fromEntries(dataStaff.map((person) => [person.name, person]));
    const issues = [];

    getMonthDayKeys(monthValue).forEach((dateKey) => {
        const date = getDateFromKey(dateKey);
        const entry = dataPlan[dateKey] || {};
        const roles = [
            { key: "AA", label: roleLabels.AA, required: true, blocks: ["ics", "atoss"] },
            { key: "OA", label: roleLabels.OA, required: true, blocks: ["ics", "atoss"] },
            { key: "VISITE", label: roleLabels.VISITE, required: isVisitDay(date, holidayMode), blocks: ["ics", "atoss"] }
        ];

        roles.forEach((role) => {
            const assignedName = entry[role.key];
            if (role.required && !assignedName) {
                issues.push({
                    severity: "error",
                    area: "Planung",
                    reference: formatDateKey(dateKey),
                    message: `${role.label} ist nicht besetzt.`,
                    blocks: role.blocks
                });
                return;
            }

            if (!assignedName) return;

            const person = staffByName[assignedName];
            if (!person) {
                issues.push({
                    severity: "error",
                    area: "Planung",
                    reference: formatDateKey(dateKey),
                    message: `${role.label} verweist auf "${assignedName}", aber die Person ist nicht im Personalstamm.`,
                    blocks: role.blocks
                });
                return;
            }

            if (!person.id) {
                issues.push({
                    severity: "error",
                    area: "Export",
                    reference: formatDateKey(dateKey),
                    message: `${assignedName} hat keine Atoss-ID, wird aber für ${role.label} verwendet.`,
                    blocks: ["atoss"]
                });
            }
        });

        const assignmentsByName = {};
        ["AA", "VISITE", "OA"].forEach((roleKey) => {
            const assignedName = entry[roleKey];
            if (!assignedName) return;
            if (!assignmentsByName[assignedName]) assignmentsByName[assignedName] = [];
            assignmentsByName[assignedName].push(roleLabels[roleKey]);
        });

        Object.entries(assignmentsByName).forEach(([name, rolesForPerson]) => {
            if (rolesForPerson.length < 2) return;
            issues.push({
                severity: "warning",
                area: "Planung",
                reference: formatDateKey(dateKey),
                message: `${name} ist mehrfach eingeteilt: ${rolesForPerson.join(", ")}.`,
                blocks: []
            });
        });
    });

    const [year, month] = monthValue.split("-").map(Number);
    getWeeksInMonth(year, month).forEach((week) => {
        const assignmentsByDoctor = {};
        const vacationDoctors = new Set();

        stationLayout.forEach((row) => {
            const value = dataStationPlan[`${week.key}_${row.id}`];
            if (!value) return;

            const label = row.name !== row.category ? `${row.category}: ${row.name}` : row.category;
            if (row.category.includes("Urlaub") || row.category.includes("Zeitausgleich")) {
                vacationDoctors.add(value);
                return;
            }

            if (!assignmentsByDoctor[value]) assignmentsByDoctor[value] = [];
            assignmentsByDoctor[value].push(label);
        });

        Object.entries(assignmentsByDoctor).forEach(([name, placements]) => {
            if (placements.length > 1) {
                issues.push({
                    severity: "warning",
                    area: "Stationen",
                    reference: week.key,
                    message: `${name} ist mehrfach im Stationsplan eingetragen: ${placements.join(", ")}.`,
                    blocks: []
                });
            }
            if (vacationDoctors.has(name)) {
                issues.push({
                    severity: "warning",
                    area: "Stationen",
                    reference: week.key,
                    message: `${name} ist gleichzeitig im Urlaub/Zeitausgleich und im Stationsplan eingeteilt.`,
                    blocks: []
                });
            }
        });
    });

    const severityRank = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => {
        const severityDiff = severityRank[a.severity] - severityRank[b.severity];
        if (severityDiff !== 0) return severityDiff;
        const areaDiff = a.area.localeCompare(b.area, "de-DE");
        if (areaDiff !== 0) return areaDiff;
        return a.reference.localeCompare(b.reference, "de-DE");
    });

    return issues;
}

function renderValidation() {
    const monthValue = document.getElementById("monthPicker")?.value;
    const summaryEl = document.getElementById("validationSummary");
    const listEl = document.getElementById("validationList");
    if (!summaryEl || !listEl) return;

    if (!monthValue) {
        summaryEl.innerHTML = "";
        listEl.innerHTML = '<div class="validation-empty">Bitte zuerst einen Monat auswählen.</div>';
        return;
    }

    const issues = getValidationIssues(monthValue);
    const errorCount = issues.filter((issue) => issue.severity === "error").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
    const blockerCount = issues.filter((issue) => issue.blocks && issue.blocks.length).length;

    summaryEl.innerHTML = `
        <div class="validation-card validation-card-error">
            <strong>${errorCount}</strong>
            <span>Fehler</span>
        </div>
        <div class="validation-card validation-card-warning">
            <strong>${warningCount}</strong>
            <span>Warnungen</span>
        </div>
        <div class="validation-card ${blockerCount ? "validation-card-warning" : "validation-card-ok"}">
            <strong>${blockerCount}</strong>
            <span>Export-relevante Punkte</span>
        </div>`;

    if (!issues.length) {
        listEl.innerHTML = '<div class="validation-empty">Keine offenen Validierungsprobleme im gewählten Monat gefunden.</div>';
        return;
    }

    const badgeClass = {
        error: "validation-badge validation-badge-error",
        warning: "validation-badge validation-badge-warning",
        info: "validation-badge validation-badge-info"
    };

    const rows = issues.map((issue) => {
        const exportInfo = issue.blocks?.length ? `Blockiert: ${issue.blocks.join(", ").toUpperCase()}` : "Nur Hinweis";
        return `
            <tr class="validation-row-${issue.severity}">
                <td><span class="${badgeClass[issue.severity]}">${issue.severity === "error" ? "Fehler" : issue.severity === "warning" ? "Warnung" : "Hinweis"}</span></td>
                <td>${issue.area}</td>
                <td>${issue.reference}</td>
                <td>${issue.message}<div class="validation-meta mt-1">${exportInfo}</div></td>
            </tr>`;
    }).join("");

    listEl.innerHTML = `
        <table class="validation-table">
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Bereich</th>
                    <th>Referenz</th>
                    <th>Beschreibung</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function maybeBlockExport(exportType, label) {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return false;

    const blockingIssues = getValidationIssues(monthValue).filter((issue) => (issue.blocks || []).includes(exportType));
    if (!blockingIssues.length) return false;

    renderValidation();
    showSection("validation");
    return !confirm(`${label}: ${blockingIssues.length} blockierende Punkte gefunden. Trotzdem exportieren?`);
}

function exportAllICS() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (maybeBlockExport("ics", "ICS-Export")) return;

    const monthEntries = Object.keys(plan).filter((dateKey) => dateKey.startsWith(monthValue)).sort();
    if (!monthEntries.length) {
        alert("Keine Dienste im gewählten Monat gefunden.");
        return;
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    let exportedFiles = 0;

    staff.forEach((person) => {
        const events = [];

        monthEntries.forEach((dateKey) => {
            [
                ["AA", "24h Dienst"],
                ["VISITE", "Visite"],
                ["OA", "Hintergrund"]
            ].forEach(([role, label]) => {
                if (plan[dateKey]?.[role] !== person.name) return;

                const startTime = getICSStartTime(dateKey, role);
                const uid = `${dateKey}-${role}-${person.name}`.replace(/\s+/g, "-");
                events.push([
                    "BEGIN:VEVENT",
                    `UID:${uid}@mediplan`,
                    `DTSTAMP:${timestamp}`,
                    `SUMMARY:${escapeICSText(label)}`,
                    `DTSTART:${dateKey.replace(/-/g, "")}T${startTime}`,
                    `DTEND:${dateKey.replace(/-/g, "")}T235900`,
                    "END:VEVENT"
                ].join("\r\n"));
            });
        });

        if (!events.length) return;

        const lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//MediPlan Pro//Dienstplan//DE",
            ...events,
            "END:VCALENDAR"
        ];

        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
        anchor.download = `Dienst_${person.name}.ics`;
        anchor.click();
        exportedFiles += 1;
    });

    if (!exportedFiles) {
        alert("Für den gewählten Monat gibt es keine exportierbaren Dienste.");
    }
}

function exportAtossCSV() {
    const monthValue = document.getElementById("monthPicker")?.value;
    if (!monthValue) return;
    if (maybeBlockExport("atoss", "Atoss-Export")) return;

    const rows = [];
    Object.keys(plan).sort().forEach((dateKey) => {
        if (!dateKey.startsWith(monthValue)) return;
        [
            ["AA", 17],
            ["VISITE", 5],
            ["OA", 17]
        ].forEach(([role, hours]) => {
            const person = staff.find((entry) => entry.name === plan[dateKey]?.[role]);
            if (person?.id) rows.push(`${person.id};${dateKey};${hours}`);
        });
    });

    if (!rows.length) {
        alert("Für den gewählten Monat gibt es keine exportierbaren Atoss-Daten.");
        return;
    }

    const csv = ["Personalnummer;Datum;Stunden", ...rows].join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = "Atoss_Export.csv";
    anchor.click();
}

function bootstrap() {
    const monthPicker = document.getElementById("monthPicker");
    if (!monthPicker) return;

    monthPicker.value = getCurrentMonthValue();

    const holidayCheckbox = document.getElementById("holidaySeasonMode");
    if (holidayCheckbox) holidayCheckbox.checked = holidaySeasonMode;

    renderStationPlan();
    renderCalendar();
    showSection("plan");
}

window.MediPlanTestApi = {
    getEasterSunday,
    getHolidayName,
    getWeeksInMonth,
    getICSStartTime,
    getValidationIssues
};

document.addEventListener("DOMContentLoaded", bootstrap);
