import { state, defaultStationLayout } from './state.js';
import { getMonthDayKeys, getDateFromKey, formatDateKey, isVisitDay, getWeeksInMonth } from './calendar.js';
import { t } from './i18n.js';
import { getActiveStaff } from './staff.js';

export function getValidationIssues(monthValue, source = {}) {
    if (!monthValue) return [];

    const dataStaff = source.staff || state.staff;
    const dataPlan = source.plan || state.plan;
    const dataStationPlan = source.stationPlan || state.stationPlan;
    const holidayMode = Object.prototype.hasOwnProperty.call(source, "holidaySeasonMode") ? source.holidaySeasonMode : state.holidaySeasonMode;
    const stationLayout = state.customStationLayout || defaultStationLayout;

    // We use getActiveStaff instead of strict dataStaff map to respect chronologies
    const activeStaff = source.staff ? source.staff : getActiveStaff(monthValue);
    const staffByName = Object.fromEntries(activeStaff.map((person) => [person.name, person]));
    const issues = [];

    getMonthDayKeys(monthValue).forEach((dateKey) => {
        const date = getDateFromKey(dateKey);
        const entry = dataPlan[dateKey] || {};
        const roles = [
            { key: "AA", label: t('role_aa'), required: true, blocks: ["ics", "atoss"] },
            { key: "OA", label: t('role_oa'), required: true, blocks: ["ics", "atoss"] },
            { key: "VISITE", label: t('role_visite'), required: isVisitDay(date, holidayMode), blocks: ["ics", "atoss"] }
        ];

        roles.forEach((role) => {
            const assignedName = entry[role.key];
            if (role.required && !assignedName) {
                issues.push({
                    severity: "error",
                    area: t('tab_planung'),
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
                    area: t('tab_planung'),
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

            // Check Live-Warnung: Wunsch-Sperre missachtet
            if (state.wishes[dateKey] && state.wishes[dateKey].includes(assignedName)) {
                 issues.push({
                    severity: "warning",
                    area: t('tab_planung'),
                    reference: formatDateKey(dateKey),
                    message: `${assignedName} ist eingeteilt für ${role.label}, hat aber für diesen Tag eine Sperre (Wunsch) eingetragen.`,
                    blocks: []
                });
            }
        });

        const assignmentsByName = {};
        ["AA", "VISITE", "OA"].forEach((roleKey) => {
            const assignedName = entry[roleKey];
            if (!assignedName) return;
            if (!assignmentsByName[assignedName]) assignmentsByName[assignedName] = [];
            assignmentsByName[assignedName].push(roleKey);
        });

        Object.entries(assignmentsByName).forEach(([name, rolesForPerson]) => {
            if (rolesForPerson.length < 2) return;
            issues.push({
                severity: "warning",
                area: t('tab_planung'),
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
                    area: t('tab_stationen'),
                    reference: week.key,
                    message: `${name} ist mehrfach im Stationsplan eingetragen: ${placements.join(", ")}.`,
                    blocks: []
                });
            }
            if (vacationDoctors.has(name)) {
                issues.push({
                    severity: "warning",
                    area: t('tab_stationen'),
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
