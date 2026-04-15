import { appState } from './state.js';
import { getWorkPercent, normalizeAtossId, normalizeAtossHours, getDuplicateAtossAssignments, getMonthDayKeys, getDateFromKey, formatDateKey, isRoleActiveOnDate, isPlainObject, getAssignedNamesForDates, getUniqueAssignedName, getVacationDoctorsForDate, roleLabels, stationLayout } from './core.js';

import { getSelectedMonthValue } from './ui-common.js';
import { getWeeksInMonth } from './planning-engine.js';

// Validation helpers for imports, cross-checks and export blockers.

export function validateBackupPayload(data) {
    if (!isPlainObject(data)) {
        return { ok: false, error: "Backup muss ein JSON-Objekt sein." };
    }

    if ("staff" in data && !Array.isArray(data.staff)) {
        return { ok: false, error: "Backup enthaelt eine ungueltige Personal-Liste." };
    }
    if ("plan" in data && !isPlainObject(data.plan)) {
        return { ok: false, error: "Backup enthaelt einen ungueltigen Dienstplan." };
    }
    if ("wishes" in data && !isPlainObject(data.wishes)) {
        return { ok: false, error: "Backup enthaelt ungueltige Wunschdaten." };
    }
    if ("stationPlan" in data && !isPlainObject(data.stationPlan)) {
        return { ok: false, error: "Backup enthaelt einen ungueltigen Stationsplan." };
    }
    if ("atossHours" in data && !isPlainObject(data.atossHours)) {
        return { ok: false, error: "Backup enthaelt ungueltige Atoss-Stunden." };
    }

    const normalized = {
        staff: Array.isArray(data.staff) ? data.staff.map((person) => ({
            name: String(person?.name || "").trim(),
            id: normalizeAtossId(person?.id),
            role: person?.role || "AA",
            work: getWorkPercent(person || {})
        })) : [],
        plan: isPlainObject(data.plan) ? data.plan : {},
        wishes: isPlainObject(data.wishes) ? data.wishes : {},
        stationPlan: isPlainObject(data.stationPlan) ? data.stationPlan : {},
        holidaySeasonMode: Boolean(data.holidaySeasonMode),
        atossHours: normalizeAtossHours(data.atossHours)
    };

    const invalidPerson = normalized.staff.find((person) => !person.name);
    if (invalidPerson) {
        return { ok: false, error: "Backup enthaelt Personal ohne Namen." };
    }

    const duplicateNames = normalized.staff.filter((person, index) => {
        return normalized.staff.findIndex((entry) => entry.name.toLowerCase() === person.name.toLowerCase()) !== index;
    });
    if (duplicateNames.length) {
        return { ok: false, error: "Backup enthaelt doppelte Personennamen." };
    }

    // const duplicateAtossAssignments = getDuplicateAtossAssignments(normalized.staff);
    // if (duplicateAtossAssignments.length) {
    //     return { ok: false, error: `Backup enthaelt doppelte Atoss-ID ${duplicateAtossAssignments[0].id}.` };
    // }

    return { ok: true, normalized };
}

export function getValidationIssues(monthValue, source = {}) {
    if (!monthValue) return [];

    const dataStaff = source.staff || appState.staff;
    const dataPlan = source.plan || appState.plan;
    const dataWishes = source.wishes || appState.wishes;
    const dataStationPlan = source.stationPlan || appState.stationPlan;
    const holidayMode = Object.prototype.hasOwnProperty.call(source, "holidaySeasonMode") ? source.holidaySeasonMode : appState.holidaySeasonMode;
    const staffByName = Object.fromEntries(dataStaff.map((person) => [person.name, person]));
    const issues = [];
    const [year, month] = monthValue.split("-").map(Number);
    const weeks = getWeeksInMonth(year, month);
    const duplicateAtossAssignments = getDuplicateAtossAssignments(dataStaff);

    duplicateAtossAssignments.forEach(({ id, names }) => {
        issues.push({
            severity: "error",
            area: "Personal",
            reference: `Atoss ${id}`,
            message: `Die Atoss-ID ${id} ist mehrfach vergeben: ${names.join(", ")}.`,
            blocks: ["atoss"]
        });
    });

    getMonthDayKeys(monthValue).forEach((dateKey) => {
        const date = getDateFromKey(dateKey);
        const entry = dataPlan[dateKey] || {};
        const vacationDoctors = getVacationDoctorsForDate(dateKey, weeks, dataStationPlan);
        const roles = [
            { key: "AA", label: roleLabels.AA, required: true, blocks: ["ics", "atoss"] },
            { key: "OA", label: roleLabels.OA, required: true, blocks: ["ics", "atoss"] },
            { key: "VISITE", label: roleLabels.VISITE, required: isRoleActiveOnDate("VISITE", date, holidayMode), blocks: ["ics", "atoss"] }
        ];

        roles.forEach((role) => {
            const assignedName = entry[role.key];
            if (!isRoleActiveOnDate(role.key, date, holidayMode) && assignedName) {
                issues.push({
                    severity: "error",
                    area: "Planung",
                    reference: formatDateKey(dateKey),
                    message: `${role.label} ist an diesem Tag nicht vorgesehen, hat aber mit ${assignedName} eine Belegung.`,
                    blocks: role.blocks
                });
                return;
            }

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

            if ((dataWishes[dateKey] || []).includes(assignedName)) {
                issues.push({
                    severity: "warning",
                    area: "Planung",
                    reference: formatDateKey(dateKey),
                    message: `${assignedName} ist fuer ${role.label} eingeteilt, obwohl Wunschfrei/Sperre hinterlegt ist.`,
                    blocks: []
                });
            }

            if (vacationDoctors.has(assignedName)) {
                issues.push({
                    severity: "error",
                    area: "Korrelation",
                    reference: formatDateKey(dateKey),
                    message: `${assignedName} ist im Stationsplan fuer diese Woche als Urlaub/Zeitausgleich markiert, wird aber fuer ${role.label} verwendet.`,
                    blocks: role.blocks
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

    weeks.forEach((week) => {
        const assignmentsByDoctor = {};
        const vacationDoctors = new Set();
        const dienstRowA = dataStationPlan[`${week.key}_da_1`] || "";
        const dienstRowB = dataStationPlan[`${week.key}_da_2`] || "";
        const derivedDienstA = getUniqueAssignedName(week.dienstGroupA, "AA", dataPlan);
        const derivedDienstB = getUniqueAssignedName(week.dienstGroupB, "AA", dataPlan);

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

        if (derivedDienstA === false) {
            const names = getAssignedNamesForDates(week.dienstGroupA, "AA", dataPlan);
            issues.push({
                severity: "warning",
                area: "Korrelation",
                reference: week.key,
                message: `Die Dienstarzt-Gruppe Mo/Mi/Fr ist im Dienstplan nicht eindeutig: ${names.join(", ")}.`,
                blocks: []
            });
        } else if (derivedDienstA && dienstRowA && dienstRowA !== derivedDienstA) {
            issues.push({
                severity: "warning",
                area: "Korrelation",
                reference: week.key,
                message: `Stationsplan Mo/Mi/Fr verweist auf ${dienstRowA}, im Dienstplan ist jedoch ${derivedDienstA} hinterlegt.`,
                blocks: []
            });
        } else if (derivedDienstA && !dienstRowA) {
            issues.push({
                severity: "warning",
                area: "Korrelation",
                reference: week.key,
                message: `Die Dienstarzt-Zeile Mo/Mi/Fr ist leer, obwohl im Dienstplan ${derivedDienstA} hinterlegt ist.`,
                blocks: []
            });
        }

        if (derivedDienstB === false) {
            const names = getAssignedNamesForDates(week.dienstGroupB, "AA", dataPlan);
            issues.push({
                severity: "warning",
                area: "Korrelation",
                reference: week.key,
                message: `Die Dienstarzt-Gruppe So/Di/Do ist im Dienstplan nicht eindeutig: ${names.join(", ")}.`,
                blocks: []
            });
        } else if (derivedDienstB && dienstRowB && dienstRowB !== derivedDienstB) {
            issues.push({
                severity: "warning",
                area: "Korrelation",
                reference: week.key,
                message: `Stationsplan So/Di/Do verweist auf ${dienstRowB}, im Dienstplan ist jedoch ${derivedDienstB} hinterlegt.`,
                blocks: []
            });
        } else if (derivedDienstB && !dienstRowB) {
            issues.push({
                severity: "warning",
                area: "Korrelation",
                reference: week.key,
                message: `Die Dienstarzt-Zeile So/Di/Do ist leer, obwohl im Dienstplan ${derivedDienstB} hinterlegt ist.`,
                blocks: []
            });
        }
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

export function renderValidation() {
    const monthValue = getSelectedMonthValue();
    const summaryEl = document.getElementById("validationSummary");
    const listEl = document.getElementById("validationList");
    if (!summaryEl || !listEl) return;

    if (!monthValue) {
        summaryEl.innerHTML = "";
        listEl.innerHTML = '<div class="validation-empty">Bitte zuerst einen Monat auswaehlen.</div>';
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
        listEl.innerHTML = '<div class="validation-empty">Keine offenen Validierungsprobleme im gewaehlten Monat gefunden.</div>';
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
