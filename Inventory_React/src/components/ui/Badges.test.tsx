import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleBadge, StockBadge, TypeBadge } from "./Badges";

describe("StockBadge", () => {
    it.each([
        { stock: 0, lowStockThreshold: 10, label: "Rupture" },
        { stock: 0, lowStockThreshold: 0, label: "Rupture" },
        { stock: 6, lowStockThreshold: 15, label: "Sous seuil" },
        { stock: 12, lowStockThreshold: 12, label: "Sous seuil" },
        { stock: 13, lowStockThreshold: 12, label: "Normal" },
    ])("shows $label for a stock of $stock with a threshold of $lowStockThreshold", ({ stock, lowStockThreshold, label }) => {
        render(<StockBadge product={{ stock, lowStockThreshold }} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it("keeps its icon out of the accessibility tree", () => {
        const { container } = render(<StockBadge product={{ stock: 0, lowStockThreshold: 3 }} />);
        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
        expect(container.firstElementChild).toHaveTextContent(/^Rupture$/);
    });
});

describe("TypeBadge", () => {
    it.each([
        { type: "In", label: "Entrée" },
        { type: "Out", label: "Sortie" },
        { type: "Adjustment", label: "Ajustement" },
    ] as const)("labels a $type movement as $label", ({ type, label }) => {
        render(<TypeBadge type={type} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });
});

describe("RoleBadge", () => {
    it("shows Admin with a shield icon", () => {
        const { container } = render(<RoleBadge role="Admin" />);
        expect(screen.getByText("Admin")).toBeInTheDocument();
        expect(container.querySelector("use")).toHaveAttribute("href", "#i-shield");
    });

    it("shows User without an icon", () => {
        const { container } = render(<RoleBadge role="User" />);
        expect(screen.getByText("User")).toBeInTheDocument();
        expect(container.querySelector("svg")).toBeNull();
    });
});
