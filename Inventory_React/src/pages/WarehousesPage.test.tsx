import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { apiDate, db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp, type As } from "../test/render";
import { server } from "../test/server";

/** Shown in the counter cells until the movement pages have answered. */
const PENDING = "…";

const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

function row(name: string) {
    const tr = screen.getByRole("link", { name }).closest("tr");
    if (!tr) throw new Error(`No table row for ${name}`);
    return tr;
}

/** Text of the movement count and latest movement cells of a warehouse. */
const stats = (name: string) => within(row(name)).getAllByRole("cell").slice(1, 3).map(text);

const paris = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "dd/mm/yyyy hh:mm" in Paris time of a stored movement (the API sends UTC without a zone designator). */
function shownDate(movementId: number) {
    const movement = db.movements.find((m) => m.id === movementId);
    if (!movement) throw new Error(`No movement ${movementId}`);
    return paris.format(new Date(`${movement.date}Z`));
}

/** Renders /entrepots and waits for the list and its counters. */
async function openPage(as: As = "Admin") {
    const view = renderApp("/entrepots", { as });
    await screen.findByRole("heading", { level: 1, name: "Entrepôts" });
    await waitFor(() => expect(screen.queryAllByText(PENDING)).toHaveLength(0));
    return view;
}

const nameInput = (dialog: HTMLElement) => within(dialog).getByRole("textbox", { name: /^Nom/ });
const addressInput = (dialog: HTMLElement) => within(dialog).getByRole("textbox", { name: /^Adresse/ });

describe("WarehousesPage", () => {
    describe("table", () => {
        it("shows the movement count and the latest movement of each warehouse", async () => {
            const asked: URLSearchParams[] = [];
            server.use(
                http.get(api("/stock/movements"), ({ request }) => {
                    asked.push(new URL(request.url).searchParams);
                }),
            );
            await openPage();

            await waitFor(() => expect(document.title).toBe("Entrepôts — Inventory"));
            expect(screen.getByText("3 entrepôts · chaque mouvement est rattaché à un entrepôt.")).toBeInTheDocument();
            // Nord: movements 1 (1 h ago), 3 and 5; Sud: 2 (2 h ago) and 4; Ouest: none.
            expect(stats("Entrepôt Nord")).toEqual(["3", shownDate(1)]);
            expect(stats("Entrepôt Sud")).toEqual(["2", shownDate(2)]);
            expect(stats("Entrepôt Ouest")).toEqual(["0", "—"]);
            expect(within(row("Entrepôt Nord")).getByText("12 rue des Docks, 59000 Lille")).toBeInTheDocument();
            expect(within(row("Entrepôt Sud")).getByText("48 avenue Berthelot, 69007 Lyon")).toBeInTheDocument();
            expect(text(within(row("Entrepôt Ouest")).getAllByRole("cell")[0])).toBe("Entrepôt Ouest");
            expect(screen.queryByText("Lecture seule", { exact: false })).not.toBeInTheDocument();

            // One single-row page per warehouse: totalItems is the count, the only row the latest movement.
            const queries = asked.map((q) => Object.fromEntries(q)).sort((a, b) => a.warehouseId.localeCompare(b.warehouseId));
            expect(queries).toEqual([
                { warehouseId: "1", pageSize: "1" },
                { warehouseId: "2", pageSize: "1" },
                { warehouseId: "3", pageSize: "1" },
            ]);
        });

        it("links each warehouse to its movements", async () => {
            const { user } = await openPage();

            const link = screen.getByRole("link", { name: "Entrepôt Sud" });
            expect(link).toHaveAttribute("href", "/mouvements?entrepot=2");
            await user.click(link);

            expect(await screen.findByRole("heading", { level: 1, name: "Mouvements de stock" })).toBeInTheDocument();
            expect(window.location.pathname + window.location.search).toBe("/mouvements?entrepot=2");
        });

        it("shows placeholders and disables delete until the counters are loaded", async () => {
            let release = () => {};
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            server.use(http.get(api("/stock/movements"), () => gate));
            renderApp("/entrepots");

            await screen.findByRole("heading", { level: 1, name: "Entrepôts" });
            expect(stats("Entrepôt Nord")).toEqual([PENDING, PENDING]);
            expect(screen.getByRole("button", { name: "Supprimer Entrepôt Ouest" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Modifier Entrepôt Ouest" })).toBeEnabled();

            release();
            await waitFor(() => expect(stats("Entrepôt Ouest")).toEqual(["0", "—"]));
            expect(screen.getByRole("button", { name: "Supprimer Entrepôt Ouest" })).toBeEnabled();
        });

        it("keeps the warehouses when the counters cannot be loaded, and retries", async () => {
            server.use(http.get(api("/stock/movements"), () => HttpResponse.error(), { once: true }));
            const { user } = renderApp("/entrepots");

            const banner = await screen.findByRole("alert");
            expect(banner).toHaveTextContent("Compteurs indisponibles. Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
            expect(stats("Entrepôt Nord")).toEqual([PENDING, PENDING]);
            expect(screen.getByRole("button", { name: "Supprimer Entrepôt Nord" })).toBeDisabled();

            await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

            await waitFor(() => expect(stats("Entrepôt Nord")).toEqual(["3", shownDate(1)]));
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("shows an error with a retry when the warehouses cannot be loaded", async () => {
            server.use(http.get(api("/warehouses"), () => HttpResponse.json({ title: "Internal Server Error" }, { status: 500 }), { once: true }));
            const { user } = renderApp("/entrepots");

            const banner = await screen.findByRole("alert");
            expect(banner).toHaveTextContent("Impossible de charger les entrepôts. Une erreur interne est survenue côté serveur.");
            expect(screen.queryByRole("table")).not.toBeInTheDocument();

            await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

            expect(await screen.findByRole("link", { name: "Entrepôt Nord" })).toBeInTheDocument();
            await waitFor(() => expect(stats("Entrepôt Nord")[0]).toBe("3"));
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("shows the empty state, from which an Admin creates the first warehouse", async () => {
            // Without warehouses there can be no movements either.
            db.warehouses.length = 0;
            db.movements.length = 0;
            const { user } = await openPage();

            expect(screen.getByText("0 entrepôt · chaque mouvement est rattaché à un entrepôt.")).toBeInTheDocument();
            expect(screen.queryByRole("table")).not.toBeInTheDocument();
            const empty = screen.getByRole("heading", { name: "Aucun entrepôt" }).parentElement as HTMLElement;
            expect(empty).toHaveTextContent("Créez un premier entrepôt pour enregistrer des mouvements.");

            await user.click(within(empty).getByRole("button", { name: "Nouvel entrepôt" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvel entrepôt" });
            await user.type(nameInput(dialog), "Entrepôt Est");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            expect(await screen.findByRole("link", { name: "Entrepôt Est" })).toBeInTheDocument();
            await waitFor(() => expect(stats("Entrepôt Est")).toEqual(["0", "—"]));
            expect(db.warehouses).toEqual([{ id: 1, name: "Entrepôt Est", address: null }]);
        });

        it("is read-only for a User", async () => {
            await openPage("User");

            expect(stats("Entrepôt Nord")).toEqual(["3", shownDate(1)]);
            expect(screen.queryByRole("button", { name: "Nouvel entrepôt" })).not.toBeInTheDocument();
            expect(screen.queryAllByRole("button", { name: /^(Modifier|Supprimer) / })).toHaveLength(0);
            expect(screen.getByText("Lecture seule : la gestion des entrepôts est réservée aux administrateurs.")).toBeInTheDocument();
        });

        it("shows the empty state without any action to a User", async () => {
            db.warehouses.length = 0;
            await openPage("User");

            expect(screen.getByRole("heading", { name: "Aucun entrepôt" })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Nouvel entrepôt" })).not.toBeInTheDocument();
        });
    });

    describe("create and edit", () => {
        it("creates a warehouse without an address", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Nouvel entrepôt" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvel entrepôt" });
            expect(nameInput(dialog)).toHaveValue("");
            expect(addressInput(dialog)).toHaveValue("");
            expect(addressInput(dialog)).toHaveAccessibleDescription("Facultatif, 250 caractères maximum.");
            expect(addressInput(dialog)).not.toBeRequired();

            await user.type(nameInput(dialog), "Entrepôt Est");
            await user.type(addressInput(dialog), "   ");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            const toast = await screen.findByRole("status");
            expect(toast).toHaveTextContent("Entrepôt créé");
            expect(toast).toHaveTextContent("Entrepôt Est");
            expect(db.warehouses).toContainEqual({ id: 4, name: "Entrepôt Est", address: null });
            expect(await screen.findByRole("link", { name: "Entrepôt Est" })).toHaveAttribute("href", "/mouvements?entrepot=4");
            await waitFor(() => expect(stats("Entrepôt Est")).toEqual(["0", "—"]));
            expect(screen.getByText("4 entrepôts · chaque mouvement est rattaché à un entrepôt.")).toBeInTheDocument();
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });

        it("creates a warehouse with a trimmed name and address", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Nouvel entrepôt" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvel entrepôt" });
            await user.type(nameInput(dialog), " Entrepôt Est ");
            await user.type(addressInput(dialog), " 3 quai Kléber, 67000 Strasbourg ");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            const link = await screen.findByRole("link", { name: "Entrepôt Est" });
            expect(within(link.closest("tr") as HTMLElement).getByText("3 quai Kléber, 67000 Strasbourg")).toBeInTheDocument();
            expect(db.warehouses).toContainEqual({ id: 4, name: "Entrepôt Est", address: "3 quai Kléber, 67000 Strasbourg" });
            await waitFor(() => expect(stats("Entrepôt Est")).toEqual(["0", "—"]));
        });

        it("edits a warehouse and removes its address", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Modifier Entrepôt Nord" }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier l’entrepôt" });
            expect(nameInput(dialog)).toHaveValue("Entrepôt Nord");
            expect(addressInput(dialog)).toHaveValue("12 rue des Docks, 59000 Lille");

            await user.type(nameInput(dialog), "-Est");
            await user.clear(addressInput(dialog));
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            const toast = await screen.findByRole("status");
            expect(toast).toHaveTextContent("Entrepôt modifié");
            expect(toast).toHaveTextContent("Entrepôt Nord-Est");
            expect(db.warehouses.find((w) => w.id === 1)).toEqual({ id: 1, name: "Entrepôt Nord-Est", address: null });
            expect(await screen.findByRole("link", { name: "Entrepôt Nord-Est" })).toBeInTheDocument();
            expect(screen.queryByText("12 rue des Docks, 59000 Lille")).not.toBeInTheDocument();
            await waitFor(() => expect(stats("Entrepôt Nord-Est")).toEqual(["3", shownDate(1)]));
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });

        it("adds an address to a warehouse that has none", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Modifier Entrepôt Ouest" }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier l’entrepôt" });
            expect(addressInput(dialog)).toHaveValue("");

            await user.type(addressInput(dialog), "5 rue de Brest, 35000 Rennes");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            expect(await within(row("Entrepôt Ouest")).findByText("5 rue de Brest, 35000 Rennes")).toBeInTheDocument();
            expect(db.warehouses.find((w) => w.id === 3)).toEqual({ id: 3, name: "Entrepôt Ouest", address: "5 rue de Brest, 35000 Rennes" });
            await waitFor(() => expect(stats("Entrepôt Ouest")).toEqual(["0", "—"]));
        });

        it("requires a name, rejects an existing one but accepts the warehouse's own", async () => {
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Modifier Entrepôt Sud" }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier l’entrepôt" });
            const input = nameInput(dialog);

            await user.clear(input);
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
            expect(input).toBeInvalid();
            expect(input).toHaveAccessibleDescription("Le nom est obligatoire.");

            await user.type(input, " ENTREPÔT NORD ");
            expect(input).toHaveAccessibleDescription("Cet entrepôt existe déjà.");

            await user.clear(input);
            await user.type(input, "entrepôt sud");
            expect(input).toBeValid();
            expect(db.warehouses.find((w) => w.id === 2)?.name).toBe("Entrepôt Sud");
        });

        it("checks the name when the field loses focus", async () => {
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Nouvel entrepôt" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvel entrepôt" });

            await user.type(nameInput(dialog), "Entrepôt Ouest");
            expect(nameInput(dialog)).toBeValid();
            await user.tab();

            expect(nameInput(dialog)).toHaveAccessibleDescription("Cet entrepôt existe déjà.");
            expect(addressInput(dialog)).toHaveFocus();
        });

        it("refuses a name over 100 characters and an address over 250", async () => {
            // The API may hold longer values than the inputs let anyone type.
            const name = "E".repeat(101);
            db.warehouses.push({ id: 4, name, address: "A".repeat(251) });
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: `Modifier ${name}` }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier l’entrepôt" });
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            expect(nameInput(dialog)).toHaveAccessibleDescription("100 caractères maximum.");
            expect(addressInput(dialog)).toHaveAccessibleDescription("Facultatif, 250 caractères maximum. 250 caractères maximum.");
            expect(db.warehouses.find((w) => w.id === 4)?.address).toHaveLength(251);
        });

        it("shows the server's validation error on the address and keeps the modal open", async () => {
            server.use(
                http.post(api("/warehouses"), () =>
                    HttpResponse.json(
                        { title: "One or more validation errors occurred.", status: 400, errors: { Address: ["L'adresse doit comporter un code postal."] } },
                        { status: 400 },
                    ),
                ),
            );
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Nouvel entrepôt" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvel entrepôt" });

            await user.type(nameInput(dialog), "Entrepôt Est");
            await user.type(addressInput(dialog), "Strasbourg");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            expect(await within(dialog).findByText("L'adresse doit comporter un code postal.")).toBeInTheDocument();
            expect(addressInput(dialog)).toBeInvalid();
            expect(nameInput(dialog)).toBeValid();
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
            expect(db.warehouses).toHaveLength(3);
        });

        it("shows a toast and keeps the modal open when the save fails", async () => {
            server.use(http.put(api("/warehouses/:id"), () => HttpResponse.error()));
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Modifier Entrepôt Sud" }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier l’entrepôt" });

            await user.type(nameInput(dialog), " 2");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            const toast = await screen.findByRole("alert");
            expect(toast).toHaveTextContent("Enregistrement impossible");
            expect(toast).toHaveTextContent("Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
            expect(dialog).toBeInTheDocument();
            expect(db.warehouses.find((w) => w.id === 2)?.name).toBe("Entrepôt Sud");
        });

        it("closes the modal without saving on Annuler", async () => {
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Modifier Entrepôt Sud" }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier l’entrepôt" });

            await user.clear(addressInput(dialog));
            await user.click(within(dialog).getByRole("button", { name: "Annuler" }));

            await waitFor(() => expect(dialog).not.toBeInTheDocument());
            expect(db.warehouses.find((w) => w.id === 2)?.address).toBe("48 avenue Berthelot, 69007 Lyon");
        });
    });

    describe("delete", () => {
        it("deletes a warehouse without movements after confirmation", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Supprimer Entrepôt Ouest" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer cet entrepôt ?" });
            expect(dialog).toHaveTextContent("Entrepôt Ouest n’a aucun mouvement et sera supprimé.");
            await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

            const toast = await screen.findByRole("status");
            expect(toast).toHaveTextContent("Entrepôt supprimé");
            expect(toast).toHaveTextContent("Entrepôt Ouest");
            await waitFor(() => expect(screen.queryByRole("link", { name: "Entrepôt Ouest" })).not.toBeInTheDocument());
            expect(db.warehouses.map((w) => w.id)).toEqual([1, 2]);
            await waitFor(() => expect(screen.queryAllByText(PENDING)).toHaveLength(0));
            expect(screen.getByText("2 entrepôts · chaque mouvement est rattaché à un entrepôt.")).toBeInTheDocument();
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });

        it("keeps the warehouse when the confirmation is cancelled", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Supprimer Entrepôt Ouest" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer cet entrepôt ?" });
            await user.click(within(dialog).getByRole("button", { name: "Annuler" }));

            await waitFor(() => expect(dialog).not.toBeInTheDocument());
            expect(db.warehouses).toHaveLength(3);
        });

        it("blocks deleting a warehouse that has movements and leads to them", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Supprimer Entrepôt Nord" }));
            const dialog = await screen.findByRole("dialog", { name: "Suppression impossible" });
            expect(dialog).toHaveTextContent(
                "Entrepôt Nord porte 3 mouvements de stock. L’historique doit rester consultable : un entrepôt avec des mouvements ne peut pas être supprimé.",
            );
            expect(within(dialog).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();

            await user.click(within(dialog).getByRole("button", { name: "Voir les mouvements" }));

            expect(await screen.findByRole("heading", { level: 1, name: "Mouvements de stock" })).toBeInTheDocument();
            expect(window.location.pathname + window.location.search).toBe("/mouvements?entrepot=1");
            expect(db.warehouses).toHaveLength(3);
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });

        it("reports the API's 409 when the warehouse got a movement in the meantime", async () => {
            const { user } = await openPage();
            // A movement is recorded in Entrepôt Ouest after the page has loaded.
            db.movements.push({ id: 6, productId: 11, warehouseId: 3, type: "In", quantity: 4, delta: 4, date: apiDate(0), userId: 2, notes: null });

            await user.click(screen.getByRole("button", { name: "Supprimer Entrepôt Ouest" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer cet entrepôt ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

            const toast = await screen.findByRole("alert");
            expect(toast).toHaveTextContent("Suppression refusée");
            expect(toast).toHaveTextContent("L'entrepôt 3 a des mouvements de stock : il ne peut pas être supprimé.");
            expect(db.warehouses).toHaveLength(3);
            // The counters are refreshed, so the next attempt explains why instead of failing again.
            await waitFor(() => expect(stats("Entrepôt Ouest")).toEqual(["1", shownDate(6)]));
        });

        it.each([
            ["a 409 without detail", 409, { title: "Conflit avec l'état actuel des données." }, "Conflit avec l'état actuel des données."],
            ["a server error", 500, { title: "Internal Server Error" }, "Une erreur interne est survenue côté serveur."],
        ])("shows the generic message for %s", async (_case, status, body, message) => {
            server.use(http.delete(api("/warehouses/:id"), () => HttpResponse.json(body, { status })));
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Supprimer Entrepôt Ouest" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer cet entrepôt ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

            const toast = await screen.findByRole("alert");
            expect(toast).toHaveTextContent("Suppression refusée");
            expect(toast).toHaveTextContent(message);
            expect(screen.getByRole("link", { name: "Entrepôt Ouest" })).toBeInTheDocument();
            await waitFor(() => expect(screen.queryAllByText(PENDING)).toHaveLength(0));
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });
    });
});
