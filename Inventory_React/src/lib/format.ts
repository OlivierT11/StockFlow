// French formatting helpers, ported from the prototype.

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const integer = new Intl.NumberFormat("fr-FR");

export const fmtMoney = (n: number) => money.format(n);
export const fmtInt = (n: number) => integer.format(n);

export function fmtCompactMoney(n: number): string {
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M€`;
    if (Math.abs(n) >= 1e4) return `${(n / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€`;
    return fmtMoney(n);
}

/**
 * The API stores UTC dates, but EF Core reads them back with an unspecified kind,
 * so they can be serialized without "Z". Treat a zone-less date as UTC.
 */
export function toDate(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtDate(value: string | Date): string {
    const d = toDate(value);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtDateTime(value: string | Date): string {
    const d = toDate(value);
    return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local calendar day as YYYY-MM-DD (the value format of <input type="date">). */
export function isoDay(value: string | Date): string {
    const d = toDate(value);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(value: Date): Date {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Parses a YYYY-MM-DD value as local midnight. */
export function parseDay(day: string): Date {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d);
}

export function addDays(value: Date, days: number): Date {
    const d = new Date(value);
    d.setDate(d.getDate() + days);
    return d;
}

export function relTime(value: string | Date): string {
    const diff = Date.now() - toDate(value).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return "à l’instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const days = Math.round(h / 24);
    if (days === 1) return "hier";
    if (days < 7) return `il y a ${days} jours`;
    return fmtDate(value);
}

export function initials(email: string): string {
    return email
        .split("@")[0]
        .split(/[._-]/)
        .map((s) => s[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export const plural = (n: number, singular: string, pluralForm?: string) =>
    n > 1 ? (pluralForm ?? `${singular}s`) : singular;

export const productRef = (id: number) => `Réf. ${String(id).padStart(4, "0")}`;
