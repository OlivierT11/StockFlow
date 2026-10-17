import { describe, expect, it } from "vitest";
import { gap } from "./style";

describe("gap", () => {
    it("sets the --od-gap custom property in pixels", () => {
        expect(gap(8)).toEqual({ "--od-gap": "8px" });
    });

    it("merges other styles and custom properties", () => {
        expect(gap(16, { "--od-cols": 2, marginBottom: 16 })).toEqual({ "--od-gap": "16px", "--od-cols": 2, marginBottom: 16 });
    });
});
