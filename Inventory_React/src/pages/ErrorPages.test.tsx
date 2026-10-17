import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render";

const main = () => screen.getByRole("main");

describe("NotFoundPage", () => {
    it("explains that the address does not exist", async () => {
        renderApp("/nulle-part");
        expect(await within(await screen.findByRole("main")).findByRole("heading", { level: 2, name: "Page introuvable" })).toBeInTheDocument();
        expect(within(main()).getByText("404")).toBeInTheDocument();
        expect(within(main()).getByText("L’adresse demandée n’existe pas ou l’élément a été supprimé.")).toBeInTheDocument();
        expect(await within(screen.getByRole("banner")).findByText("Page introuvable")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Page introuvable — Inventory"));
    });

    it("links to the dashboard and the product list", async () => {
        const { user } = renderApp("/nulle-part");
        await screen.findByRole("heading", { name: "Page introuvable" });
        expect(within(main()).getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("href", "/");
        const products = within(main()).getByRole("link", { name: "Liste des produits" });
        expect(products).toHaveAttribute("href", "/produits");

        await user.click(products);
        expect(await screen.findByRole("heading", { level: 1, name: "Produits" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/produits");
    });

    it("goes back to the dashboard", async () => {
        const { user } = renderApp("/produits/1/inconnu");
        await screen.findByRole("heading", { name: "Page introuvable" });
        await user.click(within(main()).getByRole("link", { name: "Tableau de bord" }));
        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/");
    });
});

describe("ForbiddenPage", () => {
    it("tells a User that the page is for administrators", async () => {
        renderApp("/produits/nouveau", { as: "User" });
        expect(await screen.findByRole("heading", { level: 2, name: "Accès refusé" })).toBeInTheDocument();
        expect(within(main()).getByText("403")).toBeInTheDocument();
        const text = within(main()).getByText(/Cette page est réservée aux administrateurs/);
        expect(text).toHaveTextContent(
            "Cette page est réservée aux administrateurs. Votre rôle actuel est User. Demandez à un administrateur de modifier votre rôle si nécessaire.",
        );
        expect(within(text).getByText("User").tagName).toBe("STRONG");
        expect(await within(screen.getByRole("banner")).findByText("Accès refusé")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Accès refusé — Inventory"));
    });

    it("links back to the dashboard", async () => {
        const { user } = renderApp("/produits/2/modifier", { as: "User" });
        await screen.findByRole("heading", { name: "Accès refusé" });
        const back = within(main()).getByRole("link", { name: "Retour au tableau de bord" });
        expect(back).toHaveAttribute("href", "/");

        await user.click(back);
        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/");
    });
});
