import { state, saveState } from './state.js';

export async function migrateLegacyData() {
    const legacyStaff = localStorage.getItem('mp_staff');
    if (legacyStaff) {
        try {
            state.staff = JSON.parse(legacyStaff);
            state.plan = JSON.parse(localStorage.getItem('mp_plan') || '{}');
            state.wishes = JSON.parse(localStorage.getItem('mp_wishes') || '{}');
            state.stationPlan = JSON.parse(localStorage.getItem('mp_station') || '{}');
            state.holidaySeasonMode = JSON.parse(localStorage.getItem('mp_holiday_mode') || 'false');
            state.customStationLayout = JSON.parse(localStorage.getItem('mp_custom_station_layout') || 'null');

            // Save to IndexedDB
            await saveState();

            // Clear legacy LocalStorage
            localStorage.removeItem('mp_staff');
            localStorage.removeItem('mp_plan');
            localStorage.removeItem('mp_wishes');
            localStorage.removeItem('mp_station');
            localStorage.removeItem('mp_holiday_mode');
            localStorage.removeItem('mp_custom_station_layout');

            console.log("Migration from localStorage to IndexedDB complete.");
        } catch (e) {
            console.error("Migration failed:", e);
        }
    }
}
