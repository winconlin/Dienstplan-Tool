import { state } from './state.js';
import { t } from './i18n.js';

export function getMonthDayKeys(monthValue) {
    if (!monthValue) return [];
    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
        return `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    });
}

export function getDateFromKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function formatDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-");
    return `${day}.${month}.${year}`;
}

export function getCurrentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

export function getHolidayName(date, holidayMode = state.holidaySeasonMode) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const fixedHolidays = {
        "1.1": t('holiday_neujahr'),
        "6.1": t('holiday_heilige_drei'),
        "1.5": t('holiday_tag_arbeit'),
        "15.8": t('holiday_mariae_himmelfahrt'),
        "3.10": t('holiday_tag_dt_einheit'),
        "1.11": t('holiday_allerheiligen'),
        "25.12": t('holiday_weihnachten_1'),
        "26.12": t('holiday_weihnachten_2')
    };

    if (holidayMode) {
        const start = new Date(year, 11, 24);
        while (start.getDay() !== 6) start.setDate(start.getDate() - 1);

        const end = month === 1 && day <= 15 ? new Date(year, 0, 6) : new Date(year + 1, 0, 6);
        while (end.getDay() !== 0) end.setDate(end.getDate() + 1);

        if (date >= start && date <= end) return t('holiday_winterplan');
    }

    const fixedName = fixedHolidays[`${day}.${month}`];
    if (fixedName) return fixedName;

    const easter = getEasterSunday(year);
    const diff = Math.round((date - easter) / 86400000);
    if (diff === -2) return t('holiday_karfreitag');
    if (diff === 1) return t('holiday_ostermontag');
    if (diff === 39) return t('holiday_christi_himmelfahrt');
    if (diff === 50) return t('holiday_pfingstmontag');
    if (diff === 60) return t('holiday_fronleichnam');

    const bussUndBettag = new Date(year, 10, 22);
    while (bussUndBettag.getDay() !== 3) bussUndBettag.setDate(bussUndBettag.getDate() - 1);
    if (day === bussUndBettag.getDate() && month === 11) return t('holiday_buss_bettag');

    return null;
}

export function isHoliday(date) {
    return getHolidayName(date);
}

export function isVisitDay(date, holidayMode = state.holidaySeasonMode) {
    return date.getDay() === 6 || Boolean(getHolidayName(date, holidayMode));
}

export function isWeekendOrHoliday(date, holidayMode = state.holidaySeasonMode) {
    return date.getDay() === 0 || date.getDay() === 6 || Boolean(getHolidayName(date, holidayMode));
}

export function getICSStartTime(dateKey, role, holidayMode = state.holidaySeasonMode) {
    if (role === "VISITE") return "090000";
    return isWeekendOrHoliday(getDateFromKey(dateKey), holidayMode) ? "090000" : "150000";
}

export function getWeeksInMonth(year, month) {
    const weeks = [];
    const date = new Date(year, month - 1, 1);

    while (date.getDay() !== 1) {
        date.setDate(date.getDate() - 1);
    }

    const cursor = new Date(date);
    const endMonth = new Date(year, month, 0);

    while (cursor <= endMonth) {
        const isoDate = new Date(cursor);
        isoDate.setHours(0, 0, 0, 0);
        isoDate.setDate(isoDate.getDate() + 4 - (isoDate.getDay() || 7));
        const yearStart = new Date(isoDate.getFullYear(), 0, 1);
        const weekOne = new Date(yearStart);
        weekOne.setDate(weekOne.getDate() + 4 - (weekOne.getDay() || 7));
        const weekNumber = 1 + Math.round(((isoDate.getTime() - weekOne.getTime()) / 86400000 - 3 + (weekOne.getDay() + 6) % 7) / 7);

        weeks.push({
            kw: weekNumber,
            mondayDateStr: `${String(cursor.getDate()).padStart(2, "0")}.${String(cursor.getMonth() + 1).padStart(2, "0")}.${String(cursor.getFullYear()).slice(-2)}`,
            key: `${year}-KW${String(weekNumber).padStart(2, "0")}`
        });
        cursor.setDate(cursor.getDate() + 7);
    }

    return weeks;
}
