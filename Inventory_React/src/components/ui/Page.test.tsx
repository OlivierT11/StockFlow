import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Crumb, PageHead } from "./Page";

describe("PageHead", () => {
    it("renders only the title when nothing else is given", () => {
        const { container } = render(<PageHead title="Produits" />);
        expect(screen.getByRole("heading", { level: 1, name: "Produits" })).toBeInTheDocument();
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
        expect(container.querySelector(".lede")).toBeNull();
        expect(container.querySelector(".page-actions")).toBeNull();
    });

    it("renders the breadcrumb, lede and actions", () => {
        render(
            <MemoryRouter>
                <PageHead
                    title="Détail du produit"
                    lede="Réf. 0001"
                    actions={<button type="button">Modifier</button>}
                    crumbs={
                        <>
                            <Crumb to="/produits">Produits</Crumb>
                            <span>Vis inox</span>
                        </>
                    }
                />
            </MemoryRouter>,
        );
        const crumbs = screen.getByRole("navigation", { name: "Fil d’Ariane" });
        expect(within(crumbs).getByRole("link", { name: "Produits" })).toHaveAttribute("href", "/produits");
        expect(within(crumbs).getByText("Vis inox")).toBeInTheDocument();
        expect(screen.getByText("Réf. 0001")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument();
    });
});

describe("Crumb", () => {
    it("is a link followed by a decorative chevron", () => {
        const { container } = render(
            <MemoryRouter>
                <Crumb to="/categories">Catégories</Crumb>
            </MemoryRouter>,
        );
        const link = screen.getByRole("link", { name: "Catégories" });
        expect(link).toHaveAttribute("href", "/categories");
        expect(link.nextElementSibling?.querySelector("use")).toHaveAttribute("href", "#i-chevron-right");
        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });
});
