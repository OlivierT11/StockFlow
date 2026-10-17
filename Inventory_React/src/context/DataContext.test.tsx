import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataProvider } from "./DataContext";
import { useData } from "./data";

describe("DataProvider", () => {
    it("starts at version 0 and bumps it on every invalidate", () => {
        const { result } = renderHook(() => useData(), { wrapper: DataProvider });
        expect(result.current.version).toBe(0);

        act(() => result.current.invalidate());
        expect(result.current.version).toBe(1);

        act(() => {
            result.current.invalidate();
            result.current.invalidate();
        });
        expect(result.current.version).toBe(3);
    });

    it("keeps the same invalidate function across versions", () => {
        const { result } = renderHook(() => useData(), { wrapper: DataProvider });
        const { invalidate } = result.current;

        act(() => invalidate());

        expect(result.current.invalidate).toBe(invalidate);
    });
});

describe("useData", () => {
    it("throws outside a DataProvider", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => renderHook(() => useData())).toThrow("useData doit être utilisé dans un DataProvider");
    });
});
