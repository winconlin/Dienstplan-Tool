// Station plan rendering and editing.

function renderStationPlan() {
    const monthValue = getSelectedMonthValue();
    const headerEl = document.getElementById("stationHeader");
    const bodyEl = document.getElementById("stationBody");
    const printTitle = document.getElementById("printHeaderStationTitle");
    if (!monthValue || !headerEl || !bodyEl || !printTitle) return;

    const [year, month] = monthValue.split("-").map(Number);
    const monthName = new Date(year, month - 1, 1).toLocaleString("de-DE", { month: "long" });
    printTitle.innerText = `Stationsbesetzung MED I - ${monthName} ${year}`;

    const weeks = getWeeksInMonth(year, month);
    headerEl.innerHTML = `
        <tr class="bg-slate-300 font-bold border-b border-slate-400 text-center align-middle">
            <th class="p-2 border-r border-slate-400 w-32" colspan="2">Kalenderwoche<br><span class="text-[9px] font-normal">1. Montag</span></th>
            ${weeks.map((week) => `<th class="p-2 border-r border-slate-400 w-24">${week.kw}<br><span class="text-[9px] font-normal">${week.mondayDateStr}</span></th>`).join("")}
        </tr>`;

    let tbody = "";
    let currentCategory = null;
    let categoryCount = 0;

    stationLayout.forEach((row, index) => {
        if (row.category !== currentCategory) {
            currentCategory = row.category;
            categoryCount = stationLayout.filter((item) => item.category === currentCategory).length;
        }

        let tableRow = `<tr class="border-b border-slate-300 text-center align-middle ${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100 transition">`;
        const isFirstInCategory = stationLayout.findIndex((item) => item.category === currentCategory) === index;
        const siblings = stationLayout.filter((item) => item.category === currentCategory);
        const hasSubRows = siblings.some((item) => item.name !== item.category);

        if (isFirstInCategory) {
            const colSpan = hasSubRows ? "" : 'colspan="2"';
            tableRow += `<td class="p-2 font-bold border-r border-slate-300" ${colSpan} rowspan="${categoryCount}">${row.category}</td>`;
        }

        if (hasSubRows) {
            const subText = row.name !== row.category ? row.name : "";
            tableRow += `<td class="p-1 border-r border-slate-300 text-[10px] whitespace-nowrap">${subText}</td>`;
        }

        weeks.forEach((week) => {
            const cellKey = `${week.key}_${row.id}`;
            const currentValue = stationPlan[cellKey] || "";
            let options = '<option value=""></option>';

            staff.forEach((person) => {
                let show = false;
                if (row.category === "Oberaerzte") show = matchesRole(person, "OA");
                else if (row.category === "EPU") show = matchesRole(person, "EPU");
                else if (row.category.includes("Urlaub") || row.category.includes("Zeitausgleich")) show = true;
                else show = matchesRole(person, "AA");

                if (show) {
                    options += `<option value="${person.name}" ${currentValue === person.name ? "selected" : ""}>${person.name}</option>`;
                }
            });

            tableRow += `
                <td class="p-0 border-r border-slate-300 relative">
                    <select onchange="saveStationPlan('${cellKey}', this.value)" class="w-full bg-transparent p-2 outline-none text-[11px] font-bold text-center print:appearance-none cursor-pointer">
                        ${options}
                    </select>
                </td>`;
        });

        tableRow += "</tr>";
        tbody += tableRow;
    });

    bodyEl.innerHTML = tbody;
    renderValidation();
}

function saveStationPlan(key, value) {
    const monthValue = getSelectedMonthValue();
    const { rowId } = parseStationCellKey(key);

    if (value) stationPlan[key] = value;
    else delete stationPlan[key];

    if ((rowId === "da_1" || rowId === "da_2") && monthValue) {
        if (value) applyDienstRowToPlan(monthValue, key, value);
        syncDienstRowsFromPlan(monthValue, { preserveExisting: false });
    }

    saveAndRenderPlanningViews();
}

