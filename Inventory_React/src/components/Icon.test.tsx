import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon, IconSprite } from "./Icon";

describe("Icon", () => {
    it("references its symbol in the sprite and stays decorative", () => {
        const { container } = render(<Icon name="alert" />);
        const svg = container.querySelector("svg")!;
        expect(svg).toHaveAttribute("aria-hidden", "true");
        expect(svg).toHaveAttribute("focusable", "false");
        expect(svg).toHaveAttribute("class", "od-icon");
        expect(svg.querySelector("use")).toHaveAttribute("href", "#i-alert");
    });

    it("adds an extra class name", () => {
        const { container } = render(<Icon name="check" className="big" />);
        expect(container.querySelector("svg")).toHaveAttribute("class", "od-icon big");
    });
});

describe("IconSprite", () => {
    it("mounts the hidden symbols that icons point to", () => {
        const { container } = render(
            <>
                <IconSprite />
                <Icon name="package" />
            </>,
        );
        const sprite = container.querySelector("svg")!;
        expect(sprite).toHaveAttribute("aria-hidden", "true");
        expect(sprite).toHaveStyle({ display: "none" });

        const href = container.querySelector("use")!.getAttribute("href")!;
        const symbol = document.getElementById(href.slice(1));
        expect(symbol?.tagName.toLowerCase()).toBe("symbol");
        expect(sprite).toContainElement(symbol);
    });
});
