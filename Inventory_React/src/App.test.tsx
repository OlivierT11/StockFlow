import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { tokens } from "./lib/api";
import { ADMIN, db } from "./test/db";
import { api } from "./test/handlers";
import { renderApp, signIn } from "./test/render";
import { server } from "./test/server";

const currentUrl = () => window.location.pathname + window.location.search;

describe("App routing", () => {
    it("sends a visitor to the login page", async () => {
        renderApp("/produits", { as: null });
        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/login");
    });

    it("shows the dashboard to a signed-in user", async () => {
        renderApp("/");
        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Tableau de bord — Inventory"));
    });

    it("redirects the paths of the previous version", async () => {
        renderApp("/Product_List");
        expect(await screen.findByRole("heading", { level: 1, name: "Produits" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/produits");
    });

    it.each([
        ["/", "Tableau de bord", "Tableau de bord"],
        ["/produits", "Produits", "Produits"],
        ["/produits/1", "Vis inox A2 M6 × 40", "Détail du produit"],
        ["/produits/nouveau", "Nouveau produit", "Nouveau produit"],
        ["/produits/1/modifier", "Modifier le produit", "Modifier le produit"],
        ["/mouvements", "Mouvements de stock", "Mouvements de stock"],
        ["/categories", "Catégories", "Catégories"],
        ["/entrepots", "Entrepôts", "Entrepôts"],
    ])("renders %s inside the shell for an Admin", async (path, heading, title) => {
        renderApp(path);

        expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe(`${title} — Inventory`));
        expect(window.location.pathname).toBe(path);
        expect(screen.getByRole("complementary", { name: "Navigation principale" })).toBeInTheDocument();
    });

    it.each([
        ["/login", "Connexion"],
        ["/inscription", "Créer un compte"],
    ])("renders %s for a visitor", async (path, heading) => {
        renderApp(path, { as: null });

        expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe(`${heading} — Inventory`));
        expect(window.location.pathname).toBe(path);
        expect(screen.queryByRole("complementary", { name: "Navigation principale" })).not.toBeInTheDocument();
    });

    it.each(["/produits/nouveau", "/produits/1/modifier", "/Product_Add"])("shows the 403 page to a User on %s", async (path) => {
        renderApp(path, { as: "User" });

        expect(await screen.findByRole("heading", { name: "Accès refusé" })).toBeInTheDocument();
        expect(screen.getByText("403")).toBeInTheDocument();
        expect(screen.getByText(/Votre rôle actuel est/)).toHaveTextContent("Votre rôle actuel est User.");
        expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute("href", "/");
        expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: /^Nom/ })).not.toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Accès refusé — Inventory"));
    });

    it("lets a User open the product pages that are not admin-only", async () => {
        renderApp("/produits/1", { as: "User" });

        expect(await screen.findByRole("heading", { level: 1, name: "Vis inox A2 M6 × 40" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Accès refusé" })).not.toBeInTheDocument();
    });

    it.each(["/inconnu", "/produits/1/historique", "/categories/1"])("shows the 404 page on %s", async (path) => {
        renderApp(path);

        expect(await screen.findByRole("heading", { name: "Page introuvable" })).toBeInTheDocument();
        expect(screen.getByText("404")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Page introuvable — Inventory"));
        expect(window.location.pathname).toBe(path);
        const main = screen.getByRole("main");
        expect(within(main).getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("href", "/");
        expect(within(main).getByRole("link", { name: "Liste des produits" })).toHaveAttribute("href", "/produits");
    });

    it("sends a visitor on an unknown path to the login page", async () => {
        renderApp("/inconnu", { as: null });

        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/login");
    });

    it.each(["/login", "/inscription"])("redirects a signed-in user from %s to the dashboard", async (path) => {
        renderApp(path);

        // The stored session is checked first.
        expect(screen.getByText("Vérification de la session…")).toBeInTheDocument();
        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/");
        expect(screen.queryByRole("heading", { name: "Connexion" })).not.toBeInTheDocument();
    });

    it("brings the user back to the requested page, query string included, after logging in", async () => {
        const { user } = renderApp("/produits?low=1", { as: null });

        await screen.findByRole("heading", { name: "Connexion" });
        expect(window.location.pathname).toBe("/login");
        await user.type(screen.getByRole("textbox", { name: /^Adresse e-mail/ }), ADMIN.email);
        await user.type(screen.getByLabelText(/^Mot de passe/), ADMIN.password);
        await user.click(screen.getByRole("button", { name: "Se connecter" }));

        expect(await screen.findByRole("heading", { level: 1, name: "Produits" })).toBeInTheDocument();
        expect(currentUrl()).toBe("/produits?low=1");
        expect(screen.getByRole("checkbox", { name: "Stock bas uniquement" })).toBeChecked();
        expect(screen.getByRole("button", { name: "Retirer le filtre Stock bas uniquement" })).toBeInTheDocument();
        // The welcome toast is shown once the page has changed.
        expect(await screen.findByRole("status")).toHaveTextContent(`Connecté en tant que ${ADMIN.email}.`);
    });

    it("sends a user to the dashboard after logging in from /login itself", async () => {
        const { user } = renderApp("/login", { as: null });

        await user.type(await screen.findByRole("textbox", { name: /^Adresse e-mail/ }), ADMIN.email);
        await user.type(screen.getByLabelText(/^Mot de passe/), ADMIN.password);
        await user.click(screen.getByRole("button", { name: "Se connecter" }));

        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(currentUrl()).toBe("/");
        expect(await screen.findByRole("status")).toHaveTextContent("Bienvenue");
    });

    it("redirects the legacy /Product_Add path to the product form", async () => {
        renderApp("/Product_Add");

        expect(await screen.findByRole("heading", { level: 1, name: "Nouveau produit" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/produits/nouveau");
    });

    it("sends a user with an invalid stored token to the login page and clears the tokens", async () => {
        tokens.set("access-forged", "refresh-forged");
        renderApp("/produits", { as: null });

        expect(screen.getByText("Vérification de la session…")).toBeInTheDocument();
        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/login");
        expect(tokens.access).toBeNull();
        expect(tokens.refresh).toBeNull();
    });

    it("refreshes an expired access token without the user noticing", async () => {
        let refreshes = 0;
        server.use(
            http.post(api("/auth/refresh"), () => {
                refreshes += 1;
            }),
        );
        signIn("Admin");
        const stale = { access: tokens.access, refresh: tokens.refresh };
        db.expireAccessTokens();
        renderApp("/categories", { as: null });

        expect(await screen.findByRole("heading", { level: 1, name: "Catégories" })).toBeInTheDocument();
        expect(await screen.findByRole("link", { name: "Visserie" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/categories");
        expect(screen.queryByText("Session expirée.")).not.toBeInTheDocument();
        expect(refreshes).toBe(1);
        expect(tokens.access).not.toBe(stale.access);
        expect(tokens.refresh).not.toBe(stale.refresh);
        expect(db.userForAccess(tokens.access ?? undefined)?.email).toBe(ADMIN.email);
        await waitFor(() => expect(screen.queryAllByText("…")).toHaveLength(0));
    });
});
