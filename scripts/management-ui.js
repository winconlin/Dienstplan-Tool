// Navigation, staff management and wishes UI.

function showSection(id) {
    document.querySelectorAll(".section-content").forEach((section) => section.classList.add("hidden"));
    document.getElementById(`section-${id}`)?.classList.remove("hidden");

    document.querySelectorAll("header nav button").forEach((button) => {
        button.classList.remove("text-blue-300", "border-b-2", "border-blue-300");
        if ((button.getAttribute("onclick") || "").includes(`'${id}'`)) {
            button.classList.add("text-blue-300", "border-b-2", "border-blue-300");
        }
    });

    if (id === "personal") renderStaff();
    if (id === "validation") renderValidation();
}

function savePerson() {
    const name = document.getElementById("pName")?.value.trim() || "";
    const id = document.getElementById("pId")?.value.trim() || "";
    const role = document.getElementById("pRole")?.value || "AA";
    const workInput = Number(document.getElementById("pWork")?.value);
    const work = workInput > 0 ? Math.min(workInput, 100) : 100;
    const error = getPersonValidationError({ name, id }, staff);

    if (error) {
        alert(error);
        return;
    }

    staff.push({ name, id: normalizeAtossId(id), role, work });
    saveAndRenderAllDataViews();

    document.getElementById("pName").value = "";
    document.getElementById("pId").value = "";
    document.getElementById("pWork").value = "";
}

function removePerson(index) {
    const person = staff[index];
    if (!person) return;
    if (!confirm(`Soll ${person.name} wirklich entfernt werden? Zugeordnete Dienste, Sperren und Stationsfelder werden ebenfalls geleert.`)) return;

    staff.splice(index, 1);

    Object.keys(plan).forEach((dateKey) => {
        ["AA", "VISITE", "OA"].forEach((role) => {
            if (plan[dateKey]?.[role] === person.name) plan[dateKey][role] = "";
        });
    });

    Object.keys(wishes).forEach((dateKey) => {
        wishes[dateKey] = (wishes[dateKey] || []).filter((name) => name !== person.name);
        if (!wishes[dateKey].length) delete wishes[dateKey];
    });

    Object.keys(stationPlan).forEach((key) => {
        if (stationPlan[key] === person.name) delete stationPlan[key];
    });

    saveAndRenderAllDataViews();
}

function renderStaff() {
    const staffList = document.getElementById("staffList");
    if (!staffList) return;
    const duplicateIds = new Set(getDuplicateAtossAssignments().map((entry) => entry.id));

    staffList.innerHTML = staff.map((person, index) => {
        const details = [person.role, `${getWorkPercent(person)}%`];
        const normalizedId = normalizeAtossId(person.id);
        if (normalizedId) details.unshift(normalizedId);

        const duplicateBadge = duplicateIds.has(normalizedId)
            ? ' <span class="text-red-600 font-bold">Atoss-ID doppelt</span>'
            : "";

        return `<div class="bg-slate-50 p-1 border rounded flex justify-between text-[10px] items-center mb-1"><span><span class="font-bold">${person.name}</span> <span class="text-slate-500">(${details.join(" | ")})</span>${duplicateBadge}</span><button onclick="removePerson(${index})" class="text-red-500 font-bold px-2">X</button></div>`;
    }).join("");
}

function renderWishMatrix() {
    const monthValue = getSelectedMonthValue();
    const container = document.getElementById("wishTableContainer");
    if (!monthValue || !container) return;

    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let head = '<tr><th class="border p-1 bg-slate-100">Tag</th>';
    staff.forEach((person) => {
        head += `<th class="border p-1 text-[8px] h-24 align-bottom" style="writing-mode: vertical-rl;">${person.name}</th>`;
    });
    head += "</tr>";

    let body = "";
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let row = `<tr><td class="p-1 border bg-slate-50 text-center font-bold text-[10px]">${day}</td>`;
        staff.forEach((person) => {
            const isSet = (wishes[dateKey] || []).includes(person.name);
            row += `<td class="border text-center cursor-pointer ${isSet ? "bg-purple-500 text-white" : ""}" onclick="toggleWish('${dateKey}', '${person.name}')">${isSet ? "X" : ""}</td>`;
        });
        body += `${row}</tr>`;
    }

    container.innerHTML = `<h2 class="text-xl font-bold mb-4 text-purple-700 uppercase">Wuensche / Sperren</h2><table class="w-full text-xs border-collapse">${head}${body}</table>`;
}

function toggleWish(dateKey, name) {
    if (!wishes[dateKey]) wishes[dateKey] = [];
    wishes[dateKey] = wishes[dateKey].includes(name)
        ? wishes[dateKey].filter((item) => item !== name)
        : [...wishes[dateKey], name];
    saveAndRenderCalendarView();
}
