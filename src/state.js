import { getVal, setVal, pushHistory, popHistory } from './db.js';
import { showToast } from './ui.js';
import { t } from './i18n.js';

export const state = {
    staff: [],
    plan: {},
    wishes: {},
    stationPlan: {},
    holidaySeasonMode: false,
    customStationLayout: null,
};

export const defaultStationLayout = [
    { id: "s71_1", name: "Zimmer 1-4", category: "Station 7 - 1" },
    { id: "s71_2", name: "Zimmer 5-8", category: "Station 7 - 1" },
    { id: "s71_3", name: "Zimmer 13-18", category: "Station 7 - 1" },
    { id: "s51_1", name: "Zimmer 8-10", category: "Station 5 - 1" },
    { id: "s51_2", name: "Zimmer 11-14", category: "Station 5 - 1" },
    { id: "hkl", name: "HKL", category: "HKL" },
    { id: "cpu", name: "CPU", category: "CPU" },
    { id: "tk", name: "Tagesklinik/UKG", category: "Tagesklinik/UKG" },
    { id: "echo_1", name: "Echokardiographie", category: "Echokardiographie" },
    { id: "echo_2", name: "Echokardiographie", category: "Echokardiographie" },
    { id: "oa_1", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_2", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_3", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_4", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_5", name: "Oberärzte", category: "Oberärzte" },
    { id: "oa_6", name: "Oberärzte", category: "Oberärzte" },
    { id: "epu_1", name: "EPU", category: "EPU" },
    { id: "epu_2", name: "EPU", category: "EPU" },
    { id: "da_1", name: "Mo, Mi, Fr", category: "Dienstärzte" },
    { id: "da_2", name: "So, Di, Do", category: "Dienstärzte" },
    { id: "u1", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u2", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u3", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u4", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u5", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" },
    { id: "u6", name: "Urlaub / Zeitausgleich", category: "Urlaub / Zeitausgleich" }
];

export async function loadState() {
    state.staff = await getVal('staff', []);
    state.plan = await getVal('plan', {});
    state.wishes = await getVal('wishes', {});
    state.stationPlan = await getVal('stationPlan', {});
    state.holidaySeasonMode = await getVal('holidaySeasonMode', false);
    state.customStationLayout = await getVal('customStationLayout', null);
}

export async function saveState() {
    await setVal('staff', state.staff);
    await setVal('plan', state.plan);
    await setVal('wishes', state.wishes);
    await setVal('stationPlan', state.stationPlan);
    await setVal('holidaySeasonMode', state.holidaySeasonMode);
    await setVal('customStationLayout', state.customStationLayout);
}

export async function createSnapshot() {
    const snapshot = {
        plan: JSON.stringify(state.plan),
        stationPlan: JSON.stringify(state.stationPlan),
        wishes: JSON.stringify(state.wishes)
    };
    await pushHistory(snapshot);
}

export async function triggerUndo(renderCallback) {
    const lastSnapshot = await popHistory();
    if (!lastSnapshot) {
        showToast(t('toast_undo_empty'), 'warning');
        return;
    }

    state.plan = JSON.parse(lastSnapshot.plan);
    state.stationPlan = JSON.parse(lastSnapshot.stationPlan);
    state.wishes = JSON.parse(lastSnapshot.wishes);
    await saveState();

    if (renderCallback) renderCallback();
    showToast(t('toast_undo_success'), 'info');
}
