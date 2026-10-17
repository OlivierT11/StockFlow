import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, parseDay } from "../lib/format";
import { apiDate, db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp } from "../test/render";
import { server } from "../test/server";

// Wednesday 14 October 2026, 15:00 in Paris. The seeded movements are then dated
// 14/10 14:00 (In, Nord), 14/10 13:00 (Out, Sud), 13/10 15:00 (Out, Nord),
// 11/10 15:00 (Adjustment, Sud) and 04/10 15:00 (In, Nord). Entrepôt Ouest has none.
const NOW = new Date(2026, 9, 14, 15, 0);
const MINUS = "−";

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    db.reset(); // reseed the movements relative to the frozen clock
});
afterEach(() => vi.useRealTimers());

type UserEvent = ReturnType<typeof renderApp>["user"];

const productName = (id: number) => db.products.find((p) => p.id === id)!.name;
const search = () => new URLSearchParams(window.location.search);

/** Records the query of every GET /stock/movements, then lets the default handler answer. */
function captureQueries() {
    const queries: URLSearchParams[] = [];
    server.use(
        http.get(api("/stock/movements"), ({ request }) => {
            queries.push(new URL(request.url).searchParams);
        }),
    );
    return queries;
}

/** Older movements of product 11 in Entrepôt Nord, one per minute before the oldest seeded one. */
function addMovements(count: number) {
    for (let i = 0; i < count; i++) {
        db.movements.push({ id: 100 + i, productId: 11, warehouseId: 1, type: "In", quantity: 1, delta: 1, date: apiDate(11 * 86_400_000 + i * 60_000), userId: 1, notes: null });
    }
}

/** A pending response that the test releases, to observe the refreshing state. */
function gate() {
    let open!: () => void;
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { opened, open };
}

async function renderMovements(path = "/mouvements", as: "Admin" | "User" = "Admin") {
    const view = renderApp(path, { as });
    await screen.findByRole("heading", { level: 1, name: "Mouvements de stock" });
    return view;
}

const dataRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const cellTexts = () => dataRows().map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));
const lede = (text: string) => screen.findByText(text, { selector: ".lede" });
const fromInput = () => screen.getByLabelText("Du");
const toInput = () => screen.getByLabelText("Au");
const warehouseSelect = () => screen.getByRole("combobox", { name: "Entrepôt" });

async function setDate(user: UserEvent, input: HTMLElement, value: string) {
    await user.clear(input);
    await user.type(input, value);
}

describe("MovementsPage", () => {
    it("lists every movement, newest first", async () => {
        const queries = captureQueries();
        await renderMovements();

        expect(await lede("5 mouvements enregistrés")).toBeInTheDocument();
        await waitFor(() => expect(document.title).toBe("Mouvements de stock — Inventory"));
        expect(cellTexts()).toEqual([
            ["14/10/2026 14:00", productName(1), "Entrée", "+20", "Entrepôt Nord", "Vous", "Réception fournisseur"],
            ["14/10/2026 13:00", productName(4), "Sortie", `${MINUS}10`, "Entrepôt Sud", "Utilisateur n° 2", "Chantier Villeurbanne"],
            ["13/10/2026 15:00", productName(5), "Sortie", `${MINUS}2`, "Entrepôt Nord", "Vous", "—"],
            ["11/10/2026 15:00", productName(1), "Ajustement", `${MINUS}3`, "Entrepôt Sud", "Vous", "Inventaire tournant"],
            ["04/10/2026 15:00", productName(8), "Entrée", "+5", "Entrepôt Nord", "Utilisateur n° 2", "—"],
        ]);
        expect(within(dataRows()[1]).getByRole("link", { name: productName(4) })).toHaveAttribute("href", "/produits/4");
        expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent("1–5 sur 5 mouvements");
        expect(screen.queryByRole("button", { name: "Effacer les filtres" })).not.toBeInTheDocument();

        expect(queries).toHaveLength(1);
        expect(Object.fromEntries(queries[0])).toEqual({ askedPage: "1", pageSize: "25" });
    });

    it("names the current user from a User's point of view", async () => {
        await renderMovements("/mouvements", "User");

        expect(cellTexts().map((cells) => cells[5])).toEqual(["Utilisateur n° 1", "Vous", "Utilisateur n° 1", "Utilisateur n° 1", "Vous"]);
    });

    it("reads the period, warehouse, page and size from the URL", async () => {
        const queries = captureQueries();
        await renderMovements("/mouvements?du=2026-10-11&au=2026-10-13&entrepot=2&page=1&size=10");

        expect(fromInput()).toHaveValue("2026-10-11");
        expect(toInput()).toHaveValue("2026-10-13");
        expect(toInput()).toHaveAttribute("min", "2026-10-11");
        await waitFor(() => expect(warehouseSelect()).toHaveDisplayValue("Entrepôt Sud"));
        expect(screen.getByRole("combobox", { name: "Éléments par page" })).toHaveValue("10");

        // "Du" and "Au" are local days: "Au" is included, so the API gets the next midnight as "to".
        expect(Object.fromEntries(queries[0])).toEqual({
            warehouseId: "2",
            from: parseDay("2026-10-11").toISOString(),
            to: parseDay("2026-10-14").toISOString(),
            askedPage: "1",
            pageSize: "10",
        });
        expect(queries[0].get("from")).toBe("2026-10-10T22:00:00.000Z");
        expect(await lede("1 mouvement sur la sélection")).toBeInTheDocument();
        expect(cellTexts()).toEqual([["11/10/2026 15:00", productName(1), "Ajustement", `${MINUS}3`, "Entrepôt Sud", "Vous", "Inventaire tournant"]]);
    });

    it.each([
        ["/mouvements?page=0&size=7", "1"],
        ["/mouvements?page=abc&size=1000", "1"],
        ["/mouvements?page=3", "3"],
    ])("sanitizes the page and size of %s", async (path, page) => {
        const queries = captureQueries();
        await renderMovements(path);

        expect(queries).toHaveLength(1);
        expect(queries[0].get("askedPage")).toBe(page);
        expect(queries[0].get("pageSize")).toBe("25");
    });

    it("filters by warehouse", async () => {
        const queries = captureQueries();
        const { user } = await renderMovements();
        await screen.findByRole("option", { name: "Entrepôt Sud" });
        expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(expect.arrayContaining(["Tous", "Entrepôt Nord", "Entrepôt Sud", "Entrepôt Ouest"]));

        await user.selectOptions(warehouseSelect(), "Entrepôt Sud");

        expect(search().get("entrepot")).toBe("2");
        expect(await lede("2 mouvements sur la sélection")).toBeInTheDocument();
        expect(cellTexts().map((cells) => cells[4])).toEqual(["Entrepôt Sud", "Entrepôt Sud"]);
        expect(queries.at(-1)?.get("warehouseId")).toBe("2");

        await user.selectOptions(warehouseSelect(), "Tous");

        expect(search().has("entrepot")).toBe(false);
        expect(await lede("5 mouvements enregistrés")).toBeInTheDocument();
        expect(queries.at(-1)?.has("warehouseId")).toBe(false);
    });

    it("filters by period, the end day included", async () => {
        const queries = captureQueries();
        const { user } = await renderMovements();

        await setDate(user, fromInput(), "2026-10-14");
        await setDate(user, toInput(), "2026-10-14");

        expect(search().get("du")).toBe("2026-10-14");
        expect(search().get("au")).toBe("2026-10-14");
        expect(await lede("2 mouvements sur la sélection")).toBeInTheDocument();
        expect(cellTexts().map((cells) => cells[0])).toEqual(["14/10/2026 14:00", "14/10/2026 13:00"]);
        expect(queries.at(-1)?.get("from")).toBe(parseDay("2026-10-14").toISOString());
        expect(queries.at(-1)?.get("to")).toBe(addDays(parseDay("2026-10-14"), 1).toISOString());
        expect(toInput()).toHaveAttribute("min", "2026-10-14");
    });

    it("clears every filter but keeps the page size", async () => {
        const { user } = await renderMovements("/mouvements?du=2026-10-11&au=2026-10-13&entrepot=2&size=10");
        expect(await lede("1 mouvement sur la sélection")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Effacer les filtres" }));

        expect(window.location.search).toBe("?size=10");
        expect(await lede("5 mouvements enregistrés")).toBeInTheDocument();
        expect(fromInput()).toHaveValue("");
        expect(toInput()).toHaveValue("");
        expect(toInput()).not.toHaveAttribute("min");
        expect(warehouseSelect()).toHaveDisplayValue("Tous");
        expect(screen.queryByRole("button", { name: "Effacer les filtres" })).not.toBeInTheDocument();
    });

    it("warns about an end date before the start date without querying", async () => {
        const queries = captureQueries();
        await renderMovements("/mouvements?du=2026-10-14&au=2026-10-10");

        const warning = screen.getByRole("alert");
        expect(warning).toHaveTextContent("La date de fin doit être postérieure à la date de début.");
        expect(toInput()).toHaveAttribute("aria-invalid", "true");
        expect(toInput()).toHaveAccessibleDescription("La date de fin doit être postérieure à la date de début.");
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
        expect(screen.queryByText(/mouvements? (enregistrés?|sur la sélection)/)).not.toBeInTheDocument();
        expect(queries).toHaveLength(0);
    });

    it("hides the results while the range is inverted and reloads once it is fixed", async () => {
        const queries = captureQueries();
        const { user } = await renderMovements("/mouvements?du=2026-10-11&au=2026-10-13");
        expect(await lede("2 mouvements sur la sélection")).toBeInTheDocument();
        await user.clear(fromInput());
        expect(await lede("3 mouvements sur la sélection")).toBeInTheDocument(); // up to 13/10 included
        const sent = queries.length;

        await user.type(fromInput(), "2026-10-14");

        expect(screen.getByRole("alert")).toHaveTextContent("La date de fin doit être postérieure à la date de début.");
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
        expect(queries).toHaveLength(sent);

        await setDate(user, toInput(), "2026-10-14");

        expect(await lede("2 mouvements sur la sélection")).toBeInTheDocument();
        await waitFor(() => expect(cellTexts().map((cells) => cells[0])).toEqual(["14/10/2026 14:00", "14/10/2026 13:00"]));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(toInput()).not.toHaveAttribute("aria-invalid");
        expect(queries.at(-1)?.get("from")).toBe(parseDay("2026-10-14").toISOString());
        expect(queries.at(-1)?.get("to")).toBe(parseDay("2026-10-15").toISOString());
    });

    it("pages through the movements, keeping the current page on screen while the next one loads", async () => {
        addMovements(30); // 35 in all
        const queries = captureQueries();
        const pending = gate();
        const { user } = await renderMovements();
        const pagination = () => screen.getByRole("navigation", { name: "Pagination" });
        expect(pagination()).toHaveTextContent("1–25 sur 35 mouvements");
        expect(dataRows()).toHaveLength(25);

        server.use(
            http.get(api("/stock/movements"), async () => {
                await pending.opened;
            }),
        );
        await user.click(within(pagination()).getByRole("button", { name: "Page suivante" }));

        expect(search().get("page")).toBe("2");
        expect(dataRows()).toHaveLength(25);
        expect(screen.getByRole("table").parentElement).toHaveClass("is-refreshing");

        pending.open();
        await waitFor(() => expect(dataRows()).toHaveLength(10));
        expect(pagination()).toHaveTextContent("26–35 sur 35 mouvements");
        expect(within(pagination()).getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("table").parentElement).not.toHaveClass("is-refreshing");
        expect(queries.at(-1)?.get("askedPage")).toBe("2");

        // A new page size starts again from the first page.
        await user.selectOptions(within(pagination()).getByRole("combobox", { name: "Éléments par page" }), "10");

        expect(search().get("size")).toBe("10");
        expect(search().has("page")).toBe(false);
        await waitFor(() => expect(pagination()).toHaveTextContent("1–10 sur 35 mouvements"));
        expect(within(pagination()).getAllByRole("button", { name: /^Page \d$/ })).toHaveLength(4);
        expect(queries.at(-1)?.get("pageSize")).toBe("10");
    });

    it("goes back to the first page when a filter changes", async () => {
        addMovements(30);
        const { user } = await renderMovements("/mouvements?page=2&size=10");
        expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent("11–20 sur 35 mouvements");

        await user.selectOptions(warehouseSelect(), "Entrepôt Nord");

        expect(search().has("page")).toBe(false);
        expect(search().get("size")).toBe("10");
        await waitFor(() => expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent("1–10 sur 33 mouvements"));
    });

    it("shows an empty journal", async () => {
        db.movements.splice(0);
        await renderMovements();

        expect(await lede("0 mouvement enregistré")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Aucun mouvement sur cette période" })).toBeInTheDocument();
        expect(screen.getByText("Les mouvements de stock apparaîtront ici dès qu’ils seront enregistrés.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Effacer les filtres" })).not.toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
    });

    it("suggests removing the filters when nothing matches", async () => {
        const { user } = await renderMovements("/mouvements?entrepot=3");

        expect(await lede("0 mouvement sur la sélection")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Aucun mouvement sur cette période" })).toBeInTheDocument();
        expect(screen.getByText("Élargissez la période ou retirez un filtre.")).toBeInTheDocument();
        const buttons = screen.getAllByRole("button", { name: "Effacer les filtres" });
        expect(buttons).toHaveLength(2); // in the toolbar and in the empty state

        await user.click(buttons[1]);

        expect(window.location.search).toBe("");
        expect(await lede("5 mouvements enregistrés")).toBeInTheDocument();
        expect(dataRows()).toHaveLength(5);
    });

    it("shows an error banner with a retry", async () => {
        let fail = true;
        server.use(
            http.get(api("/stock/movements"), () => {
                if (fail) return new HttpResponse(null, { status: 500 });
            }),
        );
        const { user } = await renderMovements();

        const banner = screen.getByRole("alert");
        expect(banner).toHaveTextContent("Impossible de charger les mouvements. Une erreur interne est survenue côté serveur.");
        expect(screen.queryByRole("table")).not.toBeInTheDocument();

        fail = false;
        await user.click(within(banner).getByRole("button", { name: "Réessayer" }));

        expect(await lede("5 mouvements enregistrés")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(dataRows()).toHaveLength(5);
    });

    it("offers the CSV export as disabled", async () => {
        await renderMovements();

        const button = screen.getByRole("button", { name: "Exporter en CSV" });
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleDescription("Export CSV non disponible dans cette version.");
    });

    it("lets an Admin record a movement", async () => {
        const { user } = await renderMovements();

        await user.click(screen.getByRole("button", { name: "Nouveau mouvement" }));

        expect(await screen.findByRole("dialog", { name: "Nouveau mouvement de stock" })).toBeInTheDocument();
    });

    it("does not offer a User to record a movement", async () => {
        await renderMovements("/mouvements", "User");

        expect(screen.queryByRole("button", { name: "Nouveau mouvement" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Exporter en CSV" })).toBeInTheDocument();
    });
});
