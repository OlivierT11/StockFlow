import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { fmtMoney } from "../lib/format";
import { db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp, type As } from "../test/render";
import { server } from "../test/server";

/** Records the query of every /products/paged request, then lets the fake API answer it. */
function capturePaged() {
    const queries: URLSearchParams[] = [];
    server.use(
        http.get(api("/products/paged"), ({ request }) => {
            queries.push(new URL(request.url).searchParams);
        }),
    );
    return queries;
}

/** fmtMoney() as Testing Library reads it: its no-break spaces normalized to plain spaces. */
const money = (n: number) => fmtMoney(n).replace(/\s/g, " ");

const urlParams = () => new URLSearchParams(window.location.search);

/** Waits with real timers, inside act so that late renders are flushed. */
const settle = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

/** Product names of the table rows, in display order. */
function rowNames() {
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    return rows.map((row) => within(row).getAllByRole("link")[0].textContent);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rowOf = (name: string) => screen.getByRole("row", { name: new RegExp(`^${escapeRe(name)}`) });

async function renderProducts(path = "/produits", as: As = "Admin") {
    const view = renderApp(path, { as });
    await screen.findByRole("heading", { level: 1, name: "Produits" });
    return view;
}

/** The category options arrive with their own request. */
const categoriesLoaded = () => screen.findByRole("option", { name: "Outillage" });

const searchBox = () => screen.getByRole("searchbox", { name: "Recherche" });
const categorySelect = () => screen.getByRole("combobox", { name: "Catégorie" });
const minPrice = () => screen.getByRole("spinbutton", { name: "Prix min (€)" });
const maxPrice = () => screen.getByRole("spinbutton", { name: "Prix max (€)" });
const lowStock = () => screen.getByRole("checkbox", { name: "Stock bas uniquement" });
const sizeSelect = () => screen.getByRole("combobox", { name: "Éléments par page" });
const sortOf = (label: string) => screen.getByRole("columnheader", { name: label }).getAttribute("aria-sort");
const lastQuery = (queries: URLSearchParams[]) => Object.fromEntries(queries[queries.length - 1]);

describe("ProductsPage", () => {
    it("lists the first 10 products by name with their category, price and stock state", async () => {
        await renderProducts();

        expect(await screen.findByText("12 produits référencés · 6 à surveiller")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Produits — Inventory"));
        expect(rowNames()).toHaveLength(10);
        expect(rowNames()[0]).toBe("Boulon hexagonal M10");
        expect(screen.getByText("1–10 sur 12 produits")).toBeInTheDocument();

        const out = rowOf("Boulon hexagonal M10");
        expect(within(out).getByText("Réf. 0003")).toBeInTheDocument();
        expect(within(out).getByText("Visserie")).toBeInTheDocument();
        expect(within(out).getByText(money(7.85))).toBeInTheDocument();
        expect(within(out).getByText("Rupture")).toBeInTheDocument();
        expect(within(rowOf("Colle PU rapide 310 ml")).getByText("Sous seuil")).toBeInTheDocument();
        expect(within(rowOf("Colle PU rapide 310 ml")).getByText("—")).toBeInTheDocument();
        const ok = rowOf("Écrou frein M8");
        expect(within(ok).getByText("83")).toBeInTheDocument();
        expect(within(ok).queryByText(/Rupture|Sous seuil|Normal/)).not.toBeInTheDocument();
        expect(within(ok).getByRole("link", { name: "Voir Écrou frein M8" })).toHaveAttribute("href", "/produits/4");
    });

    it("omits the counters from the lede while they are unavailable", async () => {
        server.use(http.get(api("/dashboard"), () => HttpResponse.json({}, { status: 500 })));
        await renderProducts();

        expect(screen.queryByText(/produits référencés/)).not.toBeInTheDocument();
    });

    describe("URL state", () => {
        it("reads the filters, the sort, the page and the size from the URL", async () => {
            const queries = capturePaged();
            await renderProducts("/produits?search=vis&cat=1&min=5&max=20&low=1&sort=price&dir=desc&page=1&size=25");
            await categoriesLoaded();

            expect(lastQuery(queries)).toEqual({
                askedPage: "1",
                pageSize: "25",
                name: "vis",
                categoryId: "1",
                minPrice: "5",
                maxPrice: "20",
                lowStockOnly: "true",
                sortBy: "price",
                sortDirection: "desc",
            });
            expect(rowNames()).toEqual(["Vis à bois 4 × 50"]);
            expect(searchBox()).toHaveValue("vis");
            expect(categorySelect()).toHaveValue("1");
            expect(minPrice()).toHaveValue(5);
            expect(maxPrice()).toHaveValue(20);
            expect(lowStock()).toBeChecked();
            expect(sortOf("Prix")).toBe("descending");
            expect(sortOf("Nom")).toBe("none");
            expect(sizeSelect()).toHaveValue("25");
            expect(screen.getByText("1 résultat")).toBeInTheDocument();
        });

        it("falls back to the default sort, page and size for invalid values", async () => {
            const queries = capturePaged();
            await renderProducts("/produits?sort=bogus&dir=up&page=abc&size=7");

            expect(lastQuery(queries)).toEqual({ askedPage: "1", pageSize: "10", sortBy: "name", sortDirection: "asc" });
            expect(sortOf("Nom")).toBe("ascending");
            expect(sizeSelect()).toHaveValue("10");
            expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
        });

        it("writes every change to the URL with replace and goes back to page 1 on a new filter", async () => {
            const { user } = await renderProducts("/produits?page=2");
            await categoriesLoaded();
            const length = window.history.length;

            await user.selectOptions(categorySelect(), "Visserie");
            await waitFor(() => expect(urlParams().get("cat")).toBe("1"));
            expect(urlParams().has("page")).toBe(false);

            await user.click(lowStock());
            await waitFor(() => expect(urlParams().get("low")).toBe("1"));

            await user.click(screen.getByRole("button", { name: "Stock" }));
            await waitFor(() => expect(urlParams().get("sort")).toBe("stock"));

            await user.selectOptions(sizeSelect(), "50");
            await waitFor(() => expect(urlParams().get("size")).toBe("50"));

            expect(Object.fromEntries(urlParams())).toEqual({ cat: "1", low: "1", sort: "stock", dir: "asc", size: "50" });
            expect(window.history.length).toBe(length);
            expect(await screen.findByText("2 résultats")).toBeInTheDocument();
        });

        it("follows a URL change made elsewhere, such as the navigation link", async () => {
            const { user } = await renderProducts("/produits?search=vis&cat=2");
            await categoriesLoaded();
            expect(searchBox()).toHaveValue("vis");
            expect(categorySelect()).toHaveValue("2");

            await user.click(screen.getByRole("link", { name: /^Produits/ }));

            await waitFor(() => expect(searchBox()).toHaveValue(""));
            expect(categorySelect()).toHaveValue("");
            expect(window.location.search).toBe("");
            expect(await screen.findByText("1–10 sur 12 produits")).toBeInTheDocument();
        });
    });

    describe("search", () => {
        it("applies the search 300 ms after the last keystroke", async () => {
            const queries = capturePaged();
            const { user } = await renderProducts();

            await user.type(searchBox(), "vis");
            expect(urlParams().has("search")).toBe(false);

            await waitFor(() => expect(urlParams().get("search")).toBe("vis"));
            expect(await screen.findByText("3 résultats")).toBeInTheDocument();
            expect(rowNames()).toEqual(["Perceuse-visseuse 18 V", "Vis à bois 4 × 50", "Vis inox A2 M6 × 40"]);
            expect(screen.getByText("Recherche : « vis »")).toBeInTheDocument();
            // One request for the whole word, none for "v" or "vi".
            expect(queries.map((q) => q.get("name")).filter(Boolean)).toEqual(["vis"]);
        });

        it("keeps the typed trailing space while the trimmed search is applied", async () => {
            const { user } = await renderProducts();

            await user.type(searchBox(), "vis ");

            await waitFor(() => expect(urlParams().get("search")).toBe("vis"));
            expect(await screen.findByText("3 résultats")).toBeInTheDocument();
            expect(searchBox()).toHaveValue("vis ");
        });

        it("warns about accented characters and sends no request with them", async () => {
            const queries = capturePaged();
            const { user } = await renderProducts();

            await user.type(searchBox(), "Écrou");

            expect(screen.getByText("Recherche limitée aux lettres sans accents, aux chiffres et aux espaces.")).toBeInTheDocument();
            expect(searchBox()).toHaveAttribute("aria-invalid", "true");
            expect(searchBox()).toHaveAccessibleDescription("Recherche limitée aux lettres sans accents, aux chiffres et aux espaces.");
            await settle(400);
            expect(urlParams().has("search")).toBe(false);
            expect(queries.every((q) => !q.has("name"))).toBe(true);
            expect(rowNames()).toHaveLength(10);

            await user.clear(searchBox());
            await user.type(searchBox(), "crou");

            expect(screen.queryByText(/Recherche limitée/)).not.toBeInTheDocument();
            expect(searchBox()).not.toHaveAttribute("aria-invalid");
            await waitFor(() => expect(urlParams().get("search")).toBe("crou"));
            expect(await screen.findByText("1 résultat")).toBeInTheDocument();
            expect(rowNames()).toEqual(["Écrou frein M8"]);
            expect(queries.every((q) => /^[a-zA-Z0-9 ]*$/.test(q.get("name") ?? ""))).toBe(true);
        });

        it("clears a search typed just before « Effacer les filtres » is clicked", async () => {
            const { user } = await renderProducts("/produits?low=1");
            await screen.findByText("6 résultats");

            await user.type(searchBox(), "vis");
            await user.click(screen.getByRole("button", { name: "Effacer les filtres" }));
            await settle(400);

            expect(window.location.search).toBe("");
            expect(searchBox()).toHaveValue("");
        });
    });

    describe("filters", () => {
        it("filters by category", async () => {
            const queries = capturePaged();
            const { user } = await renderProducts();
            await categoriesLoaded();

            await user.selectOptions(categorySelect(), "Outillage");

            expect(await screen.findByText("5 résultats")).toBeInTheDocument();
            expect(urlParams().get("cat")).toBe("2");
            expect(lastQuery(queries).categoryId).toBe("2");
            expect(rowNames()).toEqual([
                "Mètre ruban 5 m",
                "Meuleuse d’angle 125 mm",
                "Niveau à bulle 60 cm",
                "Perceuse-visseuse 18 V",
                "Scie sauteuse 650 W",
            ]);
            expect(screen.getByText("Catégorie : Outillage")).toBeInTheDocument();
        });

        it("applies a price bound when its field loses focus", async () => {
            const queries = capturePaged();
            const { user } = await renderProducts();

            await user.type(minPrice(), "10");
            expect(urlParams().has("min")).toBe(false);
            await user.tab();
            await waitFor(() => expect(urlParams().get("min")).toBe("10"));
            expect(await screen.findByText(`Prix : ${money(10)} – ∞`)).toBeInTheDocument();

            await user.type(maxPrice(), "20");
            await user.tab();

            expect(await screen.findByText(`Prix : ${money(10)} – ${money(20)}`)).toBeInTheDocument();
            expect(await screen.findByText("3 résultats")).toBeInTheDocument();
            expect(rowNames()).toEqual(["Gants nitrile taille L", "Niveau à bulle 60 cm", "Vis inox A2 M6 × 40"]);
            expect(lastQuery(queries)).toMatchObject({ minPrice: "10", maxPrice: "20" });

            // Leaving the field again without a change sends nothing new.
            const count = queries.length;
            await user.click(maxPrice());
            await user.tab();
            expect(queries).toHaveLength(count);
        });

        it("labels a price range without a minimum", async () => {
            await renderProducts("/produits?max=20");

            expect(screen.getByText(`Prix : 0 € – ${money(20)}`)).toBeInTheDocument();
            expect(screen.getByText("9 résultats")).toBeInTheDocument();
        });

        it("does not apply a price outside 0 – 1 000 000 €", async () => {
            const queries = capturePaged();
            const { user } = await renderProducts();
            const count = queries.length;

            await user.type(minPrice(), "-5");
            await user.tab();
            await user.type(maxPrice(), "2000000");
            await user.tab();

            for (const field of [minPrice(), maxPrice()]) {
                expect(field).toHaveAttribute("aria-invalid", "true");
                expect(field).toHaveAttribute("title", "Entre 0 et 1 000 000 €.");
            }
            await settle(50);
            expect(window.location.search).toBe("");
            expect(queries).toHaveLength(count);

            await user.clear(minPrice());
            await user.type(minPrice(), "5");
            expect(minPrice()).not.toHaveAttribute("aria-invalid");
            expect(minPrice()).not.toHaveAttribute("title");
        });

        it("applies a typed price when Enter is pressed", async () => {
            const { user } = await renderProducts();

            await user.type(minPrice(), "10{Enter}");

            await waitFor(() => expect(urlParams().get("min")).toBe("10"));
        });

        it("applies the valid filters on Enter and keeps the applied value of an invalid one", async () => {
            const { user } = await renderProducts("/produits?search=vis&min=1&max=50");

            await user.clear(minPrice());
            await user.type(minPrice(), "-1");
            await user.clear(maxPrice());
            await user.type(maxPrice(), "-5");
            await user.clear(searchBox());
            await user.type(searchBox(), "écrou{Enter}");
            expect(urlParams().get("search")).toBe("vis");

            await user.clear(searchBox());
            await user.type(searchBox(), "crou{Enter}");

            // Right away, not 300 ms later through the debounced search.
            expect(urlParams().get("search")).toBe("crou");
            expect(urlParams().get("min")).toBe("1");
            expect(urlParams().get("max")).toBe("50");
        });

        it("shows only the low-stock products", async () => {
            const queries = capturePaged();
            const { user } = await renderProducts();

            await user.click(lowStock());

            expect(await screen.findByText("6 résultats")).toBeInTheDocument();
            expect(urlParams().get("low")).toBe("1");
            expect(lastQuery(queries).lowStockOnly).toBe("true");
            expect(rowNames()).toEqual([
                "Boulon hexagonal M10",
                "Colle PU rapide 310 ml",
                "Gants nitrile taille L",
                "Niveau à bulle 60 cm",
                "Scie sauteuse 650 W",
                "Vis à bois 4 × 50",
            ]);

            await user.click(lowStock());
            await waitFor(() => expect(urlParams().has("low")).toBe(false));
            expect(await screen.findByText("1–10 sur 12 produits")).toBeInTheDocument();
        });

        it("removes a single filter with its chip", async () => {
            const { user } = await renderProducts("/produits?search=vis&cat=1&min=5&max=20&low=1");
            await categoriesLoaded();
            expect(screen.getByText("Recherche : « vis »")).toBeInTheDocument();
            expect(screen.getByText(`Prix : ${money(5)} – ${money(20)}`)).toBeInTheDocument();

            await user.click(screen.getByRole("button", { name: "Retirer le filtre Catégorie : Visserie" }));
            await waitFor(() => expect(urlParams().has("cat")).toBe(false));
            expect(categorySelect()).toHaveValue("");

            await user.click(screen.getByRole("button", { name: `Retirer le filtre Prix : ${fmtMoney(5)} – ${fmtMoney(20)}` }));
            await waitFor(() => expect(urlParams().has("min")).toBe(false));
            expect(urlParams().has("max")).toBe(false);
            expect(minPrice()).toHaveValue(null);
            expect(maxPrice()).toHaveValue(null);

            await user.click(screen.getByRole("button", { name: "Retirer le filtre Stock bas uniquement" }));
            await waitFor(() => expect(urlParams().has("low")).toBe(false));
            expect(lowStock()).not.toBeChecked();

            await user.click(screen.getByRole("button", { name: "Retirer le filtre Recherche : « vis »" }));
            await waitFor(() => expect(window.location.search).toBe(""));
            expect(searchBox()).toHaveValue("");
            expect(screen.queryByRole("button", { name: "Effacer les filtres" })).not.toBeInTheDocument();
            expect(await screen.findByText("1–10 sur 12 produits")).toBeInTheDocument();
        });

        it("clears every filter at once", async () => {
            const { user } = await renderProducts("/produits?search=vis&cat=1&min=5&max=20&low=1&sort=price&size=25");
            await categoriesLoaded();

            await user.click(screen.getByRole("button", { name: "Effacer les filtres" }));

            await waitFor(() => expect(Object.fromEntries(urlParams())).toEqual({ sort: "price", size: "25" }));
            expect(searchBox()).toHaveValue("");
            expect(categorySelect()).toHaveValue("");
            expect(minPrice()).toHaveValue(null);
            expect(maxPrice()).toHaveValue(null);
            expect(lowStock()).not.toBeChecked();
            expect(await screen.findByText("1–12 sur 12 produits")).toBeInTheDocument();
            expect(screen.queryByText(/^Recherche :/)).not.toBeInTheDocument();
        });
    });

    describe("sorting", () => {
        it("sorts by name, price and stock and marks the sorted column", async () => {
            const queries = capturePaged();
            const { user } = await renderProducts("/produits?page=2");
            expect(sortOf("Nom")).toBe("ascending");
            expect(sortOf("Prix")).toBe("none");
            expect(sortOf("Stock")).toBe("none");

            await user.click(screen.getByRole("button", { name: "Prix" }));
            await waitFor(() => expect(sortOf("Prix")).toBe("ascending"));
            expect(urlParams().has("page")).toBe(false);
            await waitFor(() => expect(rowNames()[0]).toBe("Ruban adhésif toilé 50 mm"));
            expect(sortOf("Nom")).toBe("none");

            await user.click(screen.getByRole("button", { name: "Prix" }));
            await waitFor(() => expect(sortOf("Prix")).toBe("descending"));
            await waitFor(() => expect(rowNames()[0]).toBe("Perceuse-visseuse 18 V"));
            expect(lastQuery(queries)).toMatchObject({ sortBy: "price", sortDirection: "desc" });

            await user.click(screen.getByRole("button", { name: "Stock" }));
            await waitFor(() => expect(sortOf("Stock")).toBe("ascending"));
            await waitFor(() => expect(rowNames()[0]).toBe("Boulon hexagonal M10"));
            expect(lastQuery(queries)).toMatchObject({ sortBy: "stock", sortDirection: "asc" });

            await user.click(screen.getByRole("button", { name: "Nom" }));
            await waitFor(() => expect(sortOf("Nom")).toBe("ascending"));
            await user.click(screen.getByRole("button", { name: "Nom" }));
            await waitFor(() => expect(sortOf("Nom")).toBe("descending"));
            await waitFor(() => expect(rowNames()[0]).toBe("Vis inox A2 M6 × 40"));
            expect(Object.fromEntries(urlParams())).toEqual({ sort: "name", dir: "desc" });
        });
    });

    describe("pagination", () => {
        it("pages through the 12 products 10 at a time", async () => {
            const queries = capturePaged();
            const { user } = await renderProducts();
            const length = window.history.length;
            expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();

            await user.click(screen.getByRole("button", { name: "Page suivante" }));

            expect(await screen.findByText("11–12 sur 12 produits")).toBeInTheDocument();
            expect(urlParams().get("page")).toBe("2");
            expect(lastQuery(queries)).toMatchObject({ askedPage: "2", pageSize: "10" });
            expect(rowNames()).toEqual(["Vis à bois 4 × 50", "Vis inox A2 M6 × 40"]);
            expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
            expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();

            await user.click(screen.getByRole("button", { name: "Page 1" }));
            expect(await screen.findByText("1–10 sur 12 produits")).toBeInTheDocument();
            expect(urlParams().get("page")).toBe("1");
            expect(window.history.length).toBe(length);
        });

        it.each([10, 25, 50, 100])("shows %i products per page", async (size) => {
            const queries = capturePaged();
            const { user } = await renderProducts(size === 10 ? "/produits?size=25" : "/produits");
            expect(within(sizeSelect()).getAllByRole("option").map((o) => o.textContent)).toEqual(["10", "25", "50", "100"]);

            await user.selectOptions(sizeSelect(), String(size));

            await waitFor(() => expect(urlParams().get("size")).toBe(String(size)));
            await waitFor(() => expect(lastQuery(queries).pageSize).toBe(String(size)));
            expect(await screen.findByText(`1–${Math.min(size, 12)} sur 12 produits`)).toBeInTheDocument();
            expect(rowNames()).toHaveLength(Math.min(size, 12));
            expect(screen.queryByRole("button", { name: "Page 2" }) !== null).toBe(size === 10);
        });

        it("goes to the last page when the page in the URL is past the end", async () => {
            renderApp("/produits?page=5");

            await waitFor(() => expect(urlParams().get("page")).toBe("2"));
            expect(await screen.findByText("11–12 sur 12 produits")).toBeInTheDocument();
            // The empty page 5 stays on screen (keepPrevious) until page 2 arrives.
            await waitFor(() => expect(rowNames()).toEqual(["Vis à bois 4 × 50", "Vis inox A2 M6 × 40"]));
        });

        it("goes to the new last page after deleting the only product of the last page", async () => {
            db.products.splice(db.products.findIndex((p) => p.id === 12), 1);
            const { user } = await renderProducts("/produits?dir=desc&sort=name&page=2");
            expect(rowNames()).toEqual(["Boulon hexagonal M10"]);

            await user.click(screen.getByRole("button", { name: "Supprimer Boulon hexagonal M10" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer ce produit ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer définitivement" }));

            await waitFor(() => expect(urlParams().get("page")).toBe("1"));
            expect(await screen.findByText("1–10 sur 10 produits")).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Page 2" })).not.toBeInTheDocument();
        });

        it("keeps the current rows on screen while the next page loads", async () => {
            let release = () => {};
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            server.use(
                http.get(api("/products/paged"), async ({ request }) => {
                    if (new URL(request.url).searchParams.get("askedPage") === "2") await gate;
                }),
            );
            const { user } = await renderProducts();

            await user.click(screen.getByRole("button", { name: "Page 2" }));

            await waitFor(() => expect(urlParams().get("page")).toBe("2"));
            expect(rowNames()).toHaveLength(10);
            expect(screen.getByRole("table").parentElement).toHaveClass("is-refreshing");
            release();
            await waitFor(() => expect(rowNames()).toEqual(["Vis à bois 4 × 50", "Vis inox A2 M6 × 40"]));
            expect(screen.getByRole("table").parentElement).not.toHaveClass("is-refreshing");
        });
    });

    describe("empty and error states", () => {
        it("suggests removing the filters when nothing matches", async () => {
            const { user } = await renderProducts("/produits?search=zzz&low=1");

            expect(screen.getByRole("heading", { name: "Aucun produit ne correspond" })).toBeInTheDocument();
            expect(screen.getByText("Essayez d’élargir la recherche ou de retirer un filtre.")).toBeInTheDocument();
            expect(screen.getByText("0 résultat")).toBeInTheDocument();
            expect(screen.queryByRole("table")).not.toBeInTheDocument();
            expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();

            const clearButtons = screen.getAllByRole("button", { name: "Effacer les filtres" });
            expect(clearButtons).toHaveLength(2);
            await user.click(clearButtons[1]);

            await waitFor(() => expect(window.location.search).toBe(""));
            expect(await screen.findByText("1–10 sur 12 produits")).toBeInTheDocument();
            expect(searchBox()).toHaveValue("");
        });

        it("names an unknown category by its number", async () => {
            await renderProducts("/produits?cat=99");
            await categoriesLoaded();

            expect(screen.getByText("Catégorie : n° 99")).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "Aucun produit ne correspond" })).toBeInTheDocument();
        });

        it("invites an Admin to add the first product to an empty catalogue", async () => {
            db.products.splice(0);
            await renderProducts();

            expect(screen.getByRole("heading", { name: "Aucun produit ne correspond" })).toBeInTheDocument();
            expect(screen.getByText("Le catalogue est vide. Ajoutez un premier produit pour commencer.")).toBeInTheDocument();
            const addLinks = screen.getAllByRole("link", { name: "Ajouter un produit" });
            expect(addLinks).toHaveLength(2);
            for (const link of addLinks) expect(link).toHaveAttribute("href", "/produits/nouveau");
            expect(screen.queryByRole("button", { name: "Effacer les filtres" })).not.toBeInTheDocument();
            expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
            expect(await screen.findByText("0 produit référencé · 0 à surveiller")).toBeInTheDocument();
        });

        it("shows a User an empty catalogue without the add button", async () => {
            db.products.splice(0);
            await renderProducts("/produits", "User");

            expect(screen.getByText("Le catalogue est vide. Ajoutez un premier produit pour commencer.")).toBeInTheDocument();
            expect(screen.queryByRole("link", { name: "Ajouter un produit" })).not.toBeInTheDocument();
        });

        it("shows an error banner and retries", async () => {
            server.use(http.get(api("/products/paged"), () => HttpResponse.json({ title: "Erreur" }, { status: 500 }), { once: true }));
            const { user } = await renderProducts();

            const banner = screen.getByRole("alert");
            expect(banner).toHaveTextContent("Impossible de charger les produits.");
            expect(banner).toHaveTextContent("Une erreur interne est survenue côté serveur.");
            expect(screen.queryByRole("table")).not.toBeInTheDocument();

            await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

            expect(await screen.findByText("1–10 sur 12 produits")).toBeInTheDocument();
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it("explains a network failure", async () => {
            server.use(http.get(api("/products/paged"), () => HttpResponse.error()));
            await renderProducts();

            expect(screen.getByRole("alert")).toHaveTextContent("Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
        });
    });

    describe("roles", () => {
        it("gives an Admin the add, edit and delete actions", async () => {
            const { user } = await renderProducts();

            expect(screen.getByRole("link", { name: "Ajouter un produit" })).toHaveAttribute("href", "/produits/nouveau");
            const row = rowOf("Écrou frein M8");
            expect(within(row).getByRole("link", { name: "Modifier Écrou frein M8" })).toHaveAttribute("href", "/produits/4/modifier");

            await user.click(within(row).getByRole("button", { name: "Supprimer Écrou frein M8" }));
            expect(await screen.findByRole("dialog", { name: "Suppression impossible" })).toBeInTheDocument();
        });

        it("shows a User the view action only", async () => {
            await renderProducts("/produits", "User");

            const row = rowOf("Écrou frein M8");
            expect(within(row).getByRole("link", { name: "Voir Écrou frein M8" })).toBeInTheDocument();
            expect(within(row).queryByRole("link", { name: /Modifier/ })).not.toBeInTheDocument();
            expect(within(row).queryByRole("button", { name: /Supprimer/ })).not.toBeInTheDocument();
            expect(screen.queryByRole("link", { name: "Ajouter un produit" })).not.toBeInTheDocument();
        });
    });
});
