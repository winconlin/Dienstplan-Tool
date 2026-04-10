export function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}

export function escapeICSText(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}

export function getHeatmapColor(value, min, max) {
    if (max <= min) return "transparent";
    const position = (value - min) / (max - min);
    return position < 0.5
        ? `rgba(${Math.floor(255 * position * 2)}, 255, 0, 0.3)`
        : `rgba(255, ${Math.floor(255 * (2 - position * 2))}, 0, 0.3)`;
}
