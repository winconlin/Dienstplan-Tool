// Simulation helpers used by the browser test harness.

function runAutoPlanSimulation(monthValue, source = {}) {
    return withTemporaryState(source, () => {
        fillPlanMonth(monthValue);
        return {
            plan: cloneStateValue(plan),
            stationPlan: cloneStateValue(stationPlan)
        };
    });
}

function runAutoStationPlanSimulation(monthValue, source = {}) {
    return withTemporaryState(source, () => {
        fillStationPlanMonth(monthValue);
        return {
            stationPlan: cloneStateValue(stationPlan)
        };
    });
}

function createSimulationHost(monthValue) {
    const host = document.createElement("div");
    host.innerHTML = `
        <input type="month" id="monthPicker">
        <input type="checkbox" id="holidaySeasonMode">
        <input type="number" id="atoss-AA-weekday">
        <input type="number" id="atoss-AA-weekendHoliday">
        <input type="number" id="atoss-VISITE-weekday">
        <input type="number" id="atoss-VISITE-weekendHoliday">
        <input type="number" id="atoss-OA-weekday">
        <input type="number" id="atoss-OA-weekendHoliday">
        <div id="displayMonth"></div>
        <div id="printHeaderTitle"></div>
        <div id="printHeaderStationTitle"></div>
        <table><thead id="stationHeader"></thead><tbody id="stationBody"></tbody></table>
        <table><tbody id="calendarBody"></tbody></table>
        <div id="statsTableAA"></div>
        <div id="statsTableOA"></div>
        <div id="staffList"></div>
        <div id="wishTableContainer"></div>
        <div id="validationSummary"></div>
        <div id="validationList"></div>
        <div id="storageStatus"></div>
        <div id="undoSnapshotInfo"></div>
        <button id="undoSnapshotButton"></button>`;

    document.body.appendChild(host);
    host.querySelector("#monthPicker").value = monthValue;
    return host;
}

function runCalendarRenderSimulation(monthValue, source = {}) {
    return withTemporaryState(source, () => {
        const host = createSimulationHost(monthValue);

        try {
            renderCalendar();
            return host.querySelector("#calendarBody")?.innerHTML || "";
        } finally {
            host.remove();
        }
    });
}

function runPlanEditSimulation(monthValue, updates, source = {}) {
    return withTemporaryState(source, () => {
        const host = createSimulationHost(monthValue);

        try {
            renderCalendar();
            renderStationPlan();

            updates.forEach(({ dateKey, role, value }) => {
                savePlan(dateKey, role, value);
            });

            return {
                plan: cloneStateValue(plan),
                stationPlan: cloneStateValue(stationPlan),
                calendarHtml: host.querySelector("#calendarBody")?.innerHTML || ""
            };
        } finally {
            host.remove();
        }
    });
}

function runStationPlanEditSimulation(monthValue, updates, source = {}) {
    return withTemporaryState(source, () => {
        const host = createSimulationHost(monthValue);

        try {
            renderCalendar();
            renderStationPlan();

            updates.forEach(({ key, value }) => {
                saveStationPlan(key, value);
            });

            return {
                plan: cloneStateValue(plan),
                stationPlan: cloneStateValue(stationPlan),
                calendarHtml: host.querySelector("#calendarBody")?.innerHTML || ""
            };
        } finally {
            host.remove();
        }
    });
}

function runUndoRestoreSimulation(monthValue, action, source = {}) {
    return withTemporaryState(source, () => {
        const host = createSimulationHost(monthValue);

        try {
            syncConfigControls();
            renderSnapshotInfo();
            renderCalendar();
            renderStationPlan();
            renderStaff();

            const before = buildAppStatePayload();

            if (action === "clearMonth") {
                createUndoSnapshot(`Vor Monat leeren ${monthValue}`);
                clearMonthData(monthValue);
                save();
                renderCalendar();
                renderStationPlan();
            } else if (action === "autoPlan") {
                createUndoSnapshot(`Vor Autoplaner ${monthValue}`);
                fillPlanMonth(monthValue);
                save();
                renderCalendar();
                renderStationPlan();
            } else if (action === "backupImport") {
                const validation = validateBackupPayload(source.importPayload);
                if (!validation.ok) throw new Error(validation.error);
                createUndoSnapshot("Vor Backup-Import Test");
                applyNormalizedAppState(validation.normalized);
                syncConfigControls();
                save();
                renderCalendar();
                renderStationPlan();
                renderStaff();
            } else {
                throw new Error(`Unbekannte Undo-Simulation: ${action}`);
            }

            const afterAction = buildAppStatePayload();
            const snapshotCountAfterAction = undoSnapshots.length;
            restoreLatestSnapshot({ skipConfirm: true, skipAlert: true });

            return {
                before,
                afterAction,
                afterRestore: buildAppStatePayload(),
                snapshotCountAfterAction,
                snapshotCountAfterRestore: undoSnapshots.length
            };
        } finally {
            host.remove();
        }
    });
}

function runStorageFailureSimulation(source = {}, options = {}) {
    return withTemporaryState(source, () => {
        const host = createSimulationHost(source.monthValue || getCurrentMonthValue());
        const failOnCall = Number(options.failOnCall) > 0 ? Number(options.failOnCall) : 1;
        const errorName = options.errorName || "QuotaExceededError";
        const errorMessage = options.errorMessage || "Quota exceeded";
        const initialStore = { ...(options.initialStore || {}) };
        let callCount = 0;

        const fakeStorage = {
            store: { ...initialStore },
            getItem(key) {
                return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
            },
            setItem(key, value) {
                callCount += 1;
                if (callCount === failOnCall) {
                    const error = new Error(errorMessage);
                    error.name = errorName;
                    error.code = errorName === "QuotaExceededError" ? 22 : 0;
                    throw error;
                }
                this.store[key] = String(value);
            },
            removeItem(key) {
                delete this.store[key];
            }
        };

        try {
            syncConfigControls();
            const result = save({ storage: fakeStorage, suppressAlert: true });
            return {
                result,
                store: { ...fakeStorage.store },
                storageStatus: { ...storageStatus }
            };
        } finally {
            host.remove();
            storageStatus = { ok: true, message: "Lokale Speicherung aktiv." };
            renderStorageStatus();
        }
    });
}

