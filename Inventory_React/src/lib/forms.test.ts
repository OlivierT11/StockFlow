import { describe, expect, it } from "vitest";
import { EMAIL_RE, fieldIds, fieldProps, isInteger } from "./forms";

describe("EMAIL_RE", () => {
    it("accepts a usual address", () => {
        expect(EMAIL_RE.test("claire.martin@inventory.fr")).toBe(true);
        expect(EMAIL_RE.test("a+b@sous.domaine.example")).toBe(true);
    });

    it("rejects an address without @, domain dot or with spaces", () => {
        for (const value of ["", "claire.martin", "claire@inventory", "@inventory.fr", "claire@.fr ", "claire martin@inventory.fr", "a@b@c.fr"]) {
            expect(EMAIL_RE.test(value), value).toBe(false);
        }
    });
});

describe("fieldIds", () => {
    it("derives the control, hint and error ids from the field name", () => {
        expect(fieldIds("price")).toEqual({ control: "f-price", hint: "f-price-hint", error: "f-price-err" });
    });
});

describe("fieldProps", () => {
    it("has no aria attributes for a valid field without a hint", () => {
        expect(fieldProps("name", undefined)).toEqual({ id: "f-name", name: "name", "aria-invalid": undefined, "aria-describedby": undefined });
    });

    it("points to the hint", () => {
        expect(fieldProps("name", undefined, true)).toMatchObject({ "aria-invalid": undefined, "aria-describedby": "f-name-hint" });
    });

    it("marks the field invalid and points to the error", () => {
        expect(fieldProps("name", "Le nom est obligatoire.")).toMatchObject({ "aria-invalid": true, "aria-describedby": "f-name-err" });
    });

    it("points to the hint, then the error", () => {
        expect(fieldProps("name", "Le nom est obligatoire.", true)).toMatchObject({ "aria-invalid": true, "aria-describedby": "f-name-hint f-name-err" });
    });

    it("treats an empty message as no error", () => {
        expect(fieldProps("name", "")).toMatchObject({ "aria-invalid": undefined, "aria-describedby": undefined });
    });
});

describe("isInteger", () => {
    it("accepts whole numbers, signed or surrounded by spaces", () => {
        for (const value of ["0", "12", "-4", " 7 "]) expect(isInteger(value), value).toBe(true);
    });

    it("rejects blanks, decimals and text", () => {
        for (const value of ["", "   ", "1.5", "1,5", "abc", "12a"]) expect(isInteger(value), value).toBe(false);
    });
});
