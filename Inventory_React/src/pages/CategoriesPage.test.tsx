import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp, type As } from "../test/render";
import { server } from "../test/server";

/** Shown in a counter cell until /products has answered. */
const PENDING = "…";

const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

/** Text of each cell of a category's row: name, products, low stock, stock value, actions. */
function cells(name: string) {
    const row = screen.getByRole("link", { name }).closest("tr");
    if (!row) throw new Error(`No table row for ${name}`);
    return within(row).getAllByRole("cell").map(text);
}

/** Renders /categories and waits for the list and its counters. */
async function openPage(as: As = "Admin") {
    const view = renderApp("/categories", { as });
    await screen.findByRole("heading", { level: 1, name: "Catégories" });
    await waitFor(() => expect(screen.queryAllByText(PENDING)).toHaveLength(0));
    return view;
}

const nameInput = (dialog: HTMLElement) => within(dialog).getByRole("textbox", { name: /^Nom/ });

/** A request that waits for release() before falling through to the fake API. */
function holdRequests() {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    return { gate, release: () => release() };
}

describe("CategoriesPage", () => {
    describe("table", () => {
        it("shows the product count, low-stock count and stock value of each category", async () => {
            await openPage();

            await waitFor(() => expect(document.title).toBe("Catégories — Inventory"));
            expect(screen.getByText("3 catégories · chaque produit appartient à une catégorie.")).toBeInTheDocument();
            // Visserie: 48 × 12,90 + 6 × 9,40 + 0 × 7,85 + 83 × 6,20; the out-of-stock bolt counts as low.
            expect(cells("Visserie")).toEqual(["Visserie", "4", "2", "1 190,20 €", ""]);
            // Outillage: 7 × 189 + 4 × 94,50 + 3 × 18,90 + 26 × 8,50 + 2 × 76; stock equal to the threshold is low.
            expect(cells("Outillage")).toEqual(["Outillage", "5", "2", "2 130,70 €", ""]);
            expect(cells("Électricité")).toEqual(["Électricité", "0", "0", "0,00 €", ""]);
            // Products without a category (10 to 12) are not counted anywhere.
            expect(screen.queryByText("Lecture seule", { exact: false })).not.toBeInTheDocument();
        });

        it("links each category to the product list filtered on it", async () => {
            const { user } = await openPage();

            const link = screen.getByRole("link", { name: "Outillage" });
            expect(link).toHaveAttribute("href", "/produits?cat=2");
            await user.click(link);

            expect(await screen.findByRole("heading", { level: 1, name: "Produits" })).toBeInTheDocument();
            expect(window.location.pathname + window.location.search).toBe("/produits?cat=2");
            expect(await screen.findByRole("button", { name: "Retirer le filtre Catégorie : Outillage" })).toBeInTheDocument();
        });

        it("shows placeholders and disables delete until the products are loaded", async () => {
            const products = holdRequests();
            server.use(http.get(api("/products"), () => products.gate));
            renderApp("/categories");

            await screen.findByRole("heading", { level: 1, name: "Catégories" });
            expect(cells("Visserie")).toEqual(["Visserie", PENDING, PENDING, PENDING, ""]);
            expect(screen.getByRole("button", { name: "Supprimer Visserie" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Modifier Visserie" })).toBeEnabled();

            products.release();
            await waitFor(() => expect(cells("Visserie")).toEqual(["Visserie", "4", "2", "1 190,20 €", ""]));
            expect(screen.getByRole("button", { name: "Supprimer Visserie" })).toBeEnabled();
        });

        it("keeps the categories when the counters cannot be loaded, and retries", async () => {
            server.use(http.get(api("/products"), () => HttpResponse.error(), { once: true }));
            const { user } = renderApp("/categories");

            const banner = await screen.findByRole("alert");
            expect(banner).toHaveTextContent("Compteurs indisponibles. Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
            expect(cells("Visserie")).toEqual(["Visserie", PENDING, PENDING, PENDING, ""]);
            expect(screen.getByRole("button", { name: "Supprimer Visserie" })).toBeDisabled();

            await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

            await waitFor(() => expect(cells("Visserie")[1]).toBe("4"));
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("shows an error with a retry when the categories cannot be loaded", async () => {
            server.use(http.get(api("/categories"), () => HttpResponse.json({ title: "Internal Server Error" }, { status: 500 }), { once: true }));
            const { user } = renderApp("/categories");

            const banner = await screen.findByRole("alert");
            expect(banner).toHaveTextContent("Impossible de charger les catégories. Une erreur interne est survenue côté serveur.");
            expect(screen.queryByRole("table")).not.toBeInTheDocument();

            await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

            expect(await screen.findByRole("link", { name: "Visserie" })).toBeInTheDocument();
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("shows the empty state, from which an Admin creates the first category", async () => {
            db.categories.length = 0;
            const { user } = await openPage();

            expect(screen.getByText("0 catégorie · chaque produit appartient à une catégorie.")).toBeInTheDocument();
            expect(screen.queryByRole("table")).not.toBeInTheDocument();
            const empty = screen.getByRole("heading", { name: "Aucune catégorie" }).parentElement as HTMLElement;
            expect(empty).toHaveTextContent("Créez une première catégorie pour classer vos produits.");

            await user.click(within(empty).getByRole("button", { name: "Nouvelle catégorie" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvelle catégorie" });
            await user.type(nameInput(dialog), "Quincaillerie");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            expect(await screen.findByRole("link", { name: "Quincaillerie" })).toBeInTheDocument();
            expect(screen.queryByRole("heading", { name: "Aucune catégorie" })).not.toBeInTheDocument();
            expect(db.categories).toEqual([{ id: 1, name: "Quincaillerie" }]);
        });

        it("is read-only for a User", async () => {
            await openPage("User");

            expect(cells("Visserie")).toEqual(["Visserie", "4", "2", "1 190,20 €", ""]);
            expect(screen.queryByRole("button", { name: "Nouvelle catégorie" })).not.toBeInTheDocument();
            expect(screen.queryAllByRole("button", { name: /^(Modifier|Supprimer) / })).toHaveLength(0);
            expect(screen.getByText("Lecture seule : la gestion des catégories est réservée aux administrateurs.")).toBeInTheDocument();
        });

        it("shows the empty state without any action to a User", async () => {
            db.categories.length = 0;
            await openPage("User");

            expect(screen.getByRole("heading", { name: "Aucune catégorie" })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Nouvelle catégorie" })).not.toBeInTheDocument();
        });
    });

    describe("create and edit", () => {
        it("creates a category with the trimmed name", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Nouvelle catégorie" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvelle catégorie" });
            const input = nameInput(dialog);
            expect(input).toHaveValue("");
            expect(input).toHaveAccessibleDescription("100 caractères maximum.");

            await user.type(input, "  Quincaillerie  ");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            await waitFor(() => expect(dialog).not.toBeInTheDocument());
            const toast = await screen.findByRole("status");
            expect(toast).toHaveTextContent("Catégorie créée");
            expect(toast).toHaveTextContent("Quincaillerie");
            expect(db.categories).toContainEqual({ id: 4, name: "Quincaillerie" });
            expect(await screen.findByRole("link", { name: "Quincaillerie" })).toHaveAttribute("href", "/produits?cat=4");
            expect(cells("Quincaillerie")).toEqual(["Quincaillerie", "0", "0", "0,00 €", ""]);
            expect(screen.getByText("4 catégories · chaque produit appartient à une catégorie.")).toBeInTheDocument();
        });

        it("requires a name, rejects an existing one and re-validates while it is corrected", async () => {
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Nouvelle catégorie" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvelle catégorie" });
            const input = nameInput(dialog);

            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
            expect(input).toBeInvalid();
            expect(input).toHaveAccessibleDescription("100 caractères maximum. Le nom est obligatoire.");

            // Case and surrounding spaces do not make a new name.
            await user.type(input, " outillage ");
            expect(within(dialog).getByText("Cette catégorie existe déjà.")).toBeInTheDocument();

            await user.clear(input);
            await user.type(input, "Outillage électroportatif");
            expect(input).toBeValid();
            expect(within(dialog).queryByText("Cette catégorie existe déjà.")).not.toBeInTheDocument();
            expect(db.categories).toHaveLength(3);
        });

        it("checks the name when the field loses focus", async () => {
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Nouvelle catégorie" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvelle catégorie" });
            const input = nameInput(dialog);

            await user.type(input, "VISSERIE");
            expect(input).toBeValid();
            await user.tab();

            expect(input).toBeInvalid();
            expect(within(dialog).getByText("Cette catégorie existe déjà.")).toBeInTheDocument();
        });

        it("edits a category, whose own name is not a duplicate", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Modifier Visserie" }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier la catégorie" });
            const input = nameInput(dialog);
            expect(input).toHaveValue("Visserie");

            await user.clear(input);
            await user.type(input, "visserie");
            await user.tab();
            expect(input).toBeValid();

            await user.clear(input);
            await user.type(input, "Visserie et boulonnerie");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            const toast = await screen.findByRole("status");
            expect(toast).toHaveTextContent("Catégorie modifiée");
            expect(toast).toHaveTextContent("Visserie et boulonnerie");
            expect(db.categories.find((c) => c.id === 1)?.name).toBe("Visserie et boulonnerie");
            expect(await screen.findByRole("link", { name: "Visserie et boulonnerie" })).toBeInTheDocument();
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });

        it("refuses to save a name longer than 100 characters", async () => {
            // The API may hold a longer name than the input lets anyone type.
            const long = "C".repeat(101);
            db.categories.push({ id: 4, name: long });
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: `Modifier ${long}` }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier la catégorie" });
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            expect(nameInput(dialog)).toBeInvalid();
            expect(nameInput(dialog)).toHaveAccessibleDescription("100 caractères maximum. 100 caractères maximum.");
            expect(db.categories.find((c) => c.id === 4)?.name).toBe(long);
        });

        it("shows the server's validation error on the field and keeps the modal open", async () => {
            server.use(
                http.post(api("/categories"), () =>
                    HttpResponse.json(
                        { title: "One or more validation errors occurred.", status: 400, errors: { Name: ["Ce nom est réservé."] } },
                        { status: 400 },
                    ),
                ),
            );
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Nouvelle catégorie" }));
            const dialog = await screen.findByRole("dialog", { name: "Nouvelle catégorie" });
            const input = nameInput(dialog);

            await user.type(input, "Divers");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            expect(await within(dialog).findByText("Ce nom est réservé.")).toBeInTheDocument();
            expect(input).toBeInvalid();
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
            expect(db.categories).toHaveLength(3);

            // Typing clears the server's message.
            await user.type(input, " 2");
            expect(within(dialog).queryByText("Ce nom est réservé.")).not.toBeInTheDocument();
            expect(input).toBeValid();
        });

        it("shows a toast and keeps the modal open when the save fails", async () => {
            server.use(http.put(api("/categories/:id"), () => HttpResponse.json({ title: "Internal Server Error" }, { status: 500 })));
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Modifier Outillage" }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier la catégorie" });

            await user.type(nameInput(dialog), " pro");
            await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

            const toast = await screen.findByRole("alert");
            expect(toast).toHaveTextContent("Enregistrement impossible");
            expect(toast).toHaveTextContent("Une erreur interne est survenue côté serveur.");
            expect(dialog).toBeInTheDocument();
            expect(nameInput(dialog)).toHaveValue("Outillage pro");
            expect(db.categories.find((c) => c.id === 2)?.name).toBe("Outillage");
        });

        it("closes the modal without saving on Annuler", async () => {
            const { user } = await openPage();
            await user.click(screen.getByRole("button", { name: "Modifier Outillage" }));
            const dialog = await screen.findByRole("dialog", { name: "Modifier la catégorie" });

            await user.type(nameInput(dialog), " pro");
            await user.click(within(dialog).getByRole("button", { name: "Annuler" }));

            await waitFor(() => expect(dialog).not.toBeInTheDocument());
            expect(db.categories.find((c) => c.id === 2)?.name).toBe("Outillage");
            expect(screen.getByRole("link", { name: "Outillage" })).toBeInTheDocument();
        });
    });

    describe("delete", () => {
        it("deletes an empty category after confirmation", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Supprimer Électricité" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer cette catégorie ?" });
            expect(dialog).toHaveTextContent("Électricité ne contient aucun produit et sera supprimée.");
            await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

            const toast = await screen.findByRole("status");
            expect(toast).toHaveTextContent("Catégorie supprimée");
            expect(toast).toHaveTextContent("Électricité");
            await waitFor(() => expect(screen.queryByRole("link", { name: "Électricité" })).not.toBeInTheDocument());
            expect(db.categories.map((c) => c.id)).toEqual([1, 2]);
            expect(screen.getByText("2 catégories · chaque produit appartient à une catégorie.")).toBeInTheDocument();
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });

        it("keeps the category when the confirmation is cancelled", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Supprimer Électricité" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer cette catégorie ?" });
            await user.click(within(dialog).getByRole("button", { name: "Annuler" }));

            await waitFor(() => expect(dialog).not.toBeInTheDocument());
            expect(db.categories).toHaveLength(3);
            expect(screen.getByRole("link", { name: "Électricité" })).toBeInTheDocument();
        });

        it("blocks deleting a category that still has products and leads to them", async () => {
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Supprimer Visserie" }));
            const dialog = await screen.findByRole("dialog", { name: "Suppression impossible" });
            expect(dialog).toHaveTextContent(
                "Visserie est encore rattachée à 4 produits. Réaffectez ces produits à une autre catégorie avant de la supprimer.",
            );
            expect(within(dialog).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();

            await user.click(within(dialog).getByRole("button", { name: "Voir les produits" }));

            expect(await screen.findByRole("heading", { level: 1, name: "Produits" })).toBeInTheDocument();
            expect(window.location.pathname + window.location.search).toBe("/produits?cat=1");
            expect(await screen.findByRole("button", { name: "Retirer le filtre Catégorie : Visserie" })).toBeInTheDocument();
            expect(db.categories).toHaveLength(3);
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });

        it("reports the API's 409 when the category got a product in the meantime", async () => {
            const { user } = await openPage();
            // Someone files a product under Électricité after the page has loaded.
            db.products.push({ id: 13, name: "Câble H07 2,5 mm²", price: 1.2, stock: 50, lowStockThreshold: 10, categoryId: 3 });

            await user.click(screen.getByRole("button", { name: "Supprimer Électricité" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer cette catégorie ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

            const toast = await screen.findByRole("alert");
            expect(toast).toHaveTextContent("Suppression refusée");
            expect(toast).toHaveTextContent("La catégorie 3 contient des produits : réaffectez-les avant de la supprimer.");
            expect(db.categories).toHaveLength(3);
            // The counters are refreshed, so the next attempt explains why instead of failing again.
            await waitFor(() => expect(cells("Électricité")).toEqual(["Électricité", "1", "0", "60,00 €", ""]));
        });

        it.each([
            ["a 409 without detail", 409, { title: "Conflit avec l'état actuel des données." }, "Conflit avec l'état actuel des données."],
            ["a server error", 500, { title: "Internal Server Error" }, "Une erreur interne est survenue côté serveur."],
        ])("shows the generic message for %s", async (_case, status, body, message) => {
            server.use(http.delete(api("/categories/:id"), () => HttpResponse.json(body, { status })));
            const { user } = await openPage();

            await user.click(screen.getByRole("button", { name: "Supprimer Électricité" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer cette catégorie ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

            const toast = await screen.findByRole("alert");
            expect(toast).toHaveTextContent("Suppression refusée");
            expect(toast).toHaveTextContent(message);
            expect(screen.getByRole("link", { name: "Électricité" })).toBeInTheDocument();
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        });
    });
});
