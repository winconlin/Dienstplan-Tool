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

// Manual pre-planning remains authoritative; automatic planning only fills gaps around it.
