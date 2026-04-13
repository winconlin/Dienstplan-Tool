import { normalizeAtossHours, getDateFromKey, isWeekendOrHoliday, cloneStateValue, isPlainObject, defaultAtossHours } from './core.js';
import { appState } from './state.js';
import { validateBackupPayload } from './validation.js';
import { saveAndRenderAllDataViews } from './ui-common.js';

// Storage, snapshots and persisted configuration.



export const maxUndoSnapshots = 10;

export function buildStorageEntries(payload = buildAppStatePayload(), snapshots = appState.undoSnapshots) {
    return [
        ["mp_staff", JSON.stringify(payload.staff)],
        ["mp_plan", JSON.stringify(payload.plan)],
        ["mp_wishes", JSON.stringify(payload.wishes)],
        ["mp_station", JSON.stringify(payload.stationPlan)],
        ["mp_holiday_mode", JSON.stringify(payload.holidaySeasonMode)],
        ["mp_atoss_hours", JSON.stringify(payload.atossHours)],
        ["mp_undo_snapshots", JSON.stringify(snapshots)]
    ];
}

export function getStorageErrorMessage(error) {
    if (!error) return "Lokale Speicherung fehlgeschlagen.";

    const name = String(error.name || "");
    const message = String(error.message || "");
    const quotaError = name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014;

    if (quotaError || /quota/i.test(message)) {
        return "Lokale Speicherung fehlgeschlagen: Der Browser-Speicher ist voll.";
    }

    return `Lokale Speicherung fehlgeschlagen: ${message || name || "Unbekannter Fehler."}`;
}

export function persistAppStateToStorage(storage = localStorage, payload = buildAppStatePayload(), snapshots = appState.undoSnapshots) {
    const entries = buildStorageEntries(payload, snapshots);
    const rollbackEntries = [];

    try {
        entries.forEach(([key, value]) => {
            const previousRaw = typeof storage.getItem === "function" ? storage.getItem(key) : null;
            rollbackEntries.push([key, previousRaw]);
            storage.setItem(key, value);
        });

        return { ok: true, message: "Lokale Speicherung aktiv." };
    } catch (error) {
        rollbackEntries.reverse().forEach(([key, previousRaw]) => {
            try {
                if (previousRaw === null || previousRaw === undefined) storage.removeItem?.(key);
                else storage.setItem(key, previousRaw);
            } catch {
                // Best effort rollback only.
            }
        });

        return { ok: false, message: getStorageErrorMessage(error) };
    }
}

export function renderStorageStatus() {
    const statusEl = document.getElementById("storageStatus");
    if (!statusEl) return;

    statusEl.textContent = appState.storageStatus.message;
    statusEl.className = appState.storageStatus.ok
        ? "mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800"
        : "mt-3 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800";
}

export function save(options = {}) {
    const { storage = localStorage, suppressAlert = false } = options;
    const result = persistAppStateToStorage(storage);

    appState.storageStatus = { ok: result.ok, message: result.message };
    renderStorageStatus();

    if (result.ok) {
        appState.lastStorageAlertMessage = "";
        return result;
    }

    if (!suppressAlert && storage === localStorage && result.message !== appState.lastStorageAlertMessage) {
        alert(`${result.message} Die Aenderungen bleiben nur in diesem Browser-Tab erhalten, bis die Speicherung wieder funktioniert.`);
        appState.lastStorageAlertMessage = result.message;
    }

    return result;
}

export function saveHolidaySeasonMode() {
    const checkbox = document.getElementById("holidaySeasonMode");
    appState.holidaySeasonMode = checkbox ? checkbox.checked : false;
    save();
}

export function syncConfigControls() {
    const holidayCheckbox = document.getElementById("holidaySeasonMode");
    if (holidayCheckbox) holidayCheckbox.checked = appState.holidaySeasonMode;
    syncAtossHoursInputs();
    renderStorageStatus();
}

export function getAtossHoursForDate(dateKey, role, holidayMode = appState.holidaySeasonMode, settings = appState.atossHours) {
    const normalizedSettings = normalizeAtossHours(settings);
    const roleSettings = normalizedSettings[role] || defaultAtossHours[role];
    return isWeekendOrHoliday(getDateFromKey(dateKey), holidayMode)
        ? roleSettings.weekendHoliday
        : roleSettings.weekday;
}

export function syncAtossHoursInputs() {
    Object.entries(appState.atossHours).forEach(([role, values]) => {
        const weekdayInput = document.getElementById(`atoss-${role}-weekday`);
        const weekendInput = document.getElementById(`atoss-${role}-weekendHoliday`);
        if (weekdayInput) weekdayInput.value = String(values.weekday);
        if (weekendInput) weekendInput.value = String(values.weekendHoliday);
    });
}

export function saveAtossHours() {
    appState.atossHours = normalizeAtossHours({
        AA: {
            weekday: document.getElementById("atoss-AA-weekday")?.value,
            weekendHoliday: document.getElementById("atoss-AA-weekendHoliday")?.value
        },
        VISITE: {
            weekday: document.getElementById("atoss-VISITE-weekday")?.value,
            weekendHoliday: document.getElementById("atoss-VISITE-weekendHoliday")?.value
        },
        OA: {
            weekday: document.getElementById("atoss-OA-weekday")?.value,
            weekendHoliday: document.getElementById("atoss-OA-weekendHoliday")?.value
        }
    });
    syncAtossHoursInputs();
    save();
}

export function buildAppStatePayload() {
    return {
        staff: cloneStateValue(appState.staff) || [],
        plan: cloneStateValue(appState.plan) || {},
        wishes: cloneStateValue(appState.wishes) || {},
        stationPlan: cloneStateValue(appState.stationPlan) || {},
        holidaySeasonMode: appState.holidaySeasonMode,
        atossHours: cloneStateValue(appState.atossHours) || cloneStateValue(defaultAtossHours)
    };
}

export function applyNormalizedAppState(normalized) {
    appState.staff = cloneStateValue(normalized.staff) || [];
    appState.plan = cloneStateValue(normalized.plan) || {};
    appState.wishes = cloneStateValue(normalized.wishes) || {};
    appState.stationPlan = cloneStateValue(normalized.stationPlan) || {};
    appState.holidaySeasonMode = Boolean(normalized.holidaySeasonMode);
    appState.atossHours = normalizeAtossHours(normalized.atossHours);
}

export function normalizeUndoSnapshots(source = []) {
    if (!Array.isArray(source)) return [];

    return source.map((entry, index) => {
        if (!isPlainObject(entry) || !isPlainObject(entry.state)) return null;

        const validation = validateBackupPayload(entry.state);
        if (!validation.ok) return null;

        return {
            id: String(entry.id || `snapshot-${index}`),
            label: String(entry.label || "Snapshot").trim() || "Snapshot",
            createdAt: entry.createdAt || new Date().toISOString(),
            state: validation.normalized
        };
    }).filter(Boolean).slice(0, maxUndoSnapshots);
}

export function formatSnapshotTimestamp(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "unbekannter Zeitpunkt"
        : date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export function renderSnapshotInfo() {
    const infoEl = document.getElementById("undoSnapshotInfo");
    const buttonEl = document.getElementById("undoSnapshotButton");
    if (!infoEl && !buttonEl) return;

    const latestSnapshot = appState.undoSnapshots[0] || null;
    if (infoEl) {
        infoEl.textContent = latestSnapshot
            ? `${latestSnapshot.label} | ${formatSnapshotTimestamp(latestSnapshot.createdAt)} | ${appState.undoSnapshots.length} gespeichert`
            : "Kein Snapshot verfuegbar.";
    }

    if (buttonEl) buttonEl.disabled = !latestSnapshot;
}

export function createUndoSnapshot(label, payload = buildAppStatePayload()) {
    appState.undoSnapshots = [
        {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: String(label || "Snapshot"),
            createdAt: new Date().toISOString(),
            state: cloneStateValue(payload)
        },
        ...appState.undoSnapshots
    ].slice(0, maxUndoSnapshots);

    save({ suppressAlert: true });
    renderSnapshotInfo();
    return appState.undoSnapshots[0];
}

export function restoreLatestSnapshot(options = {}) {
    const { skipConfirm = false, skipAlert = false } = options;
    const latestSnapshot = appState.undoSnapshots[0];

    if (!latestSnapshot) {
        if (!skipAlert) alert("Kein Snapshot zum Wiederherstellen verfuegbar.");
        return false;
    }

    if (!skipConfirm && !confirm(`Snapshot "${latestSnapshot.label}" vom ${formatSnapshotTimestamp(latestSnapshot.createdAt)} wiederherstellen?`)) {
        return false;
    }

    const validation = validateBackupPayload(latestSnapshot.state);
    if (!validation.ok) {
        if (!skipAlert) alert(validation.error);
        return false;
    }

    appState.undoSnapshots = appState.undoSnapshots.slice(1);
    applyNormalizedAppState(validation.normalized);
    syncConfigControls();
    const saveResult = saveAndRenderAllDataViews();

    if (!skipAlert && saveResult.ok) alert("Snapshot wiederhergestellt.");
    return true;
}

export function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

import { initializeState } from './core.js';
initializeState(readStorage);
