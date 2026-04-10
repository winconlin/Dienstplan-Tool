// Storage, snapshots and persisted configuration.

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
let atossHours = normalizeAtossHours(readStorage("mp_atoss_hours", defaultAtossHours));
const maxUndoSnapshots = 10;
let undoSnapshots = normalizeUndoSnapshots(readStorage("mp_undo_snapshots", []));
let storageStatus = { ok: true, message: "Lokale Speicherung aktiv." };
let lastStorageAlertMessage = "";

function buildStorageEntries(payload = buildAppStatePayload(), snapshots = undoSnapshots) {
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

function getStorageErrorMessage(error) {
    if (!error) return "Lokale Speicherung fehlgeschlagen.";

    const name = String(error.name || "");
    const message = String(error.message || "");
    const quotaError = name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014;

    if (quotaError || /quota/i.test(message)) {
        return "Lokale Speicherung fehlgeschlagen: Der Browser-Speicher ist voll.";
    }

    return `Lokale Speicherung fehlgeschlagen: ${message || name || "Unbekannter Fehler."}`;
}

function persistAppStateToStorage(storage = localStorage, payload = buildAppStatePayload(), snapshots = undoSnapshots) {
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

function renderStorageStatus() {
    const statusEl = document.getElementById("storageStatus");
    if (!statusEl) return;

    statusEl.textContent = storageStatus.message;
    statusEl.className = storageStatus.ok
        ? "mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800"
        : "mt-3 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800";
}

function save(options = {}) {
    const { storage = localStorage, suppressAlert = false } = options;
    const result = persistAppStateToStorage(storage);

    storageStatus = { ok: result.ok, message: result.message };
    renderStorageStatus();

    if (result.ok) {
        lastStorageAlertMessage = "";
        return result;
    }

    if (!suppressAlert && storage === localStorage && result.message !== lastStorageAlertMessage) {
        alert(`${result.message} Die Aenderungen bleiben nur in diesem Browser-Tab erhalten, bis die Speicherung wieder funktioniert.`);
        lastStorageAlertMessage = result.message;
    }

    return result;
}

function saveHolidaySeasonMode() {
    const checkbox = document.getElementById("holidaySeasonMode");
    holidaySeasonMode = checkbox ? checkbox.checked : false;
    save();
}

function syncConfigControls() {
    const holidayCheckbox = document.getElementById("holidaySeasonMode");
    if (holidayCheckbox) holidayCheckbox.checked = holidaySeasonMode;
    syncAtossHoursInputs();
    renderStorageStatus();
}

function getAtossHoursForDate(dateKey, role, holidayMode = holidaySeasonMode, settings = atossHours) {
    const normalizedSettings = normalizeAtossHours(settings);
    const roleSettings = normalizedSettings[role] || defaultAtossHours[role];
    return isWeekendOrHoliday(getDateFromKey(dateKey), holidayMode)
        ? roleSettings.weekendHoliday
        : roleSettings.weekday;
}

function syncAtossHoursInputs() {
    Object.entries(atossHours).forEach(([role, values]) => {
        const weekdayInput = document.getElementById(`atoss-${role}-weekday`);
        const weekendInput = document.getElementById(`atoss-${role}-weekendHoliday`);
        if (weekdayInput) weekdayInput.value = String(values.weekday);
        if (weekendInput) weekendInput.value = String(values.weekendHoliday);
    });
}

function saveAtossHours() {
    atossHours = normalizeAtossHours({
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

function buildAppStatePayload() {
    return {
        staff: cloneStateValue(staff) || [],
        plan: cloneStateValue(plan) || {},
        wishes: cloneStateValue(wishes) || {},
        stationPlan: cloneStateValue(stationPlan) || {},
        holidaySeasonMode,
        atossHours: cloneStateValue(atossHours) || cloneStateValue(defaultAtossHours)
    };
}

function applyNormalizedAppState(normalized) {
    staff = cloneStateValue(normalized.staff) || [];
    plan = cloneStateValue(normalized.plan) || {};
    wishes = cloneStateValue(normalized.wishes) || {};
    stationPlan = cloneStateValue(normalized.stationPlan) || {};
    holidaySeasonMode = Boolean(normalized.holidaySeasonMode);
    atossHours = normalizeAtossHours(normalized.atossHours);
}

function normalizeUndoSnapshots(source = []) {
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

function formatSnapshotTimestamp(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "unbekannter Zeitpunkt"
        : date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function renderSnapshotInfo() {
    const infoEl = document.getElementById("undoSnapshotInfo");
    const buttonEl = document.getElementById("undoSnapshotButton");
    if (!infoEl && !buttonEl) return;

    const latestSnapshot = undoSnapshots[0] || null;
    if (infoEl) {
        infoEl.textContent = latestSnapshot
            ? `${latestSnapshot.label} | ${formatSnapshotTimestamp(latestSnapshot.createdAt)} | ${undoSnapshots.length} gespeichert`
            : "Kein Snapshot verfuegbar.";
    }

    if (buttonEl) buttonEl.disabled = !latestSnapshot;
}

function createUndoSnapshot(label, payload = buildAppStatePayload()) {
    undoSnapshots = [
        {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: String(label || "Snapshot"),
            createdAt: new Date().toISOString(),
            state: cloneStateValue(payload)
        },
        ...undoSnapshots
    ].slice(0, maxUndoSnapshots);

    save({ suppressAlert: true });
    renderSnapshotInfo();
    return undoSnapshots[0];
}

function restoreLatestSnapshot(options = {}) {
    const { skipConfirm = false, skipAlert = false } = options;
    const latestSnapshot = undoSnapshots[0];

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

    undoSnapshots = undoSnapshots.slice(1);
    applyNormalizedAppState(validation.normalized);
    syncConfigControls();
    const saveResult = saveAndRenderAllDataViews();

    if (!skipAlert && saveResult.ok) alert("Snapshot wiederhergestellt.");
    return true;
}
