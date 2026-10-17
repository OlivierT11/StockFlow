import { render, screen, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry, type Location } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PublicOnly, RequireAuth } from "./RouteGuards";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { tokens } from "../lib/api";
import { ADMIN } from "../test/db";
import { api } from "../test/handlers";
import { renderApp, signIn, type As } from "../test/render";
import { server } from "../test/server";

/** Shows where the router is and the location it was redirected from. */
function Where({ name }: { name: string }) {
    const location = useLocation();
    const from = (location.state as { from?: Location } | null)?.from;
    return (
        <>
            <h1>{name}</h1>
            <output aria-label="Adresse">{`${location.pathname}${location.search}`}</output>
            <output aria-label="Origine">{from ? `${from.pathname}${from.search}` : "aucune"}</output>
        </>
    );
}

/** The guards of App.tsx around probe pages, on an entry that can carry a location state. */
function renderGuards(entry: InitialEntry, { as = "Admin" }: { as?: As } = {}) {
    if (as) signIn(as);
    return render(
        <MemoryRouter initialEntries={[entry]}>
            <ToastProvider>
                <AuthProvider>
                    <Routes>
                        <Route element={<PublicOnly />}>
                            <Route path="/login" element={<Where name="Connexion" />} />
                        </Route>
                        <Route element={<RequireAuth />}>
                            <Route path="/" element={<Where name="Accueil" />} />
                            <Route path="/produits" element={<Where name="Produits" />} />
                        </Route>
                    </Routes>
                </AuthProvider>
            </ToastProvider>
        </MemoryRouter>,
    );
}

const address = () => screen.getByRole("status", { name: "Adresse" }).textContent;
const origin = () => screen.getByRole("status", { name: "Origine" }).textContent;

describe("RequireAuth", () => {
    it("shows the boot screen while the stored session is checked", async () => {
        server.use(
            http.get(api("/profile"), async () => {
                await delay(50);
                return HttpResponse.json({ userId: String(ADMIN.id), email: ADMIN.email, role: "Admin" });
            }),
        );
        const { container } = renderGuards("/produits");
        expect(screen.getByText("Vérification de la session…")).toBeInTheDocument();
        expect(container.querySelector(".boot")).toHaveAttribute("aria-busy", "true");
        expect(screen.queryByRole("heading")).not.toBeInTheDocument();

        expect(await screen.findByRole("heading", { name: "Produits" })).toBeInTheDocument();
        expect(screen.queryByText("Vérification de la session…")).not.toBeInTheDocument();
    });

    it("sends a visitor to /login and remembers the requested page", async () => {
        renderGuards("/produits?cat=2&page=3", { as: null });
        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(address()).toBe("/login");
        expect(origin()).toBe("/produits?cat=2&page=3");
    });

    it("sends a user whose stored session is no longer valid to /login", async () => {
        tokens.set("access-revoked", "refresh-revoked");
        renderGuards("/produits", { as: null });
        expect(screen.getByText("Vérification de la session…")).toBeInTheDocument();
        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(origin()).toBe("/produits");
        expect(tokens.access).toBeNull();
        expect(tokens.refresh).toBeNull();
    });

    it("shows the page to a signed-in user", async () => {
        renderGuards("/produits", { as: "User" });
        expect(await screen.findByRole("heading", { name: "Produits" })).toBeInTheDocument();
        expect(address()).toBe("/produits");
    });
});

describe("PublicOnly", () => {
    it("shows the login page to a visitor", () => {
        renderGuards("/login", { as: null });
        expect(screen.getByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(origin()).toBe("aucune");
    });

    it("shows the boot screen, then sends a signed-in user to the dashboard", async () => {
        renderGuards("/login");
        expect(screen.getByText("Vérification de la session…")).toBeInTheDocument();
        expect(await screen.findByRole("heading", { name: "Accueil" })).toBeInTheDocument();
        expect(address()).toBe("/");
    });

    it("sends a signed-in user back to the page they came from", async () => {
        renderGuards({ pathname: "/login", state: { from: { pathname: "/produits", search: "?cat=1" } } });
        expect(await screen.findByRole("heading", { name: "Produits" })).toBeInTheDocument();
        expect(address()).toBe("/produits?cat=1");
    });

    it("returns to the requested page after signing in", async () => {
        const { user } = renderApp("/produits?cat=2", { as: null });
        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        await user.type(screen.getByRole("textbox", { name: /^Adresse e-mail/ }), ADMIN.email);
        await user.type(screen.getByLabelText(/^Mot de passe/), ADMIN.password);
        await user.click(screen.getByRole("button", { name: "Se connecter" }));

        expect(await screen.findByRole("heading", { level: 1, name: "Produits" })).toBeInTheDocument();
        expect(`${window.location.pathname}${window.location.search}`).toBe("/produits?cat=2");
        // Let the welcome toast of the login page appear before the test ends.
        expect(await screen.findByText("Bienvenue")).toBeInTheDocument();
    });
});

describe("RequireAdmin", () => {
    it("shows an admin page to an Admin", async () => {
        renderApp("/produits/nouveau");
        expect(await screen.findByRole("heading", { level: 1, name: "Nouveau produit" })).toBeInTheDocument();
        expect(screen.queryByText("403")).not.toBeInTheDocument();
    });

    it("shows the 403 page inside the shell to a User", async () => {
        renderApp("/produits/nouveau", { as: "User" });
        const main = await screen.findByRole("main");
        expect(await within(main).findByRole("heading", { name: "Accès refusé" })).toBeInTheDocument();
        expect(within(main).getByText("403")).toBeInTheDocument();
        expect(screen.getByRole("complementary", { name: "Navigation principale" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/produits/nouveau");
        expect(screen.queryByRole("heading", { name: "Nouveau produit" })).not.toBeInTheDocument();
    });

    it("guards the edit page as well", async () => {
        renderApp("/produits/1/modifier", { as: "User" });
        expect(await screen.findByRole("heading", { name: "Accès refusé" })).toBeInTheDocument();
    });
});
