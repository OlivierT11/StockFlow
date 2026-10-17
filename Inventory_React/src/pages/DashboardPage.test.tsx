import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, fmtDate, startOfDay } from "../lib/format";
import { apiDate, db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp } from "../test/render";
import { server } from "../test/server";

// Wednesday 14 October 2026, 15:00 in Paris. The seeded movements are then dated
// today 14:00 (In, Nord, admin), today 13:00 (Out, Sud, user 2), yesterday 15:00 (Out),
// Sunday 11 15:00 (Adjustment) and 4 October (In, outside the 7-day window).
const NOW = new Date(2026, 9, 14, 15, 0);
const MINUS = "−";
const HOUR = 3_600_000;

/** Freezes Date only (timers stay real) and reseeds the data relative to that clock. */
function freeze(date: Date) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date);
    db.reset();
}

beforeEach(() => freeze(NOW));
afterEach(() => vi.useRealTimers());

const productName = (id: number) => db.products.find((p) => p.id === id)!.name;

/** A pending response that the test releases, to observe the loading states. */
function gate() {
    let open!: () => void;
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { opened, open };
}

async function renderDashboard(as: "Admin" | "User" = "Admin") {
    const view = renderApp("/", { as });
    await screen.findByRole("heading", { level: 1, name: "Tableau de bord" });
    return view;
}

const tiles = () => within(screen.getByRole("region", { name: "Indicateurs clés" }));
const productsTile = () => tiles().getByRole("link", { name: /^Produits référencés/ });
const lowTile = () => tiles().getByRole("link", { name: /^Produits sous seuil/ });
const movesTile = () => tiles().getByRole("link", { name: /^Mouvements du jour/ });
const cellTexts = (table: HTMLElement) =>
    within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));

describe("DashboardPage", () => {
    it("shows a skeleton until the dashboard is loaded", async () => {
        const pending = gate();
        server.use(
            http.get(api("/dashboard"), async () => {
                await pending.opened;
            }),
        );
        renderApp("/");

        expect(await screen.findByLabelText("Chargement du tableau de bord")).toHaveAttribute("aria-busy", "true");
        pending.open();
        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Chargement du tableau de bord")).not.toBeInTheDocument();
    });

    it("greets the user by first name with today's date", async () => {
        await renderDashboard();
        expect(screen.getByText("Bonjour Admin, voici l’état du stock ce mercredi 14 octobre.")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Tableau de bord — Inventory"));
    });

    it("says good evening from 18:00", async () => {
        freeze(new Date(2026, 9, 14, 19, 30));
        await renderDashboard("User");
        expect(screen.getByText("Bonsoir Claire, voici l’état du stock ce mercredi 14 octobre.")).toBeInTheDocument();
    });

    it("computes the four key figures from the stock", async () => {
        await renderDashboard();

        expect(productsTile()).toHaveAttribute("href", "/produits");
        expect(within(productsTile()).getByText("12")).toBeInTheDocument();
        expect(await within(productsTile()).findByText("3 catégories · 3 entrepôts")).toBeInTheDocument();

        // 3 779,30 € = Σ price × stock of the 12 seeded products.
        expect(tiles().getByText("Valeur totale du stock")).toBeInTheDocument();
        expect(tiles().getByText("3 779,30 €")).toBeInTheDocument();
        expect(tiles().getByText("3 779,30 € au prix d’achat")).toBeInTheDocument();

        // Products 2, 3, 7, 9, 10 and 12 are at or below their threshold; product 3 is out of stock.
        expect(lowTile()).toHaveAttribute("href", "/produits?low=1");
        expect(lowTile()).toHaveClass("is-alert");
        expect(within(lowTile()).getByText("6")).toBeInTheDocument();
        expect(within(lowTile()).getByText("dont 1 en rupture")).toBeInTheDocument();
    });

    it("counts today's movements against yesterday's", async () => {
        await renderDashboard();

        expect(movesTile()).toHaveAttribute("href", "/mouvements?du=2026-10-14&au=2026-10-14");
        expect(await within(movesTile()).findByText("2")).toBeInTheDocument();
        const delta = within(movesTile()).getByText("1 entrée · 1 sortie · hier : 1");
        expect(delta).toHaveClass("up");
    });

    it("flags a day quieter than yesterday", async () => {
        db.movements.splice(0, 2); // drop today's two movements
        await renderDashboard();

        const delta = await within(movesTile()).findByText("0 entrée · 0 sortie · hier : 1");
        expect(delta).toHaveClass("down");
        expect(within(movesTile()).getByText("0")).toBeInTheDocument();
    });

    it("charts the In and Out movements of the last 7 days, with a table alternative", async () => {
        const queries: URLSearchParams[] = [];
        server.use(
            http.get(api("/stock/movements"), ({ request }) => {
                queries.push(new URL(request.url).searchParams);
            }),
        );
        await renderDashboard();

        const chart = await screen.findByRole("img", { name: "Entrées et sorties sur 7 jours" });
        expect(within(chart).getByLabelText("mercredi 14 octobre : 1 entrée, 1 sortie")).toBeInTheDocument();
        expect(within(chart).getByLabelText("mardi 13 octobre : 0 entrée, 1 sortie")).toBeInTheDocument();
        // The adjustment of Sunday is neither an entry nor an exit.
        expect(within(chart).getByLabelText("dimanche 11 octobre : 0 entrée, 0 sortie")).toBeInTheDocument();
        expect(within(chart).getByLabelText("jeudi 8 octobre : 0 entrée, 0 sortie")).toBeInTheDocument();
        expect(within(chart).queryByLabelText(/mercredi 7 octobre/)).not.toBeInTheDocument();

        expect(screen.getByText("Voir les valeurs en tableau")).toBeInTheDocument();
        const table = screen.getByRole("table", { name: "Entrées et sorties par jour" });
        expect(cellTexts(table)).toEqual([
            [fmtDate(addDays(NOW, -6)), "0", "0"],
            [fmtDate(addDays(NOW, -5)), "0", "0"],
            [fmtDate(addDays(NOW, -4)), "0", "0"],
            [fmtDate(addDays(NOW, -3)), "0", "0"],
            [fmtDate(addDays(NOW, -2)), "0", "0"],
            [fmtDate(addDays(NOW, -1)), "0", "1"],
            [fmtDate(NOW), "1", "1"],
        ]);

        // The week starts at local midnight six days ago, every page of 100 at once.
        expect(queries).toHaveLength(1);
        expect(queries[0].get("from")).toBe(addDays(startOfDay(NOW), -6).toISOString());
        expect(queries[0].get("pageSize")).toBe("100");
    });

    it("ignores movements dated after today", async () => {
        // Clock skew: the server may record a movement "in the future" for the browser.
        db.movements.push({ id: 6, productId: 1, warehouseId: 1, type: "In", quantity: 1, delta: 1, date: apiDate(-30 * HOUR), userId: 1, notes: null });
        await renderDashboard();

        const table = await screen.findByRole("table", { name: "Entrées et sorties par jour" });
        expect(cellTexts(table).at(-1)).toEqual([fmtDate(NOW), "1", "1"]);
        expect(within(movesTile()).getByText("1 entrée · 1 sortie · hier : 1")).toBeInTheDocument();
    });

    it("lists the five lowest stocks first", async () => {
        await renderDashboard();

        const section = within(screen.getByRole("region", { name: "Produits sous seuil" }));
        expect(section.getByRole("link", { name: "Voir tout" })).toHaveAttribute("href", "/produits?low=1");
        const items = section.getAllByRole("listitem");
        expect(items.map((li) => within(li).getByRole("link").textContent)).toEqual([3, 9, 7, 2, 12].map(productName));
        expect(within(items[0]).getByRole("link")).toHaveAttribute("href", "/produits/3");
        expect(items[0]).toHaveTextContent("Visserie · seuil 10");
        expect(items[0]).toHaveTextContent("0rupture");
        expect(items[4]).toHaveTextContent("Sans catégorie · seuil 12");
        expect(items[4]).toHaveTextContent("12en stock");
        expect(section.queryByText(productName(10))).not.toBeInTheDocument();
    });

    it("shows the latest movements, naming the current user", async () => {
        await renderDashboard();

        const section = within(screen.getByRole("region", { name: "Derniers mouvements" }));
        expect(section.getByRole("link", { name: "Journal complet" })).toHaveAttribute("href", "/mouvements");
        expect(cellTexts(section.getByRole("table"))).toEqual([
            ["14/10/2026 14:00il y a 1 h", productName(1), "Entrée", "+20", "Entrepôt Nord", "Vous"],
            ["14/10/2026 13:00il y a 2 h", productName(4), "Sortie", `${MINUS}10`, "Entrepôt Sud", "Utilisateur n° 2"],
            ["13/10/2026 15:00hier", productName(5), "Sortie", `${MINUS}2`, "Entrepôt Nord", "Vous"],
            ["11/10/2026 15:00il y a 3 jours", productName(1), "Ajustement", `${MINUS}3`, "Entrepôt Sud", "Vous"],
            ["04/10/2026 15:00" + "04/10/2026", productName(8), "Entrée", "+5", "Entrepôt Nord", "Utilisateur n° 2"],
        ]);
        expect(section.getByRole("link", { name: productName(4) })).toHaveAttribute("href", "/produits/4");
    });

    it("names the other users from a User's point of view", async () => {
        await renderDashboard("User");

        const rows = cellTexts(within(screen.getByRole("region", { name: "Derniers mouvements" })).getByRole("table"));
        expect(rows.map((cells) => cells[5])).toEqual(["Utilisateur n° 1", "Vous", "Utilisateur n° 1", "Utilisateur n° 1", "Vous"]);
    });

    it("shows at most 8 recent movements", async () => {
        for (let i = 0; i < 6; i++) {
            db.movements.push({ id: 10 + i, productId: 11, warehouseId: 3, type: "In", quantity: 1, delta: 1, date: apiDate((i + 1) * 60_000), userId: 1, notes: null });
        }
        await renderDashboard();

        const table = within(screen.getByRole("region", { name: "Derniers mouvements" })).getByRole("table");
        expect(within(table).getAllByRole("row")).toHaveLength(1 + 8);
    });

    it("gives an Admin the shortcuts to create a product or a movement", async () => {
        const { user } = await renderDashboard();

        expect(screen.queryByRole("link", { name: "Journal des mouvements" })).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Nouveau mouvement" }));
        expect(await screen.findByRole("dialog", { name: "Nouveau mouvement de stock" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Annuler" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: "Produit" }));
        await waitFor(() => expect(window.location.pathname).toBe("/produits/nouveau"));
    });

    it("hides the Admin shortcuts from a User", async () => {
        await renderDashboard("User");

        expect(screen.queryByRole("button", { name: "Produit" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Nouveau mouvement" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Journal des mouvements" })).toHaveAttribute("href", "/mouvements");
    });

    it("shows the empty states when there is nothing to report", async () => {
        server.use(
            http.get(api("/dashboard"), () =>
                HttpResponse.json({
                    productCount: 0,
                    totalStockValue: 0,
                    lowStockProductCount: 0,
                    lowStockProducts: [],
                    recentMovements: [],
                    generatedAtUtc: NOW.toISOString(),
                }),
            ),
            http.get(api("/stock/movements"), () => HttpResponse.json({ movements: [], totalItems: 0, totalPages: 0 })),
            http.get(api("/categories"), () => HttpResponse.json([{ id: 1, name: "Visserie" }])),
            http.get(api("/warehouses"), () => HttpResponse.json([{ id: 1, name: "Entrepôt Nord", address: null }])),
        );
        await renderDashboard();

        expect(screen.getByRole("heading", { name: "Tous les stocks sont au-dessus du seuil" })).toBeInTheDocument();
        expect(screen.getByText("Aucun produit ne nécessite de réapprovisionnement.")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Aucun mouvement enregistré" })).toBeInTheDocument();
        expect(screen.getByText("Les entrées, sorties et ajustements apparaîtront ici.")).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Derniers mouvements" })).queryByRole("table")).not.toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Produits sous seuil" })).queryByRole("list")).not.toBeInTheDocument();

        expect(await within(productsTile()).findByText("1 catégorie · 1 entrepôt")).toBeInTheDocument();
        expect(tiles().getByText("0,00 €")).toBeInTheDocument();
        expect(lowTile()).not.toHaveClass("is-alert");
        expect(within(lowTile()).getByText("Aucune rupture")).toBeInTheDocument();
        expect(await within(movesTile()).findByText("0 entrée · 0 sortie · hier : 0")).toBeInTheDocument();
        const table = screen.getByRole("table", { name: "Entrées et sorties par jour" });
        expect(cellTexts(table).every(([, entries, exits]) => entries === "0" && exits === "0")).toBe(true);
    });

    it("waits for the counters and the chart while they load", async () => {
        const pending = gate();
        server.use(
            http.get(api("/categories"), async () => {
                await pending.opened;
            }),
            http.get(api("/stock/movements"), async () => {
                await pending.opened;
            }),
        );
        await renderDashboard();

        expect(within(productsTile()).getByText("…")).toBeInTheDocument();
        expect(within(movesTile()).getByText("…")).toBeInTheDocument();
        expect(within(movesTile()).getByText("Chargement…")).toBeInTheDocument();
        expect(screen.queryByRole("img", { name: "Entrées et sorties sur 7 jours" })).not.toBeInTheDocument();

        pending.open();
        expect(await within(productsTile()).findByText("3 catégories · 3 entrepôts")).toBeInTheDocument();
        expect(await within(movesTile()).findByText("1 entrée · 1 sortie · hier : 1")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Entrées et sorties sur 7 jours" })).toBeInTheDocument();
    });

    it("reports a chart that cannot load and retries it", async () => {
        let fail = true;
        server.use(
            http.get(api("/stock/movements"), () => {
                if (fail) return new HttpResponse(null, { status: 500 });
            }),
        );
        const { user } = await renderDashboard();

        const chartCard = within(screen.getByRole("region", { name: "Entrées et sorties sur 7 jours" }));
        expect(await chartCard.findByRole("alert")).toHaveTextContent("Chargement impossible. Une erreur interne est survenue côté serveur.");
        expect(within(movesTile()).getByText("Indisponible")).toBeInTheDocument();
        // The rest of the dashboard is still there.
        expect(within(lowTile()).getByText("6")).toBeInTheDocument();

        fail = false;
        await user.click(chartCard.getByRole("button", { name: "Réessayer" }));

        expect(await chartCard.findByRole("img", { name: "Entrées et sorties sur 7 jours" })).toBeInTheDocument();
        expect(chartCard.queryByRole("alert")).not.toBeInTheDocument();
        expect(within(movesTile()).getByText("1 entrée · 1 sortie · hier : 1")).toBeInTheDocument();
    });

    it("shows an error banner with a retry when the dashboard fails", async () => {
        let fail = true;
        server.use(
            http.get(api("/dashboard"), () => {
                if (fail) return new HttpResponse(null, { status: 500 });
            }),
        );
        const { user } = renderApp("/");

        const banner = await screen.findByRole("alert");
        expect(banner).toHaveTextContent("Tableau de bord indisponible. Une erreur interne est survenue côté serveur.");
        expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();

        fail = false;
        await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

        expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(within(lowTile()).getByText("6")).toBeInTheDocument();
    });
});
