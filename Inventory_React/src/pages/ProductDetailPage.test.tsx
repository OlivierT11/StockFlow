import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { fmtMoney } from "../lib/format";
import { ADMIN, USER, db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp, type As } from "../test/render";
import { server } from "../test/server";

/** fmtMoney() as Testing Library reads it: its no-break spaces normalized to plain spaces. */
const money = (n: number) => fmtMoney(n).replace(/\s/g, " ");

async function renderDetail(id: number | string, { as = "Admin", search = "" }: { as?: As; search?: string } = {}) {
    const view = renderApp(`/produits/${id}${search}`, { as });
    const product = db.products.find((p) => p.id === Number(id));
    if (product) await screen.findByRole("heading", { level: 1, name: product.name });
    return view;
}

const infoCard = () => screen.getByRole("region", { name: "Informations" });
const historyCard = () => screen.getByRole("region", { name: "Historique des mouvements" });

/** The <dl> of the info card as { term: definition }. */
function details() {
    const card = infoCard();
    const terms = within(card).getAllByRole("term");
    const definitions = within(card).getAllByRole("definition");
    const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
    return Object.fromEntries(terms.map((t, i) => [text(t), text(definitions[i])]));
}

/** Cells of the history rows, as text. */
async function historyRows() {
    const table = await within(historyCard()).findByRole("table");
    return within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));
}

/** Adds `count` movements of product 1 at fixed dates, one hour apart (UTC, without zone designator). */
function addMovements(count: number) {
    for (let i = 0; i < count; i++) {
        db.movements.push({
            id: db.nextId(db.movements),
            productId: 1,
            warehouseId: 3,
            type: "In",
            quantity: i + 1,
            delta: i + 1,
            date: `2026-03-15T${String(i).padStart(2, "0")}:30:00`,
            userId: USER.id,
            notes: null,
        });
    }
}

function capturePageQueries() {
    const queries: URLSearchParams[] = [];
    server.use(
        http.get(api("/products/:id/movements"), ({ request }) => {
            queries.push(new URL(request.url).searchParams);
        }),
    );
    return queries;
}

describe("ProductDetailPage", () => {
    describe("information card", () => {
        it("shows the stock, its value, the price, the threshold and the category", async () => {
            await renderDetail(1);

            await waitFor(() => expect(document.title).toBe("Détail du produit — Inventory"));
            expect(screen.getByText("Visserie · Réf. 0001")).toBeInTheDocument();
            const crumbs = screen.getByRole("navigation", { name: "Fil d’Ariane" });
            expect(within(crumbs).getByRole("link", { name: "Produits" })).toHaveAttribute("href", "/produits");
            expect(within(crumbs).getByText("Vis inox A2 M6 × 40")).toBeInTheDocument();

            const card = infoCard();
            expect(within(card).getByText("Normal")).toBeInTheDocument();
            expect(within(card).getByText("48")).toBeInTheDocument();
            expect(within(card).getByText("Unités en stock")).toBeInTheDocument();
            expect(within(card).getByText(money(12.9 * 48))).toBeInTheDocument();
            expect(within(card).getByText("Valeur du stock")).toBeInTheDocument();
            expect(details()).toEqual({
                "Prix unitaire": money(12.9),
                "Seuil de stock bas": "20 Alerte dès que le stock est inférieur ou égal",
                Catégorie: "Visserie",
            });
            expect(screen.queryByText(/Lecture seule/)).not.toBeInTheDocument();
        });

        it.each([
            { id: 2, badge: "Sous seuil", stock: "6", value: 9.4 * 6 },
            { id: 3, badge: "Rupture", stock: "0", value: 0 },
        ])("flags product $id as « $badge »", async ({ id, badge, stock, value }) => {
            await renderDetail(id);

            const card = infoCard();
            expect(within(card).getByText(badge)).toBeInTheDocument();
            expect(within(card).getByText(stock)).toBeInTheDocument();
            expect(within(card).getByText(money(value))).toBeInTheDocument();
        });

        it("shows a product without category", async () => {
            await renderDetail(10);

            expect(screen.getByText("Sans catégorie · Réf. 0010")).toBeInTheDocument();
            expect(details()["Catégorie"]).toBe("—");
        });
    });

    describe("movement history", () => {
        it("lists the movements of the product, newest first", async () => {
            await renderDetail(1);

            expect(await within(historyCard()).findByText("2 mouvements")).toBeInTheDocument();
            const rows = await historyRows();
            expect(rows.map((cells) => cells.slice(1))).toEqual([
                ["Entrée", "+20", "Entrepôt Nord", "Vous", "Réception fournisseur"],
                ["Ajustement", "−3", "Entrepôt Sud", "Vous", "Inventaire tournant"],
            ]);
            expect(rows[0][0]).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
            expect(within(historyCard()).getByText("1–2 sur 2 mouvements")).toBeInTheDocument();
        });

        it("shows the dates in local time and a dash for missing notes", async () => {
            addMovements(1);
            await renderDetail(1);

            const rows = await historyRows();
            // 2026-03-15 00:30 UTC is 01:30 in Paris (UTC+1 in March, before the switch to summer time).
            expect(rows[2]).toEqual(["15/03/2026 01:30", "Entrée", "+1", "Entrepôt Ouest", `Utilisateur n° ${USER.id}`, "—"]);
        });

        it("pages the history 8 movements at a time through the page param", async () => {
            const queries = capturePageQueries();
            addMovements(10);
            const { user } = await renderDetail(1);
            const length = window.history.length;

            expect(await within(historyCard()).findByText("1–8 sur 12 mouvements")).toBeInTheDocument();
            expect(await historyRows()).toHaveLength(8);
            expect(Object.fromEntries(queries[queries.length - 1])).toEqual({ askedPage: "1", pageSize: "8" });

            await user.click(within(historyCard()).getByRole("button", { name: "Page 2" }));

            expect(await within(historyCard()).findByText("9–12 sur 12 mouvements")).toBeInTheDocument();
            expect(window.location.search).toBe("?page=2");
            expect(window.history.length).toBe(length);
            expect(Object.fromEntries(queries[queries.length - 1])).toEqual({ askedPage: "2", pageSize: "8" });
            const rows = await historyRows();
            expect(rows).toHaveLength(4);
            // Oldest last: the two seeded movements are the most recent ones, then the added ones from 09:30 down.
            expect(rows[3][0]).toBe("15/03/2026 01:30");
        });

        it("opens the history page given in the URL", async () => {
            addMovements(10);
            await renderDetail(1, { search: "?page=2" });

            expect(await within(historyCard()).findByText("9–12 sur 12 mouvements")).toBeInTheDocument();
            expect(within(historyCard()).getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
        });

        it("goes back to the last history page when the page in the URL is past the end", async () => {
            await renderDetail(1, { search: "?page=3" });

            expect(await within(historyCard()).findByText("1–2 sur 2 mouvements")).toBeInTheDocument();
        });

        it.each([
            { as: "Admin" as const, expected: `Utilisateur n° ${USER.id}` },
            { as: "User" as const, expected: "Vous" },
        ])("names the author of a User movement « $expected » for the $as", async ({ as, expected }) => {
            await renderDetail(4, { as });

            expect(await within(historyCard()).findByText("1 mouvement")).toBeInTheDocument();
            const [row] = await historyRows();
            expect(row[4]).toBe(expected);
            expect(row.slice(1, 4)).toEqual(["Sortie", "−10", "Entrepôt Sud"]);
        });

        it("names an Admin movement by number for a User", async () => {
            await renderDetail(5, { as: "User" });

            const [row] = await historyRows();
            expect(row[4]).toBe(`Utilisateur n° ${ADMIN.id}`);
        });

        it("keeps the previous history page on screen while the next one loads", async () => {
            let release = () => {};
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            server.use(
                http.get(api("/products/:id/movements"), async ({ request }) => {
                    if (new URL(request.url).searchParams.get("askedPage") === "2") await gate;
                }),
            );
            addMovements(10);
            const { user } = await renderDetail(1);
            await historyRows();

            await user.click(within(historyCard()).getByRole("button", { name: "Page 2" }));

            await waitFor(() => expect(window.location.search).toBe("?page=2"));
            const table = within(historyCard()).getByRole("table");
            expect(table.parentElement).toHaveClass("is-refreshing");
            expect(await historyRows()).toHaveLength(8);
            release();
            await waitFor(() => expect(within(historyCard()).getByText("9–12 sur 12 mouvements")).toBeInTheDocument());
            expect(table.parentElement).not.toHaveClass("is-refreshing");
        });

        it("shows a placeholder in the history card until the movements arrive", async () => {
            let release = () => {};
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            server.use(
                http.get(api("/products/:id/movements"), async () => {
                    await gate;
                }),
            );
            await renderDetail(1);

            expect(within(historyCard()).getByLabelText("Chargement")).toHaveAttribute("aria-busy", "true");
            expect(within(historyCard()).queryByRole("table")).not.toBeInTheDocument();
            release();
            expect(await historyRows()).toHaveLength(2);
            expect(within(historyCard()).queryByLabelText("Chargement")).not.toBeInTheDocument();
        });

        it("shows an empty history with a shortcut to record a movement", async () => {
            const { user } = await renderDetail(2);

            const card = historyCard();
            expect(await within(card).findByRole("heading", { name: "Aucun mouvement enregistré" })).toBeInTheDocument();
            expect(within(card).getByText("Les entrées, sorties et ajustements de ce produit apparaîtront ici.")).toBeInTheDocument();
            expect(within(card).getByText("0 mouvement")).toBeInTheDocument();
            expect(within(card).queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();

            await user.click(within(card).getByRole("button", { name: "Enregistrer un mouvement" }));

            const drawer = await screen.findByRole("dialog", { name: "Nouveau mouvement de stock" });
            expect(within(drawer).getByText("Vis à bois 4 × 50")).toBeInTheDocument();
            expect(within(drawer).getByText("6 en stock")).toBeInTheDocument();
        });

        it("shows an error with a retry when the history cannot be loaded", async () => {
            server.use(http.get(api("/products/:id/movements"), () => HttpResponse.json({}, { status: 500 }), { once: true }));
            const { user } = await renderDetail(1);

            const banner = await within(historyCard()).findByRole("alert");
            expect(banner).toHaveTextContent("Chargement impossible.");
            expect(banner).toHaveTextContent("Une erreur interne est survenue côté serveur.");
            expect(infoCard()).toBeInTheDocument();

            await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

            expect(await historyRows()).toHaveLength(2);
            expect(within(historyCard()).queryByRole("alert")).not.toBeInTheDocument();
        });
    });

    describe("actions", () => {
        it("gives an Admin the movement, edit and delete actions", async () => {
            const { user } = await renderDetail(1);

            expect(screen.getByRole("link", { name: "Modifier" })).toHaveAttribute("href", "/produits/1/modifier");

            await user.click(screen.getByRole("button", { name: "Nouveau mouvement" }));
            const drawer = await screen.findByRole("dialog", { name: "Nouveau mouvement de stock" });
            expect(within(drawer).getByText("Vis inox A2 M6 × 40")).toBeInTheDocument();
            await user.click(within(drawer).getByRole("button", { name: "Fermer le panneau" }));
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

            await user.click(screen.getByRole("button", { name: "Supprimer" }));
            expect(await screen.findByRole("dialog", { name: "Suppression impossible" })).toBeInTheDocument();
        });

        it("shows a User a read-only page", async () => {
            await renderDetail(2, { as: "User" });

            expect(screen.getByText(/Lecture seule : le rôle User ne peut pas modifier les produits\./)).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Nouveau mouvement" })).not.toBeInTheDocument();
            expect(screen.queryByRole("link", { name: "Modifier" })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
            expect(await within(historyCard()).findByRole("heading", { name: "Aucun mouvement enregistré" })).toBeInTheDocument();
            expect(within(historyCard()).queryByRole("button", { name: "Enregistrer un mouvement" })).not.toBeInTheDocument();
        });
    });

    describe("missing product and errors", () => {
        it.each(["999", "abc", "0"])("renders the 404 page for /produits/%s", async (id) => {
            renderApp(`/produits/${id}`);

            expect(await screen.findByRole("heading", { name: "Page introuvable" })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Liste des produits" })).toHaveAttribute("href", "/produits");
        });

        it("titles the page « Page introuvable » once the product turns out not to exist", async () => {
            renderApp("/produits/999");

            await screen.findByRole("heading", { name: "Page introuvable" });
            await waitFor(() => expect(document.title).toBe("Page introuvable — Inventory"));
        });

        it("titles the 404 page of an invalid id « Page introuvable »", async () => {
            renderApp("/produits/abc");

            await screen.findByRole("heading", { name: "Page introuvable" });
            await waitFor(() => expect(document.title).toBe("Page introuvable — Inventory"));
        });

        it("shows an error with a retry when the product cannot be loaded", async () => {
            server.use(http.get(api("/products/:id"), () => HttpResponse.error(), { once: true }));
            const { user } = renderApp("/produits/1");

            const banner = await screen.findByRole("alert");
            expect(banner).toHaveTextContent("Impossible de charger le produit.");
            expect(banner).toHaveTextContent("Impossible de joindre le serveur.");

            await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

            expect(await screen.findByRole("heading", { level: 1, name: "Vis inox A2 M6 × 40" })).toBeInTheDocument();
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });
    });
});
