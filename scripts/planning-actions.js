// Planning actions for user-triggered month operations.

function clearMonthData(monthValue) {
    getMonthDayKeys(monthValue).forEach((dayKey) => {
        plan[dayKey] = { AA: "", VISITE: "", OA: "" };
    });
    syncDienstRowsFromPlan(monthValue, { preserveExisting: false });
}

function clearMonth() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (!confirm("Moechten Sie den gesamten Plan fuer diesen Monat unwiderruflich loeschen?")) return;

    createUndoSnapshot(`Vor Monat leeren ${monthValue}`);
    clearMonthData(monthValue);
    saveAndRenderPlanningViews();
}

function clearWishesData(monthValue) {
    getMonthDayKeys(monthValue).forEach((dayKey) => delete wishes[dayKey]);
}

function clearWishes() {
    const monthValue = getSelectedMonthValue();
    if (!monthValue) return;
    if (!confirm("Moechten Sie alle Wuensche und Sperren fuer diesen Monat loeschen?")) return;

    createUndoSnapshot(`Vor Wuensche leeren ${monthValue}`);
    clearWishesData(monthValue);
    saveAndRenderCalendarView();
}

// Manual pre-planning remains authoritative; automatic planning only fills gaps around it.
