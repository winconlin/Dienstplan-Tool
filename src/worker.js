// worker.js for Autoplaner
self.onmessage = function (e) {
    const { year, month, state, activeStaff, planWeeks } = e.data;

    const { stationLayout, stationPlan, plan, wishes } = state;

    function matchesRole(person, role) {
        if (role === "OA") return person.role === "OA" || person.role === "FOA" || person.role === "OA-EPU" || person.role === "FOA-EPU";
        if (role === "EPU") return person.role === "OA-EPU" || person.role === "FOA-EPU";
        return person.role === "AA" || person.role === "FOA" || person.role === "FOA-EPU";
    }

    function getWorkPercent(person) {
        const parsed = Number(person.work);
        return parsed > 0 ? parsed : 100;
    }

    function getEasterSunday(y) {
        const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
        const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const mon = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(y, mon - 1, day);
    }

    function getHolidayName(date, holidayMode) {
        const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
        const fixedHolidays = { "1.1":1, "6.1":1, "1.5":1, "15.8":1, "3.10":1, "1.11":1, "25.12":1, "26.12":1 };

        if (holidayMode) {
            const start = new Date(y, 11, 24);
            while (start.getDay() !== 6) start.setDate(start.getDate() - 1);
            const end = m === 1 && d <= 15 ? new Date(y, 0, 6) : new Date(y + 1, 0, 6);
            while (end.getDay() !== 0) end.setDate(end.getDate() + 1);
            if (date >= start && date <= end) return "Winterplan";
        }
        if (fixedHolidays[`${d}.${m}`]) return "Holiday";

        const easter = getEasterSunday(y);
        const diff = Math.round((date - easter) / 86400000);
        if ([ -2, 1, 39, 50, 60 ].includes(diff)) return "Holiday";

        const buss = new Date(y, 10, 22);
        while (buss.getDay() !== 3) buss.setDate(buss.getDate() - 1);
        if (d === buss.getDate() && m === 11) return "Holiday";
        return null;
    }

    function isVisitDay(date, holidayMode) {
        return date.getDay() === 6 || Boolean(getHolidayName(date, holidayMode));
    }

    // STATION LOGIC
    planWeeks.forEach((week) => {
        const parts = week.mondayDateStr.split(".");
        const fullYear = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const weekStart = new Date(Number(fullYear), Number(parts[1]) - 1, Number(parts[0]));

        const monday = new Date(weekStart);
        const sunday = new Date(weekStart);
        sunday.setDate(sunday.getDate() - 1);

        const mk = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
        const sk = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

        const splitAAM = plan[mk]?.AA || null;
        const splitAAS = plan[sk]?.AA || null;
        const dienstRowA = stationLayout.find((row) => row.id === "da_1");
        const dienstRowB = stationLayout.find((row) => row.id === "da_2");

        const blockedByVacation = new Set();
        stationLayout.forEach((row) => {
            if (!row.category.includes("Urlaub") && !row.category.includes("Zeitausgleich")) return;
            const value = stationPlan[`${week.key}_${row.id}`];
            if (value) blockedByVacation.add(value);
        });

        if (splitAAM && dienstRowA) stationPlan[`${week.key}_${dienstRowA.id}`] = splitAAM;
        if (splitAAS && dienstRowB) stationPlan[`${week.key}_${dienstRowB.id}`] = splitAAS;

        const usedDocs = new Set();
        stationLayout.forEach((row) => {
            const value = stationPlan[`${week.key}_${row.id}`];
            if (value) usedDocs.add(value);
        });

        const getAvailDoc = (pred) => {
            const avail = activeStaff.filter(p => p.canDoShifts !== false && pred(p) && !usedDocs.has(p.name) && !blockedByVacation.has(p.name));
            if (!avail.length) return null;
            avail.sort((a, b) => getWorkPercent(a) - getWorkPercent(b));
            const picked = avail[0].name;
            usedDocs.add(picked);
            return picked;
        };

        stationLayout.forEach((row) => {
            if (row.category === "HKL" || row.category === "Echokardiographie" || row.category === "Dienstärzte") return;
            const cellKey = `${week.key}_${row.id}`;
            if (stationPlan[cellKey]) return;

            let doc = null;
            if (row.category === "EPU") doc = getAvailDoc(p => matchesRole(p, "EPU"));
            else if (row.category === "Oberärzte") doc = getAvailDoc(p => matchesRole(p, "OA"));
            else if (row.category.includes("Station") || row.category === "CPU" || row.category === "Tagesklinik/UKG") doc = getAvailDoc(p => matchesRole(p, "AA"));

            if (doc) stationPlan[cellKey] = doc;
        });

        stationLayout.forEach((row) => {
            if (row.category !== "Echokardiographie") return;
            const cellKey = `${week.key}_${row.id}`;
            if (stationPlan[cellKey]) return;
            const doc = getAvailDoc(p => matchesRole(p, "AA"));
            if (doc) stationPlan[cellKey] = doc;
        });
    });

    // PLAN LOGIC
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
        const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (!plan[key]) plan[key] = { AA: "", VISITE: "", OA: "" };
    }

    planWeeks.forEach((week) => {
        const dA = stationLayout.find((row) => row.id === "da_1");
        const dB = stationLayout.find((row) => row.id === "da_2");
        const docA = dA ? stationPlan[`${week.key}_${dA.id}`] : null;
        const docB = dB ? stationPlan[`${week.key}_${dB.id}`] : null;

        const parts = week.mondayDateStr.split(".");
        const yStr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const wStart = new Date(Number(yStr), Number(parts[1]) - 1, Number(parts[0]));

        for (let offset = 0; offset < 7; offset += 1) {
            const current = new Date(wStart);
            current.setDate(current.getDate() + offset);
            if (current.getMonth() + 1 !== month) continue;

            const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
            const di = current.getDay();

            if (docA && (di === 1 || di === 3 || di === 5)) if (!plan[dateKey].AA) plan[dateKey].AA = docA;
            if (docB && (di === 0 || di === 2 || di === 4)) if (!plan[dateKey].AA) plan[dateKey].AA = docB;
        }
    });

    const counters = {};
    activeStaff.forEach(p => counters[p.name] = 0);

    const weekKeyCache = {};
    const getWKey = (dk) => {
        if (weekKeyCache[dk]) return weekKeyCache[dk];
        const [y, m, d] = dk.split("-").map(Number);
        const isoDate = new Date(y, m - 1, d);
        isoDate.setHours(0, 0, 0, 0);
        isoDate.setDate(isoDate.getDate() + 4 - (isoDate.getDay() || 7));
        const ys = new Date(isoDate.getFullYear(), 0, 1);
        const w1 = new Date(ys);
        w1.setDate(w1.getDate() + 4 - (w1.getDay() || 7));
        const wn = 1 + Math.round(((isoDate.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
        const k = `${y}-KW${String(wn).padStart(2, "0")}`;
        weekKeyCache[dk] = k;
        return k;
    };

    const getBest = (role, dk, excl = []) => {
        const wk = getWKey(dk);
        return activeStaff.filter(p => {
            if (p.canDoShifts === false) return false;
            if (!matchesRole(p, role) || excl.includes(p.name) || (wishes[dk] || []).includes(p.name)) return false;
            let onVac = false;
            stationLayout.forEach(row => {
                if (!row.category.includes("Urlaub") && !row.category.includes("Zeitausgleich")) return;
                if (stationPlan[`${wk}_${row.id}`] === p.name) onVac = true;
            });
            return !onVac;
        }).sort((a, b) => {
            const pA = (role === "AA" && (a.role === "FOA" || a.role === "FOA-EPU")) ? 1000 : 0;
            const pB = (role === "AA" && (b.role === "FOA" || b.role === "FOA-EPU")) ? 1000 : 0;
            return ((counters[a.name] / getWorkPercent(a)) + pA) - ((counters[b.name] / getWorkPercent(b)) + pB);
        })[0];
    };

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        const di = date.getDay();
        const dk = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (di === 5 && !plan[dk].OA) {
            const oa = getBest("OA", dk);
            if (oa) {
                [0, 1, 2].forEach((off) => {
                    const td = day + off;
                    if (td > daysInMonth) return;
                    const tk = `${year}-${String(month).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
                    if (!plan[tk].OA && !(wishes[tk] || []).includes(oa.name)) {
                        plan[tk].OA = oa.name;
                        counters[oa.name] += 1;
                    }
                });
            }
        } else if (!plan[dk].OA) {
            const oa = getBest("OA", dk);
            if (oa) {
                plan[dk].OA = oa.name;
                counters[oa.name] += 1;
            }
        }

        if (di === 0) {
            const sA = getBest("AA", dk);
            if (sA) {
                [0, 2, 4].forEach((off) => {
                    const td = day + off;
                    if (td > daysInMonth) return;
                    const tk = `${year}-${String(month).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
                    if (!plan[tk].AA && !(wishes[tk] || []).includes(sA.name)) {
                        plan[tk].AA = sA.name;
                        counters[sA.name] += 1;
                    }
                });
            }
            const sB = day + 1 <= daysInMonth ? getBest("AA", `${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`, [sA?.name]) : null;
            if (sB) {
                [1, 3, 5].forEach((off) => {
                    const td = day + off;
                    if (td > daysInMonth) return;
                    const tk = `${year}-${String(month).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
                    if (!plan[tk].AA && !(wishes[tk] || []).includes(sB.name)) {
                        plan[tk].AA = sB.name;
                        counters[sB.name] += 1;
                    }
                });
            }
        }

        if (isVisitDay(date, state.holidaySeasonMode)) {
            if (!plan[dk].AA) {
                const aa = getBest("AA", dk);
                if (aa) { plan[dk].AA = aa.name; counters[aa.name] += 1; }
            }
            if (!plan[dk].VISITE) {
                const v = getBest("AA", dk, [plan[dk].AA]);
                if (v) { plan[dk].VISITE = v.name; counters[v.name] += 0.2; }
            }
        }

        if (!plan[dk].AA) {
            const fAA = getBest("AA", dk);
            if (fAA) { plan[dk].AA = fAA.name; counters[fAA.name] += 1; }
        }
    }

    self.postMessage({ plan, stationPlan });
};
