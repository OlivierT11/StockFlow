import { afterEach, describe, expect, it, vi } from "vitest";
import {
    addDays,
    fmtCompactMoney,
    fmtDate,
    fmtDateTime,
    fmtInt,
    fmtMoney,
    initials,
    isoDay,
    parseDay,
    plural,
    productRef,
    relTime,
    startOfDay,
    toDate,
} from "./format";

/** Intl separates thousands with U+202F and puts U+00A0 before "€": compare with plain spaces. */
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("fmtMoney / fmtInt", () => {
    it("formats euros the French way, always with two decimals", () => {
        expect(plain(fmtMoney(1234.5))).toBe("1 234,50 €");
        expect(plain(fmtMoney(0))).toBe("0,00 €");
        expect(plain(fmtMoney(-3))).toBe("-3,00 €");
    });

    it("groups the thousands of an integer", () => {
        expect(plain(fmtInt(1234567))).toBe("1 234 567");
        expect(fmtInt(42)).toBe("42");
    });
});

describe("fmtCompactMoney", () => {
    it("uses millions from 1 M€, with up to two decimals", () => {
        expect(fmtCompactMoney(2_500_000)).toBe("2,5 M€");
        expect(fmtCompactMoney(1_234_567)).toBe("1,23 M€");
        expect(fmtCompactMoney(-1_000_000)).toBe("-1 M€");
    });

    it("uses thousands from 10 k€, with up to one decimal", () => {
        expect(fmtCompactMoney(12_345)).toBe("12,3 k€");
        expect(fmtCompactMoney(10_000)).toBe("10 k€");
        expect(fmtCompactMoney(-45_000)).toBe("-45 k€");
    });

    it("falls back to the full amount below 10 k€", () => {
        expect(plain(fmtCompactMoney(9_999.5))).toBe("9 999,50 €");
    });
});

describe("toDate", () => {
    it("returns a Date as is", () => {
        const d = new Date();
        expect(toDate(d)).toBe(d);
    });

    it("reads a date without a zone designator as UTC", () => {
        expect(toDate("2026-10-17T10:00:00").toISOString()).toBe("2026-10-17T10:00:00.000Z");
        expect(toDate("2026-10-17T10:00:00.1234567").toISOString()).toBe("2026-10-17T10:00:00.123Z");
    });

    it("keeps an explicit zone", () => {
        expect(toDate("2026-10-17T10:00:00Z").toISOString()).toBe("2026-10-17T10:00:00.000Z");
        expect(toDate("2026-10-17T10:00:00z").toISOString()).toBe("2026-10-17T10:00:00.000Z");
        expect(toDate("2026-10-17T10:00:00+02:00").toISOString()).toBe("2026-10-17T08:00:00.000Z");
        expect(toDate("2026-10-17T10:00:00-0130").toISOString()).toBe("2026-10-17T11:30:00.000Z");
    });
});

describe("fmtDate / fmtDateTime / isoDay", () => {
    it("formats in local time (Europe/Paris)", () => {
        // 23:30 UTC on 16 October is 01:30 on the 17th in Paris (UTC+2).
        expect(fmtDate("2026-10-16T23:30:00Z")).toBe("17/10/2026");
        expect(fmtDateTime("2026-10-16T23:30:00")).toBe("17/10/2026 01:30");
        expect(isoDay("2026-10-16T23:30:00Z")).toBe("2026-10-17");
    });

    it("pads days, months, hours and minutes", () => {
        expect(fmtDate(new Date(2026, 0, 5))).toBe("05/01/2026");
        expect(fmtDateTime(new Date(2026, 2, 9, 7, 4))).toBe("09/03/2026 07:04");
        expect(isoDay(new Date(2026, 2, 9))).toBe("2026-03-09");
    });
});

describe("day helpers", () => {
    it("startOfDay returns local midnight without changing its argument", () => {
        const value = new Date(2026, 9, 17, 15, 42, 10, 500);
        const start = startOfDay(value);
        expect(start).toEqual(new Date(2026, 9, 17));
        expect(value).toEqual(new Date(2026, 9, 17, 15, 42, 10, 500));
    });

    it("parseDay reads YYYY-MM-DD as local midnight", () => {
        const d = parseDay("2026-03-29");
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 2, 29, 0, 0]);
        expect(isoDay(parseDay("2026-12-31"))).toBe("2026-12-31");
    });

    it("addDays moves by calendar days, across a DST change, without changing its argument", () => {
        const value = new Date(2026, 2, 28, 12); // the clocks go forward on 29 March 2026
        expect(addDays(value, 1)).toEqual(new Date(2026, 2, 29, 12));
        expect(addDays(value, -28)).toEqual(new Date(2026, 1, 28, 12));
        expect(addDays(new Date(2026, 11, 31), 1)).toEqual(new Date(2027, 0, 1));
        expect(value).toEqual(new Date(2026, 2, 28, 12));
    });
});

describe("relTime", () => {
    const NOW = new Date("2026-10-17T12:00:00Z");
    const ago = (ms: number) => new Date(NOW.getTime() - ms);
    const MIN = 60_000;
    const HOUR = 60 * MIN;
    const DAY = 24 * HOUR;

    afterEach(() => {
        vi.useRealTimers();
    });

    function at(now: Date) {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(now);
    }

    it("says « à l’instant » under 30 seconds", () => {
        at(NOW);
        expect(relTime(ago(0))).toBe("à l’instant");
        expect(relTime(ago(29_000))).toBe("à l’instant");
    });

    it("counts minutes under an hour", () => {
        at(NOW);
        expect(relTime(ago(MIN))).toBe("il y a 1 min");
        expect(relTime(ago(5 * MIN))).toBe("il y a 5 min");
        expect(relTime(ago(59 * MIN))).toBe("il y a 59 min");
    });

    it("counts hours under a day, rounded", () => {
        at(NOW);
        expect(relTime(ago(60 * MIN))).toBe("il y a 1 h");
        expect(relTime(ago(90 * MIN))).toBe("il y a 2 h");
        expect(relTime(ago(23 * HOUR))).toBe("il y a 23 h");
    });

    it("says « hier » for about one day, then counts days under a week", () => {
        at(NOW);
        expect(relTime(ago(DAY))).toBe("hier");
        expect(relTime(ago(30 * HOUR))).toBe("hier");
        expect(relTime(ago(2 * DAY))).toBe("il y a 2 jours");
        expect(relTime(ago(6 * DAY))).toBe("il y a 6 jours");
    });

    it("shows the date from a week ago", () => {
        at(NOW);
        expect(relTime(ago(7 * DAY))).toBe("10/10/2026");
        expect(relTime(ago(10 * DAY))).toBe("07/10/2026");
    });

    it("reads API dates without a zone as UTC", () => {
        at(NOW);
        expect(relTime("2026-10-17T11:55:00")).toBe("il y a 5 min");
        expect(relTime("2026-10-17T09:00:00")).toBe("il y a 3 h");
    });
});

describe("initials", () => {
    it("takes the first letter of up to two parts of the local part", () => {
        expect(initials("claire.martin@inventory.fr")).toBe("CM");
        expect(initials("jean-pierre_dupont@inventory.fr")).toBe("JP");
        expect(initials("admin@inventory.fr")).toBe("A");
    });

    it("skips empty parts", () => {
        expect(initials("a..b@inventory.fr")).toBe("AB");
        expect(initials("")).toBe("");
    });
});

describe("plural", () => {
    it("is singular for 0 and 1, plural above", () => {
        expect(plural(0, "produit")).toBe("produit");
        expect(plural(1, "produit")).toBe("produit");
        expect(plural(2, "produit")).toBe("produits");
    });

    it("uses the given plural form", () => {
        expect(plural(3, "travail", "travaux")).toBe("travaux");
        expect(plural(1, "travail", "travaux")).toBe("travail");
    });
});

describe("productRef", () => {
    it("pads the id to four digits", () => {
        expect(productRef(7)).toBe("Réf. 0007");
        expect(productRef(123)).toBe("Réf. 0123");
        expect(productRef(12345)).toBe("Réf. 12345");
    });
});
