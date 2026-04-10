import { state, saveState, defaultStationLayout } from './state.js';
import { escapeHTML } from './utils.js';

export function renderStationEditor() {
    const container = document.getElementById("stationEditorList");
    if (!container) return;

    const layout = state.customStationLayout || defaultStationLayout;

    container.innerHTML = layout.map((row, index) => `
        <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-2 rounded border dark:border-slate-600 mb-1 text-[11px]">
            <span class="font-bold w-1/4 truncate" title="${escapeHTML(row.id)}">${escapeHTML(row.id)}</span>
            <span class="w-2/4 truncate" title="${escapeHTML(row.category)}">${escapeHTML(row.category)}</span>
            <span class="w-1/4 truncate text-slate-500 dark:text-slate-400" title="${escapeHTML(row.name)}">${escapeHTML(row.name)}</span>
            <button data-deletestation="${index}" class="text-red-500 font-bold px-2 hover:bg-red-100 dark:hover:bg-red-900 rounded">X</button>
        </div>
    `).join("");

    document.querySelectorAll("[data-deletestation]").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const idx = e.target.dataset.deletestation;
            if (!confirm("Station wirklich löschen?")) return;
            let newLayout = [...(state.customStationLayout || defaultStationLayout)];
            newLayout.splice(idx, 1);
            state.customStationLayout = newLayout;
            await saveState();
            renderStationEditor();
            import('./main.js').then(m => m.renderStationPlan());
        });
    });
}

export async function addStation() {
    const id = document.getElementById("seId").value.trim();
    const category = document.getElementById("seCategory").value.trim();
    let name = document.getElementById("seName").value.trim();

    if (!id || !category) {
        alert("ID und Kategorie sind Pflichtfelder.");
        return;
    }

    if (!name) name = category; // Fallback

    let newLayout = [...(state.customStationLayout || defaultStationLayout)];
    if (newLayout.some(r => r.id === id)) {
        alert("Diese ID existiert bereits.");
        return;
    }

    newLayout.push({ id, category, name });
    state.customStationLayout = newLayout;

    await saveState();

    document.getElementById("seId").value = "";
    document.getElementById("seCategory").value = "";
    document.getElementById("seName").value = "";

    renderStationEditor();
    import('./main.js').then(m => m.renderStationPlan());
}
