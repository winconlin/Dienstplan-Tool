export function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    const colors = {
        info: "bg-blue-600",
        success: "bg-green-600",
        warning: "bg-orange-500",
        error: "bg-red-600"
    };
    toast.className = `${colors[type]} text-white px-4 py-2 rounded shadow-lg text-sm transition-opacity duration-300 opacity-0`;
    toast.innerText = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.remove("opacity-0"));

    setTimeout(() => {
        toast.classList.add("opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function showSection(id) {
    document.querySelectorAll(".section-content").forEach((section) => section.classList.add("hidden"));
    document.getElementById(`section-${id}`)?.classList.remove("hidden");

    document.querySelectorAll("header nav button").forEach((button) => {
        button.classList.remove("text-blue-300", "border-b-2", "border-blue-300");
        if (button.dataset.target === id) {
            button.classList.add("text-blue-300", "border-b-2", "border-blue-300");
        }
    });
}
