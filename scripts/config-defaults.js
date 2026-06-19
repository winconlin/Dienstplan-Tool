// Default operational configuration for MediPlan Pro Bayern.
// All department-specific rules live here. Other departments adapt these
// values via the Configuration UI without touching any JavaScript code.
//
// Structure:
//   roles[]    – one entry per planning slot (appears as table column)
//   shifts{}   – shift windows per role and day type
//   conflicts[]– rules that prevent certain role/date combinations

export const defaultConfig = {
    roles: [
        {
            id: "AA",
            label: "24h Dienst (AA)",
            required: true,
            showInStats: true,
            activeOnWeekendHolidayOnly: false,
            lohnart: "BD",
            icsLabel: "24h Dienst"
        },
        {
            id: "VISITE",
            label: "Visite (WE/FT)",
            required: false,
            showInStats: false,
            activeOnWeekendHolidayOnly: true,
            lohnart: "VIS",
            icsLabel: "Visite"
        },
        {
            id: "OA",
            label: "Hintergrund (OA)",
            required: true,
            showInStats: true,
            activeOnWeekendHolidayOnly: false,
            lohnart: "BD",
            icsLabel: "Hintergrund"
        }
    ],

    // Shift windows per role and day type.
    // startH/startM = start time; endH/endM = end time; nextDay = ends on following date.
    shifts: {
        AA: {
            weekday:       { startH: 15, startM: 0,  endH: 8,  endM: 0,  nextDay: true },
            friday:        { startH: 15, startM: 0,  endH: 9,  endM: 0,  nextDay: true },
            saturday:      { startH: 9,  startM: 0,  endH: 8,  endM: 30, nextDay: true },
            sundayHoliday: { startH: 8,  startM: 30, endH: 8,  endM: 0,  nextDay: true }
        },
        VISITE: {
            all: { startH: 9, startM: 0, endH: 14, endM: 0, nextDay: false }
        },
        OA: {
            all: { startH: 0, startM: 0, endH: 0, endM: 0, nextDay: false }
        }
    },

    // Conflict matrix.
    //   scope "sameDay" – roleA and blocksRoleB cannot be assigned to the same person on the same date.
    //   scope "nextDay" – if person did roleA on day D, they cannot be assigned blocksRoleB on day D+1
    //                     (Ruhezeit / mandatory rest after 24h shifts).
    conflicts: [
        { roleA: "AA",     blocksRoleB: "VISITE", scope: "sameDay" },
        { roleA: "VISITE", blocksRoleB: "AA",     scope: "sameDay" },
        { roleA: "AA",     blocksRoleB: "AA",     scope: "nextDay" },
        { roleA: "AA",     blocksRoleB: "OA",     scope: "nextDay" },
        { roleA: "AA",     blocksRoleB: "VISITE", scope: "nextDay" },
        { roleA: "OA",     blocksRoleB: "AA",     scope: "nextDay" },
        { roleA: "OA",     blocksRoleB: "OA",     scope: "nextDay" }
    ]
};
