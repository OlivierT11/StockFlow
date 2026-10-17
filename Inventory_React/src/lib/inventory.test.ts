import { describe, expect, it } from "vitest";
import { MOVEMENT_TYPES, movementUser, qtyMiniClass, qtyTextClass, signedQty, stockState, typeLabel } from "./inventory";

describe("stockState", () => {
    it("is « out » at zero, whatever the threshold", () => {
        expect(stockState({ stock: 0, lowStockThreshold: 10 })).toBe("out");
        expect(stockState({ stock: 0, lowStockThreshold: 0 })).toBe("out");
    });

    it("is « low » at or below the threshold, like the API", () => {
        expect(stockState({ stock: 6, lowStockThreshold: 15 })).toBe("low");
        expect(stockState({ stock: 12, lowStockThreshold: 12 })).toBe("low");
    });

    it("is « ok » above the threshold", () => {
        expect(stockState({ stock: 13, lowStockThreshold: 12 })).toBe("ok");
        expect(stockState({ stock: 1, lowStockThreshold: 0 })).toBe("ok");
    });
});

describe("movement types", () => {
    it("lists the three types with their French labels", () => {
        expect(MOVEMENT_TYPES.map((t) => typeLabel[t])).toEqual(["Entrée", "Sortie", "Ajustement"]);
    });

    it("gives each type its colour classes", () => {
        expect(MOVEMENT_TYPES.map((type) => qtyTextClass({ type }))).toEqual(["text-success", "text-warning", ""]);
        expect(MOVEMENT_TYPES.map((type) => qtyMiniClass({ type }))).toEqual(["in", "out", "adj"]);
    });
});

describe("signedQty", () => {
    it("signs a quantity with + or a real minus sign, and groups thousands", () => {
        expect(signedQty(20)).toBe("+20");
        expect(signedQty(0)).toBe("+0");
        expect(signedQty(-3)).toBe("−3");
        expect(signedQty(-1500).replace(" ", " ")).toBe("−1 500");
    });
});

describe("movementUser", () => {
    it("names the current user « Vous » and numbers the others", () => {
        expect(movementUser(1, 1)).toBe("Vous");
        expect(movementUser(2, 1)).toBe("Utilisateur n° 2");
        expect(movementUser(2, undefined)).toBe("Utilisateur n° 2");
    });
});
