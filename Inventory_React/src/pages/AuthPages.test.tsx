import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN, db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp } from "../test/render";
import { server } from "../test/server";

const emailInput = () => screen.getByRole("textbox", { name: /^Adresse e-mail/ });
const passwordInput = () => screen.getByLabelText(/^Mot de passe/);
const usernameInput = () => screen.getByRole("textbox", { name: /^Nom d’utilisateur/ });
const confirmInput = () => screen.getByLabelText(/^Confirmation du mot de passe/);

/** Records the bodies posted to an endpoint, then lets the default handler answer (a resolver that returns nothing falls through). */
function capturePosts(path: string) {
    const bodies: unknown[] = [];
    server.use(
        http.post(api(path), async ({ request }) => {
            bodies.push(await request.clone().json());
        }),
    );
    return bodies;
}

/** A pending response that the test releases, to observe the loading state. */
function gate() {
    let open!: () => void;
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { opened, open };
}

describe("LoginPage", () => {
    afterEach(() => vi.useRealTimers());

    async function renderLogin(path = "/login") {
        const view = renderApp(path, { as: null });
        await screen.findByRole("heading", { name: "Connexion" });
        return view;
    }

    async function submit(user: Awaited<ReturnType<typeof renderLogin>>["user"], email: string, password: string) {
        await user.type(emailInput(), email);
        await user.type(passwordInput(), password);
        await user.click(screen.getByRole("button", { name: "Se connecter" }));
    }

    it("shows the sign-in form next to the product pitch", async () => {
        await renderLogin();
        expect(screen.getByRole("heading", { level: 1, name: "Le stock de l’atelier, à jour et sous contrôle." })).toBeInTheDocument();
        expect(screen.getByText("Journal des mouvements horodaté")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Connexion — Inventory"));
        expect(emailInput()).toHaveFocus();
        expect(passwordInput()).toHaveAttribute("type", "password");
    });

    it("requires the email and the password before calling the API", async () => {
        const calls = capturePosts("/auth/login");
        const { user } = await renderLogin();

        await user.click(screen.getByRole("button", { name: "Se connecter" }));

        expect(emailInput()).toHaveAccessibleDescription("Saisissez votre adresse e-mail.");
        expect(emailInput()).toHaveAttribute("aria-invalid", "true");
        expect(passwordInput()).toHaveAccessibleDescription("Saisissez votre mot de passe.");
        expect(calls).toHaveLength(0);

        // An error already shown is re-checked while the field is corrected.
        await user.type(emailInput(), ADMIN.email);
        expect(emailInput()).not.toHaveAccessibleDescription();
        expect(emailInput()).not.toHaveAttribute("aria-invalid");
        expect(passwordInput()).toHaveAccessibleDescription("Saisissez votre mot de passe.");
    });

    it("rejects a malformed email when the field loses focus", async () => {
        const { user } = await renderLogin();

        await user.type(emailInput(), "admin@inventory");
        expect(emailInput()).not.toHaveAccessibleDescription();
        await user.tab();

        expect(emailInput()).toHaveAccessibleDescription("Le format de l’adresse n’est pas valide (ex. prenom.nom@inventory.fr).");
    });

    it("says the credentials are wrong on a 401", async () => {
        const { user } = await renderLogin();

        await submit(user, ADMIN.email, "wrong-password");

        expect(await screen.findByRole("alert")).toHaveTextContent("Email ou mot de passe incorrect.");
        expect(window.location.pathname).toBe("/login");
        expect(localStorage.getItem("access_token")).toBeNull();
        expect(screen.getByRole("button", { name: "Se connecter" })).not.toHaveAttribute("aria-busy");
    });

    it("locks the form for the Retry-After delay of a 429", async () => {
        vi.useFakeTimers({ toFake: ["Date"] }); // the clock only moves when the test says so
        let calls = 0;
        server.use(
            http.post(api("/auth/login"), () => {
                calls++;
                if (calls === 1) return HttpResponse.json({ message: "Too many requests." }, { status: 429, headers: { "Retry-After": "30" } });
            }),
        );
        const { user } = await renderLogin();
        const button = screen.getByRole("button", { name: "Se connecter" });

        await submit(user, ADMIN.email, ADMIN.password);
        expect(await screen.findByRole("alert")).toHaveTextContent("Trop de tentatives (429). Réessayez dans 30 s.");

        // While locked, a new attempt does not reach the API and shows the time left.
        vi.setSystemTime(Date.now() + 20_000);
        await user.click(button);
        expect(screen.getByRole("alert")).toHaveTextContent("Trop de tentatives (429). Réessayez dans 10 s.");
        expect(calls).toBe(1);

        // Once the delay is over, the next attempt goes through.
        vi.setSystemTime(Date.now() + 10_000);
        await user.click(button);
        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(calls).toBe(2);
        expect(await screen.findByRole("status")).toHaveTextContent("Bienvenue");
    });

    it("locks the form for 60 s when a 429 has no Retry-After", async () => {
        server.use(http.post(api("/auth/login"), () => new HttpResponse(null, { status: 429 })));
        const { user } = await renderLogin();

        await submit(user, ADMIN.email, ADMIN.password);

        expect(await screen.findByRole("alert")).toHaveTextContent("Trop de tentatives (429). Réessayez dans 60 s.");
    });

    it("shows the field errors of a 400 under their fields", async () => {
        server.use(
            http.post(api("/auth/login"), () =>
                HttpResponse.json(
                    { title: "One or more validation errors occurred.", status: 400, errors: { Email: ["The Email field is not a valid e-mail address."] } },
                    { status: 400 },
                ),
            ),
        );
        const { user } = await renderLogin();

        await submit(user, ADMIN.email, ADMIN.password);

        await waitFor(() => expect(emailInput()).toHaveAccessibleDescription("The Email field is not a valid e-mail address."));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        // A server error stays until its field is edited.
        await user.type(emailInput(), "x");
        expect(emailInput()).not.toHaveAccessibleDescription();
    });

    it.each([
        ["a network error", () => HttpResponse.error(), "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez."],
        ["a server error", () => new HttpResponse(null, { status: 500 }), "Une erreur interne est survenue côté serveur."],
    ])("explains %s", async (_, response, message) => {
        server.use(http.post(api("/auth/login"), response));
        const { user } = await renderLogin();

        await submit(user, ADMIN.email, ADMIN.password);

        expect(await screen.findByRole("alert")).toHaveTextContent(message);
    });

    it("marks the button busy while signing in", async () => {
        const pending = gate();
        server.use(
            http.post(api("/auth/login"), async () => {
                await pending.opened;
            }),
        );
        const { user } = await renderLogin();

        await submit(user, ADMIN.email, ADMIN.password);
        expect(screen.getByRole("button", { name: "Se connecter" })).toHaveAttribute("aria-busy", "true");

        pending.open();
        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(await screen.findByRole("status")).toHaveTextContent("Bienvenue");
    });

    it("signs in, returns to the requested page and welcomes the user", async () => {
        const { user } = renderApp("/mouvements?entrepot=2", { as: null });
        await screen.findByRole("heading", { name: "Connexion" });
        expect(window.location.pathname).toBe("/login");

        await submit(user, ADMIN.email, ADMIN.password);

        expect(await screen.findByRole("heading", { level: 1, name: "Mouvements de stock" })).toBeInTheDocument();
        expect(window.location.pathname + window.location.search).toBe("/mouvements?entrepot=2");
        expect(localStorage.getItem("access_token")).toMatch(/^access-1-/);
        const toast = await screen.findByRole("status");
        expect(toast).toHaveTextContent("Bienvenue");
        expect(toast).toHaveTextContent(`Connecté en tant que ${ADMIN.email}.`);
    });

    it("goes to the dashboard when no page was requested", async () => {
        const { user } = await renderLogin();

        await submit(user, ADMIN.email, ADMIN.password);

        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/");
        expect(await screen.findByRole("status")).toHaveTextContent("Bienvenue");
    });

    it("links to the registration page", async () => {
        const { user } = await renderLogin();

        await user.click(screen.getByRole("link", { name: "Créer un compte" }));

        expect(await screen.findByRole("heading", { name: "Créer un compte" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/inscription");
    });
});

describe("RegisterPage", () => {
    async function renderRegister() {
        const view = renderApp("/inscription", { as: null });
        await screen.findByRole("heading", { name: "Créer un compte" });
        return view;
    }

    type User = Awaited<ReturnType<typeof renderRegister>>["user"];

    async function fill(user: User, values: { username?: string; email?: string; password?: string; confirm?: string }) {
        if (values.username) await user.type(usernameInput(), values.username);
        if (values.email) await user.type(emailInput(), values.email);
        if (values.password) await user.type(passwordInput(), values.password);
        if (values.confirm) await user.type(confirmInput(), values.confirm);
    }

    const submit = (user: User) => user.click(screen.getByRole("button", { name: "Créer le compte" }));

    it("shows the registration form", async () => {
        await renderRegister();
        expect(screen.getByRole("heading", { level: 1, name: "Le stock de l’atelier, à jour et sous contrôle." })).toBeInTheDocument();
        expect(screen.getByText("Un nouveau compte reçoit le rôle User. Un administrateur pourra l’élever ensuite.")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Créer un compte — Inventory"));
        expect(usernameInput()).toHaveFocus();
        expect(passwordInput()).toHaveAccessibleDescription("8 caractères minimum.");
    });

    it("checks each field when it loses focus", async () => {
        const { user } = await renderRegister();

        await user.type(usernameInput(), "ab");
        await user.tab();
        expect(usernameInput()).toHaveAccessibleDescription("Le nom d’utilisateur doit contenir au moins 3 caractères.");

        await user.type(emailInput(), "jean.dupont");
        await user.tab();
        expect(emailInput()).toHaveAccessibleDescription("Le format de l’adresse n’est pas valide.");

        await user.type(passwordInput(), "court");
        await user.tab(); // to the show / hide toggle
        expect(passwordInput()).toHaveAccessibleDescription("8 caractères minimum. Le mot de passe doit contenir au moins 8 caractères.");

        await user.type(confirmInput(), "autre");
        await user.tab();
        expect(confirmInput()).toHaveAccessibleDescription("Les deux mots de passe ne correspondent pas.");

        // Corrected values clear the errors as the user types.
        await user.type(usernameInput(), "c");
        expect(usernameInput()).not.toHaveAccessibleDescription();
        await user.type(passwordInput(), "-assez-long");
        expect(passwordInput()).toHaveAccessibleDescription("8 caractères minimum.");
        await user.clear(confirmInput());
        await user.type(confirmInput(), "court-assez-long");
        expect(confirmInput()).not.toHaveAccessibleDescription();
    });

    it("lists the errors above the form on submit and focuses a field from the list", async () => {
        const calls = capturePosts("/auth/register");
        const { user } = await renderRegister();

        await submit(user);

        const summary = screen.getByRole("alert");
        expect(summary).toHaveTextContent("3 champs à corriger :");
        const links = within(summary).getAllByRole("link");
        expect(links.map((l) => l.textContent)).toEqual([
            "Le nom d’utilisateur doit contenir au moins 3 caractères.",
            "Le format de l’adresse n’est pas valide.",
            "Le mot de passe doit contenir au moins 8 caractères.",
        ]);
        expect(calls).toHaveLength(0);

        await user.click(links[1]);
        expect(emailInput()).toHaveFocus();
    });

    it.each([
        ["", 0],
        ["abcdefgh", 1],
        ["Abcdefgh", 2],
        ["Abcdefg1", 3],
        ["Abcdefg1!", 4],
    ])("rates the password %j at %i out of 4", async (password, level) => {
        const { user, container } = await renderRegister();

        if (password) await user.type(passwordInput(), password);

        expect(container.querySelectorAll(".pw-strength i")).toHaveLength(4);
        expect(container.querySelectorAll(".pw-strength i.on")).toHaveLength(level);
    });

    it("maps an existing email to the email field", async () => {
        const { user } = await renderRegister();

        await fill(user, { username: "admin2", email: ADMIN.email, password: "Secret123!", confirm: "Secret123!" });
        await submit(user);

        const message = "Cette adresse est déjà utilisée. Connectez-vous ou utilisez une autre adresse.";
        await waitFor(() => expect(emailInput()).toHaveAccessibleDescription(message));
        expect(screen.getByRole("alert")).toHaveTextContent(`1 champ à corriger :${message}`);
        expect(db.users).toHaveLength(2);

        await user.type(emailInput(), "m");
        expect(emailInput()).not.toHaveAccessibleDescription();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("maps the validation errors of a 400 to their fields", async () => {
        server.use(
            http.post(api("/auth/register"), () =>
                HttpResponse.json(
                    { title: "One or more validation errors occurred.", status: 400, errors: { Username: ["The Username field is required."] } },
                    { status: 400 },
                ),
            ),
        );
        const { user } = await renderRegister();

        await fill(user, { username: "jdupont", email: "jean.dupont@inventory.fr", password: "Secret123!", confirm: "Secret123!" });
        await submit(user);

        await waitFor(() => expect(usernameInput()).toHaveAccessibleDescription("The Username field is required."));
        expect(emailInput()).not.toHaveAccessibleDescription();
    });

    it.each([
        ["a 429 with Retry-After", () => new HttpResponse(null, { status: 429, headers: { "Retry-After": "12" } }), "Trop de tentatives (429). Réessayez dans 12 s."],
        ["a 429 without Retry-After", () => new HttpResponse(null, { status: 429 }), "Trop de tentatives (429). Réessayez dans 60 s."],
        ["a server error", () => new HttpResponse(null, { status: 500 }), "Une erreur interne est survenue côté serveur."],
        ["a network error", () => HttpResponse.error(), "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez."],
    ])("explains %s", async (_, response, message) => {
        server.use(http.post(api("/auth/register"), response));
        const { user } = await renderRegister();

        await fill(user, { username: "jdupont", email: "jean.dupont@inventory.fr", password: "Secret123!", confirm: "Secret123!" });
        await submit(user);

        expect(await screen.findByRole("alert")).toHaveTextContent(message);
        expect(screen.getByRole("button", { name: "Créer le compte" })).not.toHaveAttribute("aria-busy");
    });

    it("creates the account, signs the user in and confirms it", async () => {
        const { user } = await renderRegister();

        await fill(user, { username: "  jdupont  ", email: "Jean.Dupont@Inventory.fr", password: "Secret123!", confirm: "Secret123!" });
        await submit(user);

        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/");
        expect(db.users.at(-1)).toMatchObject({ username: "jdupont", email: "jean.dupont@inventory.fr", password: "Secret123!", role: "User" });
        const toast = await screen.findByRole("status");
        expect(toast).toHaveTextContent("Compte créé");
        expect(toast).toHaveTextContent("Bienvenue jdupont. Vous avez le rôle User.");
    });

    it("links back to the login page", async () => {
        const { user } = await renderRegister();

        await user.click(screen.getByRole("link", { name: "Se connecter" }));

        expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/login");
    });
});
