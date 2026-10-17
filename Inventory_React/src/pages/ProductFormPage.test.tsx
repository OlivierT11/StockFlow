import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ProductUpdate } from "../lib/types";
import { db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp } from "../test/render";
import { server } from "../test/server";

const nameInput = () => screen.getByRole("textbox", { name: /^Nom du produit/ });
const categorySelect = () => screen.getByRole("combobox", { name: /^Catégorie/ });
const priceInput = () => screen.getByRole("spinbutton", { name: /^Prix unitaire/ });
const stockInput = () => screen.getByRole("spinbutton", { name: /^Stock initial/ });
const thresholdInput = () => screen.getByRole("spinbutton", { name: /^Seuil de stock bas/ });
const currentStock = () => screen.getByRole("textbox", { description: "Le stock se modifie uniquement par un mouvement de stock." });
const createButton = () => screen.getByRole("button", { name: "Créer le produit" });
const saveButton = () => screen.getByRole("button", { name: "Enregistrer les modifications" });

const summary = () => screen.getByRole("alert");
const summaryMessages = () => within(summary()).getAllByRole("link").map((link) => link.textContent);

async function renderCreate() {
    const view = renderApp("/produits/nouveau");
    await screen.findByRole("heading", { level: 1, name: "Nouveau produit" });
    await screen.findByRole("option", { name: "Outillage" });
    return view;
}

async function renderEdit(id: number) {
    const view = renderApp(`/produits/${id}/modifier`);
    await screen.findByRole("button", { name: "Enregistrer les modifications" });
    await screen.findByRole("option", { name: "Outillage" });
    return view;
}

/** The toast whose title is `title`. */
async function findToast(title: string) {
    const titleEl = await screen.findByText(title);
    return titleEl.closest<HTMLElement>("[role=status], [role=alert]")!;
}

describe("ProductFormPage", () => {
    describe("create", () => {
        it("starts from an empty form with the default stock and threshold", async () => {
            await renderCreate();

            await waitFor(() => expect(document.title).toBe("Nouveau produit — Inventory"));
            expect(screen.getByText("Les champs marqués d’un astérisque sont obligatoires.")).toBeInTheDocument();
            const crumbs = screen.getByRole("navigation", { name: "Fil d’Ariane" });
            expect(within(crumbs).getByRole("link", { name: "Produits" })).toHaveAttribute("href", "/produits");
            expect(within(crumbs).getByText("Nouveau")).toBeInTheDocument();
            expect(nameInput()).toHaveValue("");
            expect(nameInput()).toHaveFocus();
            expect(within(categorySelect()).getAllByRole("option").map((o) => o.textContent)).toEqual([
                "Choisir une catégorie",
                "Visserie",
                "Outillage",
                "Électricité",
            ]);
            expect(priceInput()).toHaveValue(null);
            expect(stockInput()).toHaveValue(0);
            expect(thresholdInput()).toHaveValue(10);
            expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", "/produits");
        });

        it("creates the product, returns to the list and offers to open it from the toast", async () => {
            const { user } = await renderCreate();

            await user.type(nameInput(), "  Agrafeuse murale  ");
            await user.selectOptions(categorySelect(), "Outillage");
            await user.type(priceInput(), "24.5");
            await user.clear(stockInput());
            await user.type(stockInput(), "15");
            await user.clear(thresholdInput());
            await user.type(thresholdInput(), "5");
            await user.click(createButton());

            const toast = await findToast("Produit créé");
            expect(toast).toHaveTextContent("Agrafeuse murale a été ajouté au catalogue.");
            expect(window.location.pathname).toBe("/produits");
            expect(db.products.find((p) => p.id === 13)).toEqual({ id: 13, name: "Agrafeuse murale", price: 24.5, stock: 15, lowStockThreshold: 5, categoryId: 2 });
            expect(await screen.findByRole("link", { name: "Agrafeuse murale" })).toBeInTheDocument();

            await user.click(within(toast).getByRole("button", { name: "Voir" }));

            expect(await screen.findByRole("heading", { level: 1, name: "Agrafeuse murale" })).toBeInTheDocument();
            expect(window.location.pathname).toBe("/produits/13");
        });

        it("checks every field on submit and lists the errors in a summary", async () => {
            const { user } = await renderCreate();
            await user.clear(stockInput());
            await user.clear(thresholdInput());

            await user.click(createButton());

            expect(within(summary()).getByText("5 champs à corriger :")).toBeInTheDocument();
            expect(summaryMessages()).toEqual([
                "Le nom est obligatoire.",
                "Choisissez une catégorie.",
                "Le prix est obligatoire.",
                "Le stock initial est obligatoire.",
                "Le seuil est obligatoire.",
            ]);
            for (const field of [nameInput(), categorySelect(), priceInput(), stockInput(), thresholdInput()]) {
                expect(field).toHaveAttribute("aria-invalid", "true");
            }
            expect(nameInput()).toHaveAccessibleDescription("100 caractères maximum. Le nom est obligatoire.");
            expect(db.products).toHaveLength(12);
            expect(window.location.pathname).toBe("/produits/nouveau");

            await user.click(within(summary()).getByRole("link", { name: "Le prix est obligatoire." }));
            expect(priceInput()).toHaveFocus();
        });

        it.each([
            { field: "name", value: "   ", message: "Le nom est obligatoire." },
            { field: "price", value: "-1", message: "Le prix doit être supérieur ou égal à 0." },
            { field: "price", value: "1.234", message: "Le prix accepte au plus deux décimales (ex. 12,50)." },
            { field: "stock", value: "1.5", message: "Le stock doit être un entier supérieur ou égal à 0." },
            { field: "stock", value: "-2", message: "Le stock doit être un entier supérieur ou égal à 0." },
            { field: "threshold", value: "2.5", message: "Le seuil doit être un entier supérieur ou égal à 0." },
            { field: "threshold", value: "-1", message: "Le seuil doit être un entier supérieur ou égal à 0." },
        ])("rejects $field « $value » when the field loses focus", async ({ field, value, message }) => {
            const { user } = await renderCreate();
            const input = { name: nameInput, price: priceInput, stock: stockInput, threshold: thresholdInput }[field]!();

            await user.clear(input);
            await user.type(input, value);
            expect(input).not.toHaveAttribute("aria-invalid");
            await user.tab();

            expect(input).toHaveAttribute("aria-invalid", "true");
            expect(input).toHaveAccessibleDescription(expect.stringContaining(message));
            // Blur checks one field; only a submit fills the summary.
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("checks the category when it loses focus", async () => {
            const { user } = await renderCreate();

            await user.click(categorySelect());
            await user.tab();

            expect(categorySelect()).toHaveAccessibleDescription("Choisissez une catégorie.");
        });

        it("re-checks a field live once it shows an error", async () => {
            const { user } = await renderCreate();
            await user.click(createButton());
            expect(within(summary()).getByText("3 champs à corriger :")).toBeInTheDocument();

            await user.type(nameInput(), "A");

            expect(nameInput()).not.toHaveAttribute("aria-invalid");
            expect(nameInput()).toHaveAccessibleDescription("100 caractères maximum.");
            expect(within(summary()).getByText("2 champs à corriger :")).toBeInTheDocument();

            await user.type(priceInput(), "1.234");
            expect(summaryMessages()).toEqual(["Choisissez une catégorie.", "Le prix accepte au plus deux décimales (ex. 12,50)."]);
            await user.type(priceInput(), "{Backspace}");
            expect(priceInput()).not.toHaveAttribute("aria-invalid");
            expect(within(summary()).getByText("1 champ à corriger :")).toBeInTheDocument();

            await user.selectOptions(categorySelect(), "Visserie");
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("shows the field errors returned by the API until the field is changed", async () => {
            const { user } = await renderCreate();
            // The category is deleted by someone else after the form has loaded the list.
            db.categories.splice(db.categories.findIndex((c) => c.id === 3), 1);

            await user.type(nameInput(), "Domino 32 A");
            await user.selectOptions(categorySelect(), "Électricité");
            await user.type(priceInput(), "3.5");
            await user.click(createButton());

            expect(await screen.findByText("1 champ à corriger :")).toBeInTheDocument();
            expect(summaryMessages()).toEqual(["La catégorie 3 n'existe pas."]);
            expect(categorySelect()).toHaveAttribute("aria-invalid", "true");
            expect(categorySelect()).toHaveAccessibleDescription("La catégorie 3 n'existe pas.");

            await user.selectOptions(categorySelect(), "Visserie");

            expect(categorySelect()).not.toHaveAttribute("aria-invalid");
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
            await user.click(createButton());
            await findToast("Produit créé");
            expect(db.products.find((p) => p.name === "Domino 32 A")).toMatchObject({ categoryId: 1, price: 3.5, stock: 0, lowStockThreshold: 10 });
        });

        it("maps each API field error to its own field", async () => {
            server.use(
                http.post(
                    api("/products"),
                    () =>
                        HttpResponse.json(
                            { title: "One or more validation errors occurred.", status: 400, errors: { Name: ["Ce nom existe déjà."], "$.price": ["Prix invalide."] } },
                            { status: 400 },
                        ),
                    { once: true },
                ),
            );
            const { user } = await renderCreate();
            await user.type(nameInput(), "Vis inox A2 M6 × 40");
            await user.selectOptions(categorySelect(), "Visserie");
            await user.type(priceInput(), "12.9");

            await user.click(createButton());

            expect(await screen.findByText("2 champs à corriger :")).toBeInTheDocument();
            expect(nameInput()).toHaveAccessibleDescription("100 caractères maximum. Ce nom existe déjà.");
            expect(priceInput()).toHaveAccessibleDescription("Deux décimales, supérieur ou égal à 0. Prix invalide.");

            await user.type(nameInput(), "0");

            expect(nameInput()).not.toHaveAttribute("aria-invalid");
            expect(priceInput()).toHaveAttribute("aria-invalid", "true");
            expect(summaryMessages()).toEqual(["Prix invalide."]);
        });

        it.each([
            { status: 400, body: { title: "Requête invalide." }, message: "Requête invalide." },
            { status: 404, body: {}, message: "L’élément demandé est introuvable (404)." },
            { status: 500, body: {}, message: "Une erreur interne est survenue côté serveur." },
        ])("shows a toast when the creation fails with $status", async ({ status, body, message }) => {
            server.use(http.post(api("/products"), () => HttpResponse.json(body, { status })));
            const { user } = await renderCreate();
            await user.type(nameInput(), "Agrafeuse murale");
            await user.selectOptions(categorySelect(), "Outillage");
            await user.type(priceInput(), "24.5");

            await user.click(createButton());

            expect(await findToast("Création impossible")).toHaveTextContent(message);
            expect(window.location.pathname).toBe("/produits/nouveau");
            expect(nameInput()).toHaveValue("Agrafeuse murale");
        });
    });

    describe("edit", () => {
        it("fills the form with the product", async () => {
            await renderEdit(1);

            await waitFor(() => expect(document.title).toBe("Modifier le produit — Inventory"));
            expect(screen.getByRole("heading", { level: 1, name: "Modifier le produit" })).toBeInTheDocument();
            expect(screen.getByText("Vis inox A2 M6 × 40", { selector: "p" })).toBeInTheDocument();
            const crumbs = screen.getByRole("navigation", { name: "Fil d’Ariane" });
            expect(within(crumbs).getByRole("link", { name: "Produits" })).toHaveAttribute("href", "/produits");
            expect(within(crumbs).getByRole("link", { name: "Vis inox A2 M6 × 40" })).toHaveAttribute("href", "/produits/1");
            expect(within(crumbs).getByText("Modifier")).toBeInTheDocument();
            expect(nameInput()).toHaveValue("Vis inox A2 M6 × 40");
            expect(categorySelect()).toHaveValue("1");
            expect(priceInput()).toHaveValue(12.9);
            expect(currentStock()).toHaveValue("48");
            expect(currentStock()).toBeDisabled();
            expect(screen.queryByRole("spinbutton", { name: /^Stock initial/ })).not.toBeInTheDocument();
            expect(thresholdInput()).toHaveValue(20);
            expect(screen.getByRole("link", { name: "Annuler" })).toHaveAttribute("href", "/produits/1");
        });

        it("sends the stock re-read just before saving, then opens the detail page", async () => {
            const bodies: ProductUpdate[] = [];
            server.use(
                http.put(api("/products/:id"), async ({ request }) => {
                    bodies.push((await request.clone().json()) as ProductUpdate);
                }),
            );
            const { user } = await renderEdit(1);
            await user.clear(nameInput());
            await user.type(nameInput(), "Vis inox A4 M6 × 40");
            await user.clear(thresholdInput());
            await user.type(thresholdInput(), "25");
            // A movement is recorded elsewhere while the form is open.
            db.products.find((p) => p.id === 1)!.stock = 60;

            await user.click(saveButton());

            expect(await findToast("Produit mis à jour")).toHaveTextContent("Vis inox A4 M6 × 40");
            expect(bodies).toEqual([{ id: 1, name: "Vis inox A4 M6 × 40", price: 12.9, lowStockThreshold: 25, categoryId: 1, stock: 60 }]);
            expect(db.products.find((p) => p.id === 1)).toEqual({ id: 1, name: "Vis inox A4 M6 × 40", price: 12.9, stock: 60, lowStockThreshold: 25, categoryId: 1 });
            expect(await screen.findByRole("heading", { level: 1, name: "Vis inox A4 M6 × 40" })).toBeInTheDocument();
            expect(window.location.pathname).toBe("/produits/1");
        });

        it("requires a category for a product that has none", async () => {
            const { user } = await renderEdit(10);
            expect(categorySelect()).toHaveValue("");

            await user.click(saveButton());

            expect(summaryMessages()).toEqual(["Choisissez une catégorie."]);
        });

        it("rejects a stored name longer than 100 characters", async () => {
            db.products.find((p) => p.id === 2)!.name = "x".repeat(101);
            const { user } = await renderEdit(2);

            await user.click(saveButton());

            expect(summaryMessages()).toEqual(["Le nom ne doit pas dépasser 100 caractères."]);
            expect(nameInput()).toHaveAttribute("aria-invalid", "true");
        });

        it("shows a conflict banner on 409, and « Recharger » shows the latest version", async () => {
            server.use(http.put(api("/products/:id"), () => HttpResponse.json({ title: "Conflict", status: 409 }, { status: 409 }), { once: true }));
            const { user } = await renderEdit(1);
            await user.clear(nameInput());
            await user.type(nameInput(), "Mon nom");

            await user.click(saveButton());

            const banner = await screen.findByRole("alert");
            expect(banner).toHaveTextContent("Conflit de modification (409). Ce produit a été modifié par une autre requête.");
            expect(window.location.pathname).toBe("/produits/1/modifier");

            // The other request changed the product.
            Object.assign(db.products.find((p) => p.id === 1)!, { name: "Vis inox A2 M6 × 45", price: 13.5 });
            await user.click(within(banner).getByRole("button", { name: "Recharger" }));

            await waitFor(() => expect(nameInput()).toHaveValue("Vis inox A2 M6 × 45"));
            expect(priceInput()).toHaveValue(13.5);
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
            expect(screen.getByText("Vis inox A2 M6 × 45", { selector: "p" })).toBeInTheDocument();

            await user.click(saveButton());
            expect(await findToast("Produit mis à jour")).toHaveTextContent("Vis inox A2 M6 × 45");
        });

        it("returns to the list with a toast when the product was deleted meanwhile", async () => {
            const { user } = await renderEdit(2);
            db.products.splice(db.products.findIndex((p) => p.id === 2), 1);

            await user.click(saveButton());

            expect(await findToast("Produit introuvable")).toHaveTextContent("Ce produit a été supprimé entre-temps (404).");
            await waitFor(() => expect(window.location.pathname).toBe("/produits"));
            expect(await screen.findByRole("heading", { level: 1, name: "Produits" })).toBeInTheDocument();
        });

        it("shows a toast when the save fails", async () => {
            server.use(http.put(api("/products/:id"), () => HttpResponse.json({}, { status: 500 })));
            const { user } = await renderEdit(1);

            await user.click(saveButton());

            expect(await findToast("Enregistrement impossible")).toHaveTextContent("Une erreur interne est survenue côté serveur.");
            expect(window.location.pathname).toBe("/produits/1/modifier");
        });

        it.each(["999", "abc"])("renders the 404 page for /produits/%s/modifier", async (id) => {
            renderApp(`/produits/${id}/modifier`);

            expect(await screen.findByRole("heading", { name: "Page introuvable" })).toBeInTheDocument();
            expect(screen.queryByRole("heading", { level: 1, name: "Modifier le produit" })).not.toBeInTheDocument();
        });

        it("titles the 404 page of an invalid id « Page introuvable »", async () => {
            renderApp("/produits/abc/modifier");

            await screen.findByRole("heading", { name: "Page introuvable" });
            await waitFor(() => expect(document.title).toBe("Page introuvable — Inventory"));
        });

        it("shows an error with a retry when the product cannot be loaded", async () => {
            server.use(http.get(api("/products/:id"), () => HttpResponse.json({}, { status: 500 }), { once: true }));
            const { user } = renderApp("/produits/1/modifier");

            const banner = await screen.findByRole("alert");
            expect(banner).toHaveTextContent("Impossible de charger le produit. Une erreur interne est survenue côté serveur.");
            expect(screen.getByRole("heading", { level: 1, name: "Modifier le produit" })).toBeInTheDocument();

            await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

            expect(await screen.findByDisplayValue("Vis inox A2 M6 × 40")).toBeInTheDocument();
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });
    });

    it.each(["/produits/nouveau", "/produits/1/modifier"])("shows the 403 page to a User on %s", async (path) => {
        renderApp(path, { as: "User" });

        expect(await screen.findByRole("heading", { name: "Accès refusé" })).toBeInTheDocument();
        expect(screen.getByText("403")).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: /^Nom du produit/ })).not.toBeInTheDocument();
    });
});
