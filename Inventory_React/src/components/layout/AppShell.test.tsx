import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";
import { usePageTitle, useShell } from "./shellContext";
import { tokens } from "../../lib/api";
import { ADMIN, db } from "../../test/db";
import { api } from "../../test/handlers";
import { renderApp, renderWithProviders } from "../../test/render";
import { server } from "../../test/server";

const sidebar = () => screen.getByRole("complementary", { name: "Navigation principale" });
const topbar = () => screen.getByRole("banner");
const navLink = (name: string | RegExp) => within(sidebar()).getByRole("link", { name });
const userButton = () => within(topbar()).getByRole("button", { name: /admin@inventory\.fr|claire\.martin@inventory\.fr/ });
const menuButton = () => within(topbar()).getByRole("button", { name: /la navigation$/ });
const scrim = () => document.querySelector(".scrim");

/** Renders the app on a quiet page (two requests) and waits for the session and the page. */
async function renderShell(path = "/categories", options: Parameters<typeof renderApp>[1] = {}) {
    const result = renderApp(path, options);
    await screen.findByRole("banner");
    return result;
}

describe("AppShell navigation", () => {
    it("links to every section and marks the current one", async () => {
        await renderShell("/categories");
        expect(await screen.findByRole("heading", { level: 1, name: "Catégories" })).toBeInTheDocument();
        expect(navLink("Tableau de bord")).toHaveAttribute("href", "/");
        expect(navLink(/^Produits/)).toHaveAttribute("href", "/produits");
        expect(navLink("Mouvements")).toHaveAttribute("href", "/mouvements");
        expect(navLink("Catégories")).toHaveAttribute("href", "/categories");
        expect(navLink("Entrepôts")).toHaveAttribute("href", "/entrepots");

        expect(navLink("Catégories")).toHaveAttribute("aria-current", "page");
        // The dashboard link only matches "/" itself.
        expect(navLink("Tableau de bord")).not.toHaveAttribute("aria-current");
    });

    it("marks the products link on a product sub-page", async () => {
        await renderShell("/produits/1");
        expect(navLink(/^Produits/)).toHaveAttribute("aria-current", "page");
    });

    it("navigates between sections", async () => {
        const { user } = await renderShell("/categories");
        await user.click(navLink("Entrepôts"));
        expect(await screen.findByRole("heading", { level: 1, name: "Entrepôts" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/entrepots");
        expect(navLink("Entrepôts")).toHaveAttribute("aria-current", "page");
    });

    it("shows the number of low-stock products on the products link", async () => {
        await renderShell("/categories");
        const badge = await within(sidebar()).findByLabelText("6 produits à surveiller");
        expect(badge).toHaveTextContent(/^6$/);
        expect(navLink(/^Produits/)).toContainElement(badge);
    });

    it("has no badge when no product is low", async () => {
        db.products.forEach((p) => (p.stock = p.lowStockThreshold + 1));
        await renderShell("/produits");
        // The products lede shows the same counters once they are loaded.
        expect(await screen.findByText("12 produits référencés · 0 à surveiller")).toBeInTheDocument();
        expect(within(sidebar()).queryByLabelText(/produits à surveiller/)).not.toBeInTheDocument();
        expect(navLink("Produits")).toHaveTextContent(/^Produits$/);
    });

    it("has no badge, and still works, when the counters cannot be loaded", async () => {
        let served = 0;
        server.use(
            http.get(api("/dashboard"), () => {
                served += 1;
                return HttpResponse.json({ status: 500, title: "Erreur" }, { status: 500 });
            }),
        );
        const { user } = await renderShell("/categories");
        await waitFor(() => expect(served).toBe(1));
        await user.click(navLink("Entrepôts"));
        expect(await screen.findByRole("heading", { level: 1, name: "Entrepôts" })).toBeInTheDocument();
        expect(within(sidebar()).queryByLabelText(/produits à surveiller/)).not.toBeInTheDocument();
        expect(navLink("Produits")).toHaveTextContent(/^Produits$/);
    });

    it("updates the badge after a write", async () => {
        const { user } = await renderShell("/categories");
        await within(sidebar()).findByLabelText("6 produits à surveiller");
        // A write in a page calls invalidate(), which refetches the shell counters.
        db.products.find((p) => p.id === 3)!.stock = 50;
        await user.click(screen.getByRole("button", { name: "Nouvelle catégorie" }));
        const dialog = screen.getByRole("dialog", { name: "Nouvelle catégorie" });
        await user.type(within(dialog).getByRole("textbox", { name: /^Nom/ }), "Peinture");
        await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
        expect(await within(sidebar()).findByLabelText("5 produits à surveiller")).toBeInTheDocument();
    });
});

describe("AppShell user menu", () => {
    it("shows who is signed in", async () => {
        await renderShell();
        const button = userButton();
        expect(button).toHaveTextContent("admin@inventory.fr");
        expect(button).toHaveTextContent("Administrateur");
        expect(button.querySelector(".avatar")).toHaveTextContent(/^A$/);
        expect(button.querySelector(".avatar")).toHaveAttribute("aria-hidden", "true");
        expect(button).toHaveAttribute("aria-haspopup", "menu");
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("shows a User with their role", async () => {
        const { user } = await renderShell("/categories", { as: "User" });
        const button = userButton();
        expect(button).toHaveTextContent("claire.martin@inventory.fr");
        expect(button).toHaveTextContent("Utilisateur");
        expect(button.querySelector(".avatar")).toHaveTextContent(/^CM$/);
        await user.click(button);
        expect(within(screen.getByRole("menu")).getByText("User")).toBeInTheDocument();
    });

    it("opens on click, focuses its item and closes on a second click", async () => {
        const { user } = await renderShell();
        await user.click(userButton());
        const menu = screen.getByRole("menu");
        expect(userButton()).toHaveAttribute("aria-expanded", "true");
        expect(userButton()).toHaveAttribute("aria-controls", menu.id);
        expect(menu).toHaveTextContent(/^Connecté en tant que/);
        expect(within(menu).getByText("admin@inventory.fr")).toBeInTheDocument();
        expect(within(menu).getByText("Admin")).toBeInTheDocument();
        expect(within(menu).getByRole("menuitem", { name: "Déconnexion" })).toHaveFocus();

        await user.click(userButton());
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        expect(userButton()).toHaveAttribute("aria-expanded", "false");
    });

    it("closes on Escape and gives the focus back to its button", async () => {
        const { user } = await renderShell();
        await user.click(userButton());
        await user.keyboard("{ArrowDown}");
        expect(screen.getByRole("menu")).toBeInTheDocument();
        await user.keyboard("{Escape}");
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        expect(userButton()).toHaveFocus();
    });

    it("closes on a click outside, but not on a click inside", async () => {
        const { user } = await renderShell();
        await user.click(userButton());
        await user.click(within(screen.getByRole("menu")).getByText("Connecté en tant que", { exact: false }));
        expect(screen.getByRole("menu")).toBeInTheDocument();

        await user.click(await screen.findByRole("heading", { level: 1, name: "Catégories" }));
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("signs out, revokes the session and goes to the login page", async () => {
        const { user } = await renderShell();
        const refresh = tokens.refresh!;
        await user.click(userButton());
        await user.click(screen.getByRole("menuitem", { name: "Déconnexion" }));

        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/login");
        expect(tokens.access).toBeNull();
        expect(tokens.refresh).toBeNull();
        // The API revoked the refresh token.
        expect(db.takeRefresh(refresh)).toBeUndefined();
    });
});

describe("AppShell mobile drawer", () => {
    it("opens from the menu button with a scrim", async () => {
        const { user } = await renderShell();
        const button = menuButton();
        expect(button).toHaveAccessibleName("Ouvrir la navigation");
        expect(button).toHaveAttribute("aria-controls", "sidebar");
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(sidebar()).not.toHaveClass("is-open");
        expect(scrim()).toBeNull();

        await user.click(button);
        expect(menuButton()).toHaveAccessibleName("Fermer la navigation");
        expect(menuButton()).toHaveAttribute("aria-expanded", "true");
        expect(sidebar()).toHaveClass("is-open");
        expect(sidebar()).toHaveAttribute("id", "sidebar");
        expect(scrim()).not.toBeNull();
        // The scrim fades in on the next frame.
        await waitFor(() => expect(scrim()).toHaveClass("is-open"));
    });

    it("closes from the menu button", async () => {
        const { user } = await renderShell();
        await user.click(menuButton());
        await user.click(menuButton());
        expect(menuButton()).toHaveAttribute("aria-expanded", "false");
        expect(sidebar()).not.toHaveClass("is-open");
        expect(scrim()).toBeNull();
    });

    it("closes on a click on the scrim", async () => {
        const { user } = await renderShell();
        await user.click(menuButton());
        await user.click(scrim()!);
        expect(menuButton()).toHaveAttribute("aria-expanded", "false");
        expect(scrim()).toBeNull();
    });

    it("closes on Escape", async () => {
        const { user } = await renderShell();
        await user.click(menuButton());
        await user.keyboard("a");
        expect(sidebar()).toHaveClass("is-open");
        await user.keyboard("{Escape}");
        expect(sidebar()).not.toHaveClass("is-open");
        expect(scrim()).toBeNull();
    });

    it("closes when a link is followed", async () => {
        const { user } = await renderShell();
        await user.click(menuButton());
        await user.click(navLink("Mouvements"));
        expect(await screen.findByRole("heading", { level: 1, name: "Mouvements de stock" })).toBeInTheDocument();
        expect(sidebar()).not.toHaveClass("is-open");
        expect(scrim()).toBeNull();
    });
});

describe("AppShell session banner", () => {
    it("asks to sign in again once the session has expired, then comes back to the page", async () => {
        const { user } = await renderShell("/categories");
        expect(await screen.findByRole("heading", { level: 1, name: "Catégories" })).toBeInTheDocument();
        expect(screen.queryByText("Session expirée.")).not.toBeInTheDocument();

        db.expireAccessTokens();
        db.expireRefreshTokens();
        await user.click(navLink("Entrepôts"));

        const banner = (await screen.findByText("Session expirée.")).closest("[role='alert']")!;
        expect(banner).toHaveTextContent("Session expirée. Reconnectez-vous pour continuer : les actions d’écriture sont suspendues.");
        await user.click(within(banner as HTMLElement).getByRole("button", { name: "Se reconnecter" }));

        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/login");
        expect(tokens.access).toBeNull();

        await user.type(screen.getByRole("textbox", { name: /^Adresse e-mail/ }), ADMIN.email);
        await user.type(screen.getByLabelText(/^Mot de passe/), ADMIN.password);
        await user.click(screen.getByRole("button", { name: "Se connecter" }));
        expect(await screen.findByRole("heading", { level: 1, name: "Entrepôts" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/entrepots");
        expect(screen.queryByText("Session expirée.")).not.toBeInTheDocument();
        expect(await screen.findByText("Bienvenue")).toBeInTheDocument();
    });
});

describe("AppShell page title", () => {
    it("shows the page title in the top bar and the document title", async () => {
        const { user } = await renderShell("/");
        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(await within(topbar()).findByText("Tableau de bord")).toHaveClass("topbar-title");
        await waitFor(() => expect(document.title).toBe("Tableau de bord — Inventory"));

        await user.click(navLink("Mouvements"));
        expect(await screen.findByRole("heading", { level: 1, name: "Mouvements de stock" })).toBeInTheDocument();
        expect(await within(topbar()).findByText("Mouvements de stock")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Mouvements de stock — Inventory"));
    });
});

/** A page that shows what the shell gives it. */
function ShellProbe({ title }: { title: string }) {
    usePageTitle(title);
    const { lowStockCount, productCount } = useShell();
    return (
        <dl>
            <dt>Sous seuil</dt>
            <dd>{lowStockCount ?? "inconnu"}</dd>
            <dt>Produits</dt>
            <dd>{productCount ?? "inconnu"}</dd>
        </dl>
    );
}

describe("ShellContext", () => {
    function renderProbe() {
        return renderWithProviders(
            <Routes>
                <Route element={<AppShell />}>
                    <Route path="/" element={<ShellProbe title="Sonde" />} />
                </Route>
            </Routes>,
        );
    }

    it("gives the pages the product counters once loaded", async () => {
        renderProbe();
        expect(screen.getByText("Sous seuil").nextElementSibling).toHaveTextContent("inconnu");
        await waitFor(() => expect(screen.getByText("Sous seuil").nextElementSibling).toHaveTextContent(/^6$/));
        expect(screen.getByText("Produits", { selector: "dt" }).nextElementSibling).toHaveTextContent(/^12$/);
        expect(await within(topbar()).findByText("Sonde")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Sonde — Inventory"));
    });

    it("renders no user menu until the session is known", async () => {
        renderProbe();
        expect(within(topbar()).queryByRole("button", { name: /admin@inventory\.fr/ })).not.toBeInTheDocument();
        expect(await within(topbar()).findByRole("button", { name: /admin@inventory\.fr/ })).toBeInTheDocument();
    });

    it("refuses to be used outside AppShell", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => render(<ShellProbe title="Orpheline" />)).toThrow("useShell doit être utilisé dans AppShell");
        expect(document.title).toBe("");
    });
});
