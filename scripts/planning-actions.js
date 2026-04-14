import { appState } from './state.js';
import { getMonthDayKeys, syncDienstRowsFromPlan } from './core.js';
import { createUndoSnapshot } from './storage.js';
import { getSelectedMonthValue, saveAndRenderPlanningViews, saveAndRenderCalendarView } from './ui-common.js';

// Planning actions for user-triggered month operations.

export function clearMonthData(monthValue) {
    getMonthDayKeys(monthValue).forEach((dayKey) => {
        appState.plan[dayKey] = { AA: "", VISITE: "", OA: "" };
    });
    syncDienstRowsFromPlan(monthValue, { preserveExisting: false });
}

export function clearMonth() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (!confirm("Moechten Sie den gesamten Plan fuer diesen Monat unwiderruflich loeschen?")) return;

    createUndoSnapshot(`Vor Monat leeren ${monthValue}`);
    clearMonthData(monthValue);
    saveAndRenderPlanningViews();
}

export function clearWishesData(monthValue) {
    getMonthDayKeys(monthValue).forEach((dayKey) => delete appState.wishes[dayKey]);
}

export function clearWishes() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (!confirm("Moechten Sie alle Wuensche und Sperren fuer diesen Monat loeschen?")) return;

    createUndoSnapshot(`Vor Wuensche leeren ${monthValue}`);
    clearWishesData(monthValue);
    saveAndRenderCalendarView();
}

export function clearStationPlanData(monthValue) {
    Object.keys(appState.stationPlan).forEach((key) => {
        if (key.startsWith(monthValue)) {
            delete appState.stationPlan[key];
        }
    });
}

export function clearStationPlan() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (!confirm("Moechten Sie den Stationsplan fuer diesen Monat leeren?")) return;

    createUndoSnapshot(`Vor Stationsplan leeren ${monthValue}`);
    clearStationPlanData(monthValue);
    import('./ui-common.js').then((module) => module.saveAndRenderStationView());
}

// Manual pre-planning remains authoritative; automatic planning only fills gaps around it.

import { getWeeksInMonth } from './planning-engine.js';
import { saveAndRenderStationView } from './ui-common.js';

export function clearStationPlan() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (!confirm("Moechten Sie die Stationsbesetzung fuer diesen Monat unwiderruflich loeschen?")) return;

    createUndoSnapshot(`Vor Stationen leeren ${monthValue}`);

    const [year, month] = monthValue.split("-").map(Number);
    const weeks = getWeeksInMonth(year, month);
    const weekKeys = weeks.map(w => w.key);

    Object.keys(appState.stationPlan).forEach(key => {
        const weekKey = key.split('_')[0];
        if (weekKeys.includes(weekKey)) {
            delete appState.stationPlan[key];
        }
    });

    saveAndRenderStationView();
}
