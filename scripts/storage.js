import { normalizeAtossHours, getDateFromKey, isWeekendOrHoliday, cloneStateValue, isPlainObject, defaultAtossHours } from './core.js';
import { appState } from './state.js';
import { validateBackupPayload } from './validation.js';
import { saveAndRenderAllDataViews } from './ui-common.js';

// Storage, snapshots and persisted configuration.



export const maxUndoSnapshots = 5;

// Approximate byte size of the serialized snapshot array.
function estimateSnapshotBytes(snapshots) {
    try { return JSON.stringify(snapshots).length; } catch { return Infinity; }
}

// Trim oldest snapshots until the array fits within maxBytes or only one
// entry remains (we never discard the most recent snapshot entirely).
function pruneSnapshotsToFit(snapshots, maxBytes = 1_500_000) {
    let pruned = snapshots.slice();
    while (pruned.length > 1 && estimateSnapshotBytes(pruned) > maxBytes) {
        pruned = pruned.slice(0, -1);
    }
    return pruned;
}

export function buildStorageEntries(payload = buildAppStatePayload(), snapshots = appState.undoSnapshots) {
    return [
        ["mp_staff", JSON.stringify(payload.staff)],
        ["mp_plan", JSON.stringify(payload.plan)],
        ["mp_wishes", JSON.stringify(payload.wishes)],
        ["mp_station", JSON.stringify(payload.stationPlan)],
        ["mp_station_layout", JSON.stringify(payload.stationLayout)],
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

// Simple IndexedDB wrapper
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MediPlanDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('store')) {
                db.createObjectStore('store');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbSetMany(entries) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('store', 'readwrite');
        const store = transaction.objectStore('store');

        entries.forEach(([key, value]) => {
            store.put(value, key);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('store', 'readonly');
        const store = transaction.objectStore('store');
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Synchronous persistence for injected storages (used by the test harness).
// Writes all entries with best-effort rollback on failure.
function persistToSyncStorage(storage, entries) {
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

// Async persistence to IndexedDB (real-app default). Resolves only after the
// transaction has committed, so callers can rely on durable persistence before
// giving positive feedback or running follow-up actions. Never throws.
export async function persistAppStateToStorageAsync(payload = buildAppStatePayload(), snapshots = appState.undoSnapshots) {
    // Proactively trim snapshot history if it's already large so we stay well
    // under the IndexedDB quota before even attempting the write.
    let snapshotsToSave = pruneSnapshotsToFit(snapshots);

    const entries = buildStorageEntries(payload, snapshotsToSave);
    try {
        await idbSetMany(entries);
        // Sync pruned list back so in-memory state stays consistent.
        if (snapshotsToSave.length < snapshots.length) {
            appState.undoSnapshots = snapshotsToSave;
        }
        return { ok: true, message: "Lokale Speicherung aktiv. (IndexedDB)" };
    } catch (error) {
        const isQuota = error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014 || /quota/i.test(String(error.message)));
        if (isQuota && snapshotsToSave.length > 0) {
            // Retry once without any snapshots to salvage the core plan data.
            try {
                await idbSetMany(buildStorageEntries(payload, []));
                appState.undoSnapshots = [];
                return { ok: true, message: "Lokale Speicherung aktiv. Snapshot-Verlauf wurde geleert, um Speicherplatz freizugeben." };
            } catch {
                // Fall through to the original error.
            }
        }
        return { ok: false, message: getStorageErrorMessage(error) };
    }
}

// Backwards-compatible entry point. For an injected synchronous storage it
// writes synchronously and returns the result object (test path). For the
// default localStorage it delegates to the async IndexedDB persistence and
// returns a Promise resolving to the result object (real-app path).
export function persistAppStateToStorage(storage = localStorage, payload = buildAppStatePayload(), snapshots = appState.undoSnapshots) {
    const entries = buildStorageEntries(payload, snapshots);

    if (storage && storage.setItem && storage !== localStorage) {
        return persistToSyncStorage(storage, entries);
    }

    return persistAppStateToStorageAsync(payload, snapshots);
}

export function renderStorageStatus() {
    const statusEl = document.getElementById("storageStatus");
    if (!statusEl) return;

    statusEl.textContent = appState.storageStatus.message;
    statusEl.className = appState.storageStatus.ok
        ? "mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800"
        : "mt-3 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800";
}

// Applies a finished persistence result to the app status and surfaces an
// alert on failure. isLocalStorage gates the (real-app) failure alert so the
// synchronous test path stays silent unless explicitly allowed.
function finalizeSaveResult(result, { suppressAlert = false, isLocalStorage = true } = {}) {
    appState.storageStatus = { ok: result.ok, message: result.message };
    renderStorageStatus();

    if (result.ok) {
        appState.lastStorageAlertMessage = "";
        return result;
    }

    if (!suppressAlert && isLocalStorage && result.message !== appState.lastStorageAlertMessage) {
        alert(`${result.message} Die Aenderungen bleiben nur in diesem Browser-Tab erhalten, bis die Speicherung wieder funktioniert.`);
        appState.lastStorageAlertMessage = result.message;
    }

    return result;
}

// Awaits durable persistence (IndexedDB) before updating status/feedback.
// Use this whenever a follow-up action must only run once data is safely
// persisted (positive toast/alert, export, irreversible state changes).
export async function saveAsync(options = {}) {
    const { suppressAlert = false } = options;
    const result = await persistAppStateToStorageAsync();
    return finalizeSaveResult(result, { suppressAlert, isLocalStorage: true });
}

// For an injected synchronous storage (tests) this returns the result object
// synchronously. For the default localStorage (real app) it persists durably
// via IndexedDB and returns a Promise resolving to the result object.
export function save(options = {}) {
    const { storage = localStorage, suppressAlert = false } = options;

    if (storage && storage.setItem && storage !== localStorage) {
        const result = persistAppStateToStorage(storage);
        return finalizeSaveResult(result, { suppressAlert, isLocalStorage: false });
    }

    return saveAsync({ suppressAlert });
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
        stationLayout: cloneStateValue(appState.stationLayout) || null,
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
    const candidate = [
        {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: String(label || "Snapshot"),
            createdAt: new Date().toISOString(),
            state: cloneStateValue(payload)
        },
        ...appState.undoSnapshots
    ].slice(0, maxUndoSnapshots);
    appState.undoSnapshots = pruneSnapshotsToFit(candidate);

    save({ suppressAlert: true });
    renderSnapshotInfo();
    return appState.undoSnapshots[0];
}

export async function restoreLatestSnapshot(options = {}) {
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
    // Await durable persistence before confirming success to the user.
    const saveResult = await saveAndRenderAllDataViews();

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

export async function readStorageAsync(key, fallback) {
    try {
        const raw = await idbGet(key);
        if (raw) return JSON.parse(raw);
    } catch {
        // Fallback to localStorage migration
    }
    return readStorage(key, fallback);
}

import { initializeState } from './core.js';

// Initialize synchronous state from localStorage first, then async IDB overwrite
initializeState(readStorage);

// Attempt to overwrite state with IDB data if available
Promise.all(buildStorageEntries().map(([key]) => idbGet(key))).then(results => {
    let hasIdbData = false;
    results.forEach((res) => { if(res) hasIdbData = true; });

    if (hasIdbData) {
        appState.staff = results[0] ? JSON.parse(results[0]) : [];
        appState.plan = results[1] ? JSON.parse(results[1]) : {};
        appState.wishes = results[2] ? JSON.parse(results[2]) : {};
        appState.stationPlan = results[3] ? JSON.parse(results[3]) : {};
        appState.stationLayout = results[4] ? JSON.parse(results[4]) : null;
        appState.holidaySeasonMode = results[5] ? JSON.parse(results[5]) : false;
        appState.atossHours = results[6] ? JSON.parse(results[6]) : appState.atossHours;
        appState.undoSnapshots = results[7] ? JSON.parse(results[7]) : [];

        if (appState.stationLayout && Array.isArray(appState.stationLayout)) {
            // Assume updateStationLayout is available globally or we mutate state
            appState.stationLayout.forEach((v, i) => {
               // Update global if needed, but the initialize step already handles core.js state sync
            });
        }

        saveAndRenderAllDataViews();
    }
}).catch(console.error);
