
export const appState = {
  staff: [],
  plan: {},
  wishes: {},
  stationPlan: {},
  stationLayout: null,
  holidaySeasonMode: false,
  atossHours: { AA: { weekday: 17, weekendHoliday: 17 }, VISITE: { weekday: 5, weekendHoliday: 5 }, OA: { weekday: 17, weekendHoliday: 17 } },
  undoSnapshots: [],
  storageStatus: { ok: true, message: "Lokale Speicherung aktiv." },
  lastStorageAlertMessage: "",
};

// Optional strict mode update helper to prepare for full Redux-like architecture
export function updateAppState(slice, payload) {
    if (Object.prototype.hasOwnProperty.call(appState, slice)) {
        appState[slice] = payload;
    } else {
        console.warn(`Attempted to update non-existent state slice: ${slice}`);
    }
}
