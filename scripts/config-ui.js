import { appState } from './state.js';
import { getActiveConfig, normalizeConfig, cloneStateValue } from './core.js';
import { defaultConfig } from './config-defaults.js';
import { saveConfig } from './storage.js';
import { saveAndRenderAllDataViews } from './ui-common.js';

function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderConfigEditor() {
    const container = document.getElementById("configEditorContainer");
    if (!container) return;

    const cfg = getActiveConfig();

    const rolesHtml = cfg.roles.map((role, i) => `
        <tr class="border-b text-xs">
            <td class="p-2"><input class="border rounded p-1 w-full text-xs font-mono" data-cfg-role="${i}" data-field="id" value="${escapeHtml(role.id)}"></td>
            <td class="p-2"><input class="border rounded p-1 w-full text-xs" data-cfg-role="${i}" data-field="label" value="${escapeHtml(role.label)}"></td>
            <td class="p-2 text-center"><input type="checkbox" data-cfg-role="${i}" data-field="required" ${role.required ? "checked" : ""}></td>
            <td class="p-2 text-center"><input type="checkbox" data-cfg-role="${i}" data-field="showInStats" ${role.showInStats ? "checked" : ""}></td>
            <td class="p-2 text-center"><input type="checkbox" data-cfg-role="${i}" data-field="activeOnWeekendHolidayOnly" ${role.activeOnWeekendHolidayOnly ? "checked" : ""}></td>
            <td class="p-2"><input class="border rounded p-1 w-full text-xs font-mono" data-cfg-role="${i}" data-field="lohnart" value="${escapeHtml(role.lohnart || "")}"></td>
            <td class="p-2"><input class="border rounded p-1 w-full text-xs" data-cfg-role="${i}" data-field="icsLabel" value="${escapeHtml(role.icsLabel || "")}"></td>
            <td class="p-2 text-center"><button class="text-red-500 font-bold hover:bg-red-100 rounded px-2 py-1 text-xs" data-action="removeConfigRole" data-index="${i}">✕</button></td>
        </tr>`).join("");

    const conflictRoleOptions = (selected) => cfg.roles.map((r) =>
        `<option value="${escapeHtml(r.id)}" ${r.id === selected ? "selected" : ""}>${escapeHtml(r.id)}</option>`
    ).join("");

    const scopeOptions = (selected) => ["sameDay", "nextDay"].map((s) =>
        `<option value="${s}" ${s === selected ? "selected" : ""}>${s}</option>`
    ).join("");

    const conflictsHtml = cfg.conflicts.map((c, i) => `
        <tr class="border-b text-xs">
            <td class="p-2"><select class="border rounded p-1 text-xs" data-cfg-conflict="${i}" data-field="roleA">${conflictRoleOptions(c.roleA)}</select></td>
            <td class="p-2 text-center text-slate-400">→ blockiert</td>
            <td class="p-2"><select class="border rounded p-1 text-xs" data-cfg-conflict="${i}" data-field="blocksRoleB">${conflictRoleOptions(c.blocksRoleB)}</select></td>
            <td class="p-2"><select class="border rounded p-1 text-xs" data-cfg-conflict="${i}" data-field="scope">${scopeOptions(c.scope)}</select></td>
            <td class="p-2 text-center"><button class="text-red-500 font-bold hover:bg-red-100 rounded px-2 py-1 text-xs" data-action="removeConfigConflict" data-index="${i}">✕</button></td>
        </tr>`).join("");

    container.innerHTML = `
        <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-bold text-sm uppercase text-slate-600">Rollen</h3>
                <button data-action="addConfigRole" class="text-xs bg-blue-600 text-white px-3 py-1 rounded font-bold hover:bg-blue-700 transition">+ Rolle hinzufügen</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border text-xs">
                    <thead><tr class="bg-slate-100 text-left">
                        <th class="p-2 border">ID</th>
                        <th class="p-2 border">Bezeichnung</th>
                        <th class="p-2 border text-center">Pflicht</th>
                        <th class="p-2 border text-center">Statistik</th>
                        <th class="p-2 border text-center">Nur WE/FT</th>
                        <th class="p-2 border">Lohnart</th>
                        <th class="p-2 border">ICS-Label</th>
                        <th class="p-2 border"></th>
                    </tr></thead>
                    <tbody id="cfgRolesBody">${rolesHtml}</tbody>
                </table>
            </div>
        </div>

        <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-bold text-sm uppercase text-slate-600">Konflikt-Matrix</h3>
                <button data-action="addConfigConflict" class="text-xs bg-blue-600 text-white px-3 py-1 rounded font-bold hover:bg-blue-700 transition">+ Konflikt hinzufügen</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border text-xs">
                    <thead><tr class="bg-slate-100 text-left">
                        <th class="p-2 border">Rolle A</th>
                        <th class="p-2 border"></th>
                        <th class="p-2 border">Blockiert Rolle B</th>
                        <th class="p-2 border">Scope</th>
                        <th class="p-2 border"></th>
                    </tr></thead>
                    <tbody id="cfgConflictsBody">${conflictsHtml}</tbody>
                </table>
            </div>
        </div>

        <div class="flex gap-3 justify-end">
            <button data-action="saveConfigFromUI" class="bg-green-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-green-700 transition">Konfiguration speichern</button>
        </div>`;
}

function readConfigFromUI() {
    const container = document.getElementById("configEditorContainer");
    if (!container) return null;

    const cfg = getActiveConfig();
    const roles = cfg.roles.map((role, i) => {
        const get = (field) => container.querySelector(`[data-cfg-role="${i}"][data-field="${field}"]`);
        return {
            id: get("id")?.value?.trim() || role.id,
            label: get("label")?.value?.trim() || role.label,
            required: get("required")?.checked ?? role.required,
            showInStats: get("showInStats")?.checked ?? role.showInStats,
            activeOnWeekendHolidayOnly: get("activeOnWeekendHolidayOnly")?.checked ?? role.activeOnWeekendHolidayOnly,
            lohnart: get("lohnart")?.value?.trim() || role.lohnart,
            icsLabel: get("icsLabel")?.value?.trim() || role.icsLabel
        };
    });

    const conflicts = cfg.conflicts.map((conflict, i) => {
        const get = (field) => container.querySelector(`[data-cfg-conflict="${i}"][data-field="${field}"]`);
        return {
            roleA: get("roleA")?.value || conflict.roleA,
            blocksRoleB: get("blocksRoleB")?.value || conflict.blocksRoleB,
            scope: get("scope")?.value || conflict.scope
        };
    });

    return { roles, shifts: cfg.shifts, conflicts };
}

export async function saveConfigFromUI() {
    const raw = readConfigFromUI();
    if (!raw) return;

    const result = normalizeConfig(raw);
    if (!result.ok) {
        alert(`Konfigurationsfehler: ${result.error}`);
        return;
    }

    await saveConfig(result.config);
    await saveAndRenderAllDataViews();
    renderConfigEditor();
    alert("Konfiguration gespeichert.");
}

export async function resetConfig() {
    if (!confirm("Konfiguration auf Werkseinstellungen zurücksetzen?")) return;
    await saveConfig(cloneStateValue(defaultConfig));
    await saveAndRenderAllDataViews();
    renderConfigEditor();
}

export function addConfigRole() {
    const cfg = getActiveConfig();
    const newRole = { id: "NEU", label: "Neue Rolle", required: false, showInStats: false, activeOnWeekendHolidayOnly: false, lohnart: "BD", icsLabel: "Neue Rolle" };
    appState.config = { ...cfg, roles: [...cfg.roles, newRole] };
    renderConfigEditor();
}

export function removeConfigRole(index) {
    const cfg = getActiveConfig();
    const roles = cfg.roles.filter((_, i) => i !== Number(index));
    appState.config = { ...cfg, roles };
    renderConfigEditor();
}

export function addConfigConflict() {
    const cfg = getActiveConfig();
    const firstId = cfg.roles[0]?.id || "AA";
    appState.config = { ...cfg, conflicts: [...cfg.conflicts, { roleA: firstId, blocksRoleB: firstId, scope: "sameDay" }] };
    renderConfigEditor();
}

export function removeConfigConflict(index) {
    const cfg = getActiveConfig();
    const conflicts = cfg.conflicts.filter((_, i) => i !== Number(index));
    appState.config = { ...cfg, conflicts };
    renderConfigEditor();
}
