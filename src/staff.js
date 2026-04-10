import { state } from './state.js';

export function matchesRole(person, role) {
    if (role === "OA") return person.role === "OA" || person.role === "FOA" || person.role === "OA-EPU" || person.role === "FOA-EPU";
    if (role === "EPU") return person.role === "OA-EPU" || person.role === "FOA-EPU";
    return person.role === "AA" || person.role === "FOA" || person.role === "FOA-EPU";
}

export function getWorkPercent(person) {
    const parsed = Number(person.work);
    return parsed > 0 ? parsed : 100;
}

export function getActiveStaff(monthKey) {
    if (!monthKey) return state.staff;
    return state.staff.map(person => {
        if (!person.history) return person;
        const sortedKeys = Object.keys(person.history).sort();
        if (sortedKeys.length === 0) return person;

        let bestConfig = person.history[sortedKeys[0]] || {};
        for (const k of sortedKeys) {
            if (k <= monthKey) {
                bestConfig = person.history[k];
            } else {
                break;
            }
        }
        return { ...person, ...bestConfig };
    });
}
