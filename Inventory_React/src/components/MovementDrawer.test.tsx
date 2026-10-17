import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useMovementDrawer } from "./movementDrawerContext";
import { useAuth } from "../context/auth";
import { ADMIN, db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp, renderWithProviders } from "../test/render";
import { server } from "../test/server";

const MINUS = "−";
const productName = (id: number) => db.products.find((p) => p.id === id)!.name;

type UserEvent = ReturnType<typeof renderApp>["user"];

/** The drawer's controls, scoped to the dialog. */
function drawer() {
    const dialog = within(screen.getByRole("dialog", { name: "Nouveau mouvement de stock" }));
    return {
        dialog,
        product: () => dialog.getByRole("combobox", { name: /^Produit/ }),
        listbox: () => dialog.queryByRole("listbox"),
        warehouse: () => dialog.getByRole("combobox", { name: /^Entrepôt/ }),
        type: (name: "Entrée" | "Sortie" | "Ajustement") => dialog.getByRole("radio", { name }),
        quantity: () => dialog.getByRole("spinbutton", { name: /^Quantité/ }),
        notes: () => dialog.getByRole("textbox", { name: /^Notes/ }),
        stockBefore: () => dialog.getByText("Stock avant").previousElementSibling?.textContent,
        stockAfter: () => dialog.getByText("Stock après").previousElementSibling?.textContent,
        submit: () => dialog.getByRole("button", { name: "Enregistrer le mouvement" }),
    };
}

/** Opens the drawer from the "Nouveau mouvement" button of a page, once the catalogue is loaded. */
async function openDrawer(path = "/mouvements") {
    const view = renderApp(path);
    await view.user.click(await screen.findByRole("button", { name: "Nouveau mouvement" }));
    await screen.findByRole("dialog", { name: "Nouveau mouvement de stock" });
    await screen.findByPlaceholderText("Rechercher un produit");
    await waitFor(() => expect(drawer().warehouse()).toBeEnabled());
    // The overlay moves the focus into the panel shortly after opening.
    await waitFor(() => expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement));
    return view;
}

async function pick(user: UserEvent, search: string, name: string) {
    await user.type(drawer().product(), search);
    await user.click(drawer().dialog.getByRole("option", { name: new RegExp(`^${name}`) }));
    await drawer().dialog.findByRole("button", { name: "Changer de produit" });
}

async function setQuantity(user: UserEvent, value: string) {
    await user.clear(drawer().quantity());
    if (value) await user.type(drawer().quantity(), value);
}

const waitForClosed = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

/** Records the bodies of POST /stock/movements, then lets the default handler answer. */
function capturePosts() {
    const bodies: unknown[] = [];
    server.use(
        http.post(api("/stock/movements"), async ({ request }) => {
            bodies.push(await request.clone().json());
        }),
    );
    return bodies;
}

/** A pending response that the test releases, to observe the loading states. */
function gate() {
    let open!: () => void;
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { opened, open };
}

function OpenButton() {
    const open = useMovementDrawer();
    const { status } = useAuth();
    return (
        <button type="button" disabled={status !== "authenticated"} onClick={() => open()}>
            Ouvrir le panneau
        </button>
    );
}

describe("MovementDrawer — opening and closing", () => {
    it("opens an empty form from the movements page", async () => {
        await openDrawer();
        const d = drawer();

        expect(d.product()).toHaveValue("");
        expect(d.product()).toHaveAttribute("aria-expanded", "false");
        expect(d.dialog.getByText("Sélectionnez un produit pour voir l’aperçu du stock.")).toBeInTheDocument();
        expect(d.warehouse()).toHaveDisplayValue("Entrepôt Nord");
        expect(d.type("Entrée")).toBeChecked();
        expect(d.dialog.getByText("Ajoute des unités au stock (réception, retour).")).toBeInTheDocument();
        expect(d.quantity()).toHaveValue(1);
        expect(d.quantity()).toHaveAttribute("min", "1");
        expect(d.quantity()).toHaveAccessibleDescription("Entier strictement positif.");
        expect(d.notes()).toHaveValue("");
    });

    it("opens with the product of the detail page already chosen", async () => {
        const { user } = renderApp("/produits/1");
        await screen.findByRole("heading", { level: 1, name: productName(1) });
        await user.click(screen.getByRole("button", { name: "Nouveau mouvement" }));
        const d = drawer();

        expect(d.dialog.getByText(productName(1))).toBeInTheDocument();
        expect(d.dialog.getByText("48 en stock")).toBeInTheDocument();
        expect(d.dialog.queryByRole("combobox", { name: /^Produit/ })).not.toBeInTheDocument();
        expect(d.stockBefore()).toBe("48");
        expect(d.stockAfter()).toBe("49");
    });

    it("refuses a User with a 403 toast", async () => {
        const { user } = renderWithProviders(<OpenButton />, { as: "User" });
        const button = screen.getByRole("button", { name: "Ouvrir le panneau" });
        await waitFor(() => expect(button).toBeEnabled());

        await user.click(button);

        const toast = await screen.findByRole("alert");
        expect(toast).toHaveTextContent("Action interdite");
        expect(toast).toHaveTextContent("Le rôle User ne peut pas enregistrer de mouvement (403).");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("can only be opened inside its provider", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        function Orphan() {
            useMovementDrawer();
            return null;
        }
        expect(() => render(<Orphan />)).toThrow("useMovementDrawer doit être utilisé dans un MovementDrawerProvider");
    });

    it.each([
        ["the Cancel button", (user: UserEvent) => user.click(drawer().dialog.getByRole("button", { name: "Annuler" }))],
        ["the close button", (user: UserEvent) => user.click(drawer().dialog.getByRole("button", { name: "Fermer le panneau" }))],
        ["Escape", (user: UserEvent) => user.keyboard("{Escape}")],
    ])("closes with %s", async (_, close) => {
        const { user } = await openDrawer();

        await close(user);

        await waitForClosed();
    });

    it("stays open on a click outside the panel, so nothing typed is lost", async () => {
        const { user } = await openDrawer();
        await user.type(drawer().notes(), "Réception");

        await user.click(screen.getByRole("dialog").parentElement!);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(drawer().notes()).toHaveValue("Réception");
    });

    it("starts from a fresh form each time it opens", async () => {
        const { user } = await openDrawer();
        await pick(user, "boulon", productName(3));
        await user.type(drawer().notes(), "Brouillon");
        await user.click(drawer().dialog.getByRole("button", { name: "Annuler" }));
        await waitForClosed();

        await user.click(screen.getByRole("button", { name: "Nouveau mouvement" }));

        const d = drawer();
        expect(d.product()).toHaveValue("");
        expect(d.notes()).toHaveValue("");
    });
});

describe("MovementDrawer — product combobox", () => {
    it("lists the catalogue on focus and filters it as the user types", async () => {
        const { user } = await openDrawer();
        const d = drawer();

        await user.click(d.product());
        expect(d.product()).toHaveAttribute("aria-expanded", "true");
        expect(within(d.listbox()!).getAllByRole("option")).toHaveLength(8); // first 8 of 12

        await user.type(d.product(), "VIS");
        const options = within(d.listbox()!).getAllByRole("option");
        expect(options.map((o) => o.textContent)).toEqual([`${productName(1)}48`, `${productName(2)}6`, `${productName(5)}7`]);

        await user.clear(d.product());
        await user.type(d.product(), "zzz");
        expect(d.listbox()).toHaveTextContent("Aucun produit pour « zzz »");
        expect(within(d.listbox()!).queryByRole("option")).not.toBeInTheDocument();
    });

    it("moves through the options with the arrow keys and picks one with Enter", async () => {
        const { user } = await openDrawer();
        const d = drawer();
        await user.type(d.product(), "vis");
        const option = (id: number) => d.dialog.getByRole("option", { name: new RegExp(`^${productName(id)}`) });

        expect(d.product()).not.toHaveAttribute("aria-activedescendant");
        await user.keyboard("{ArrowUp}"); // nothing highlighted yet: starts on the first option
        expect(d.product()).toHaveAttribute("aria-activedescendant", "mv-opt-1");
        expect(option(1)).toHaveAttribute("aria-selected", "true");
        await user.keyboard("{ArrowUp}"); // and never goes above it
        expect(d.product()).toHaveAttribute("aria-activedescendant", "mv-opt-1");

        await user.keyboard("{ArrowDown}");
        expect(d.product()).toHaveAttribute("aria-activedescendant", "mv-opt-2");
        await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}"); // stops on the last one
        expect(d.product()).toHaveAttribute("aria-activedescendant", "mv-opt-5");

        await user.keyboard("{ArrowUp}");
        expect(d.product()).toHaveAttribute("aria-activedescendant", "mv-opt-2");
        expect(option(2)).toHaveAttribute("aria-selected", "true");
        expect(option(1)).toHaveAttribute("aria-selected", "false");

        await user.keyboard("{Enter}");

        expect(await d.dialog.findByText("6 en stock")).toBeInTheDocument();
        expect(d.dialog.getByText(productName(2))).toBeInTheDocument();
        await waitFor(() => expect(drawer().quantity()).toHaveFocus());
    });

    it("picks the only match with Enter", async () => {
        const { user } = await openDrawer();

        await user.type(drawer().product(), "boulon{Enter}");

        expect(await drawer().dialog.findByText("0 en stock")).toBeInTheDocument();
        expect(drawer().dialog.getByText(productName(3))).toBeInTheDocument();
    });

    it("ignores Enter while several products match and none is highlighted", async () => {
        const { user } = await openDrawer();

        await user.type(drawer().product(), "vis{Enter}");

        expect(drawer().product()).toHaveValue("vis");
        expect(drawer().dialog.queryByRole("button", { name: "Changer de produit" })).not.toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument(); // Enter did not submit the form
    });

    it("closes the list on Escape before closing the drawer", async () => {
        const { user } = await openDrawer();
        await user.type(drawer().product(), "vis");
        expect(drawer().listbox()).toBeInTheDocument();

        await user.keyboard("{Escape}");

        expect(drawer().listbox()).not.toBeInTheDocument();
        expect(drawer().product()).toHaveAttribute("aria-expanded", "false");
        expect(drawer().product()).not.toHaveAttribute("aria-activedescendant");
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        // ArrowDown opens the list again.
        await user.keyboard("{ArrowDown}");
        expect(drawer().listbox()).toBeInTheDocument();
        expect(drawer().product()).toHaveAttribute("aria-activedescendant", "mv-opt-1");

        await user.keyboard("{Escape}{Escape}");
        await waitForClosed();
    });

    it("closes the list when the field loses focus", async () => {
        const { user } = await openDrawer();
        await user.click(drawer().product());
        expect(drawer().listbox()).toBeInTheDocument();

        await user.tab();

        await waitFor(() => expect(drawer().listbox()).not.toBeInTheDocument());
    });

    it("picks a product with the mouse and can change it", async () => {
        const { user } = await openDrawer();

        await pick(user, "mètre", productName(8));
        expect(drawer().dialog.getByText("26 en stock")).toBeInTheDocument();
        expect(drawer().stockBefore()).toBe("26");

        await user.click(drawer().dialog.getByRole("button", { name: "Changer de produit" }));

        await waitFor(() => expect(drawer().product()).toHaveFocus());
        expect(drawer().dialog.queryByRole("button", { name: "Changer de produit" })).not.toBeInTheDocument();
        expect(drawer().dialog.getByText("Sélectionnez un produit pour voir l’aperçu du stock.")).toBeInTheDocument();

        await user.clear(drawer().product());
        await pick(user, "boulon", productName(3));
        expect(drawer().stockBefore()).toBe("0");
    });

    it("clears the previous search when the product is changed", async () => {
        const { user } = await openDrawer();
        await pick(user, "mètre", productName(8));

        await user.click(drawer().dialog.getByRole("button", { name: "Changer de produit" }));

        expect(drawer().product()).toHaveValue("");
    });

    it("says the catalogue is loading", async () => {
        const pending = gate();
        server.use(
            http.get(api("/products"), async () => {
                await pending.opened;
            }),
        );
        const { user } = renderApp("/mouvements");
        await user.click(await screen.findByRole("button", { name: "Nouveau mouvement" }));
        await screen.findByRole("dialog");

        expect(drawer().product()).toHaveAttribute("placeholder", "Chargement des produits…");
        await user.click(drawer().product());
        expect(drawer().listbox()).toHaveTextContent("Chargement…");

        pending.open();
        await waitFor(() => expect(drawer().product()).toHaveAttribute("placeholder", "Rechercher un produit"));
        expect(within(drawer().listbox()!).getAllByRole("option")).toHaveLength(8);
    });
});

describe("MovementDrawer — warehouse and type", () => {
    it("defaults to the first warehouse and lets the user choose another", async () => {
        const { user } = await openDrawer();
        const d = drawer();
        expect(within(d.warehouse()).getAllByRole("option").map((o) => o.textContent)).toEqual(["Entrepôt Nord", "Entrepôt Sud", "Entrepôt Ouest"]);

        await user.selectOptions(d.warehouse(), "Entrepôt Ouest");

        expect(d.warehouse()).toHaveDisplayValue("Entrepôt Ouest");
    });

    it("disables the warehouse list while it loads", async () => {
        const pending = gate();
        server.use(
            http.get(api("/warehouses"), async () => {
                await pending.opened;
            }),
        );
        const { user } = renderApp("/mouvements");
        await user.click(await screen.findByRole("button", { name: "Nouveau mouvement" }));
        await screen.findByRole("dialog");

        expect(drawer().warehouse()).toBeDisabled();
        expect(drawer().warehouse()).toHaveDisplayValue("Chargement…");

        pending.open();
        await waitFor(() => expect(drawer().warehouse()).toBeEnabled());
        expect(drawer().warehouse()).toHaveDisplayValue("Entrepôt Nord");
    });

    it("explains that a warehouse must be created first", async () => {
        server.use(http.get(api("/warehouses"), () => HttpResponse.json([])));
        const bodies = capturePosts();
        const { user } = renderApp("/mouvements");
        await user.click(await screen.findByRole("button", { name: "Nouveau mouvement" }));
        await screen.findByPlaceholderText("Rechercher un produit");
        await drawer().dialog.findByText("Aucun entrepôt : un administrateur doit d’abord en créer un.");
        expect(drawer().warehouse()).toBeDisabled();

        await pick(user, "boulon", productName(3));
        await user.click(drawer().submit());

        expect(drawer().warehouse()).toHaveAccessibleDescription("Choisissez un entrepôt.");
        expect(bodies).toHaveLength(0);
    });

    it("switches the movement type and its hints", async () => {
        const { user } = await openDrawer();
        const d = drawer();
        expect(d.dialog.getByRole("radiogroup", { name: /^Type de mouvement/ })).toBeInTheDocument();

        await user.click(d.type("Sortie"));
        expect(d.type("Sortie")).toBeChecked();
        expect(d.type("Entrée")).not.toBeChecked();
        expect(d.dialog.getByText("Retire des unités du stock (chantier, consommation).")).toBeInTheDocument();
        expect(d.quantity()).toHaveAccessibleDescription("Entier strictement positif.");

        await user.click(d.type("Ajustement"));
        expect(d.dialog.getByText("Corrige le stock après inventaire : positif ou négatif.")).toBeInTheDocument();
        expect(d.quantity()).toHaveAccessibleDescription("Entier non nul : négatif pour retirer, positif pour ajouter.");
        expect(d.quantity()).not.toHaveAttribute("min");
    });
});

describe("MovementDrawer — quantity and preview", () => {
    const POSITIVE = "Entier strictement positif.";
    const NON_ZERO = "Entier non nul : négatif pour retirer, positif pour ajouter.";

    it.each([
        ["Entrée", "", POSITIVE, "Saisissez une quantité entière."],
        ["Entrée", "2.5", POSITIVE, "Saisissez une quantité entière."],
        ["Entrée", "0", POSITIVE, "La quantité doit être supérieure à 0."],
        ["Sortie", "-4", POSITIVE, "La quantité doit être supérieure à 0."],
        ["Ajustement", "0", NON_ZERO, "La quantité d’ajustement ne peut pas être nulle."],
    ] as const)("checks type %s with a quantity of %j when the field loses focus", async (type, value, hint, message) => {
        const { user } = await openDrawer();
        await user.click(drawer().type(type));

        await setQuantity(user, value);
        await user.tab();

        expect(drawer().quantity()).toHaveAttribute("aria-invalid", "true");
        expect(drawer().quantity()).toHaveAccessibleDescription(`${hint} ${message}`);

        await setQuantity(user, "3");
        await user.tab();
        expect(drawer().quantity()).toHaveAccessibleDescription(hint);
    });

    it("previews the stock after the movement", async () => {
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1)); // 48 in stock, threshold 20
        const d = drawer();
        expect(d.stockBefore()).toBe("48");
        expect(d.stockAfter()).toBe("49");

        await setQuantity(user, "5");
        expect(d.stockAfter()).toBe("53");

        await user.click(d.type("Sortie"));
        expect(d.stockAfter()).toBe("43");
        expect(d.dialog.queryByText(/sous son seuil/)).not.toBeInTheDocument();

        await setQuantity(user, "28");
        expect(d.stockAfter()).toBe("20");
        expect(d.dialog.getByText("Le produit sera sous son seuil de 20.")).toBeInTheDocument();

        await setQuantity(user, "49");
        expect(d.stockAfter()).toBe("-1");
        expect(d.dialog.getByText("Stock résultant négatif : le mouvement sera refusé.")).toBeInTheDocument();
        expect(d.dialog.queryByText(/sous son seuil/)).not.toBeInTheDocument();

        await setQuantity(user, "");
        expect(d.stockAfter()).toBe("48");
    });

    it.each([
        ["Sortie", "49"],
        ["Ajustement", "-49"],
    ] as const)("refuses type %s with a quantity of %s, beyond the stock, without calling the API", async (type, quantity) => {
        const bodies = capturePosts();
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1));
        await user.click(drawer().type(type));
        await setQuantity(user, quantity);

        await user.click(drawer().submit());

        expect(drawer().quantity()).toHaveAccessibleDescription(expect.stringContaining("Stock insuffisant : 48 unités disponibles."));
        expect(bodies).toHaveLength(0);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("writes « unité disponible » in the singular for a stock of 0 or 1", async () => {
        const { user } = await openDrawer();
        await pick(user, "boulon", productName(3));
        await user.click(drawer().type("Sortie"));
        await setQuantity(user, "1");

        await user.click(drawer().submit());

        expect(drawer().quantity()).toHaveAccessibleDescription(expect.stringContaining("Stock insuffisant : 0 unité disponible."));
    });

    it("accepts a negative adjustment that the stock allows", async () => {
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1));
        await user.click(drawer().type("Ajustement"));
        await setQuantity(user, "-3");
        await user.tab();
        expect(drawer().quantity()).not.toHaveAttribute("aria-invalid");
        expect(drawer().stockAfter()).toBe("45");

        await user.click(drawer().submit());

        await waitForClosed();
        expect(db.movements.at(-1)).toMatchObject({ productId: 1, type: "Adjustment", quantity: -3, delta: -3 });
        expect(db.products.find((p) => p.id === 1)?.stock).toBe(45);
        const toast = await screen.findByRole("status");
        expect(toast).toHaveTextContent("Ajustement enregistrée");
        expect(toast).toHaveTextContent(`${MINUS}3 · ${productName(1)} · stock : 45`);
    });

    it("requires a product and a valid quantity on submit", async () => {
        const bodies = capturePosts();
        const { user } = await openDrawer();
        await setQuantity(user, "0");

        await user.click(drawer().submit());

        expect(drawer().product()).toHaveAttribute("aria-invalid", "true");
        expect(drawer().product()).toHaveAccessibleDescription("Choisissez un produit.");
        expect(drawer().quantity()).toHaveAccessibleDescription("Entier strictement positif. La quantité doit être supérieure à 0.");
        expect(bodies).toHaveLength(0);

        await pick(user, "boulon", productName(3));
        expect(drawer().dialog.queryByText("Choisissez un produit.")).not.toBeInTheDocument();
    });
});

describe("MovementDrawer — saving", () => {
    it("records the movement, closes, refreshes the page and confirms", async () => {
        const { user } = await openDrawer();
        expect(await screen.findByText("5 mouvements enregistrés")).toBeInTheDocument();
        const d = drawer();
        await pick(user, "inox", productName(1));
        await user.selectOptions(d.warehouse(), "Entrepôt Sud");
        await user.click(d.type("Sortie"));
        await setQuantity(user, "5");
        await user.type(d.notes(), "  Chantier Lyon  ");

        await user.click(d.submit());

        await waitForClosed();
        expect(db.movements).toHaveLength(6);
        expect(db.movements.at(-1)).toMatchObject({ productId: 1, warehouseId: 2, type: "Out", quantity: 5, delta: -5, notes: "Chantier Lyon", userId: ADMIN.id });
        expect(db.products.find((p) => p.id === 1)?.stock).toBe(43);

        const toast = await screen.findByRole("status");
        expect(toast).toHaveTextContent("Sortie enregistrée");
        expect(toast).toHaveTextContent(`${MINUS}5 · ${productName(1)} · stock : 43`);

        // invalidate() refetches the journal behind the drawer.
        expect(await screen.findByText("6 mouvements enregistrés")).toBeInTheDocument();
        const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
        expect(firstRow).toHaveTextContent("Chantier Lyon");
    });

    it("sends the defaults, with no notes, and refreshes the dashboard", async () => {
        const bodies = capturePosts();
        const { user } = await openDrawer("/");
        const lowTile = () => within(screen.getByRole("region", { name: "Indicateurs clés" })).getByRole("link", { name: /^Produits sous seuil/ });
        expect(within(lowTile()).getByText("6")).toBeInTheDocument();
        await pick(user, "ruban adh", productName(11)); // 37 in stock, threshold 15

        await user.click(drawer().type("Sortie"));
        await setQuantity(user, "30");
        await user.click(drawer().submit());

        await waitForClosed();
        expect(bodies).toEqual([{ productId: 11, warehouseId: 1, type: "Out", quantity: 30, notes: null }]);
        // Product 11 is now below its threshold: the dashboard and the nav badge follow.
        expect(await within(lowTile()).findByText("7")).toBeInTheDocument();
        expect(screen.getByLabelText("7 produits à surveiller")).toBeInTheDocument();
        const recent = within(screen.getByRole("region", { name: "Derniers mouvements" })).getAllByRole("row")[1];
        expect(recent).toHaveTextContent(productName(11));
    });

    it("maps a 422 insufficient stock to the quantity field", async () => {
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1)); // 48 in stock when the drawer loaded
        db.products.find((p) => p.id === 1)!.stock = 2; // meanwhile, someone used most of it
        await user.click(drawer().type("Sortie"));
        await setQuantity(user, "5");

        await user.click(drawer().submit());

        await waitFor(() =>
            expect(drawer().quantity()).toHaveAccessibleDescription(
                "Entier strictement positif. Stock insuffisant : ce mouvement rendrait le stock du produit 1 négatif.",
            ),
        );
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(db.movements).toHaveLength(5);
        expect(drawer().submit()).not.toHaveClass("is-loading");
    });

    it("falls back to a generic message for a 422 without detail", async () => {
        server.use(http.post(api("/stock/movements"), () => HttpResponse.json({ status: 422, title: "Unprocessable Entity" }, { status: 422 })));
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1));

        await user.click(drawer().submit());

        await waitFor(() => expect(drawer().quantity()).toHaveAccessibleDescription("Entier strictement positif. Stock insuffisant."));
    });

    it("shows the error of a product deleted meanwhile under the product field", async () => {
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1));
        db.products.splice(0, 1);

        await user.click(drawer().submit());

        expect(await drawer().dialog.findByText("Le produit 1 n'existe pas.")).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows the error of a warehouse deleted meanwhile under the warehouse field", async () => {
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1));
        db.warehouses.splice(0, 1);

        await user.click(drawer().submit());

        await waitFor(() => expect(drawer().warehouse()).toHaveAccessibleDescription("L'entrepôt 1 n'existe pas."));
    });

    it.each([
        ["Quantity", "The field Quantity must be between -2147483648 and 2147483647.", "quantity", "Entier strictement positif. "],
        ["Type", "The JSON value could not be converted to MovementType.", "quantity", "Entier strictement positif. "],
        ["Notes", "The field Notes must be a string with a maximum length of 250.", "notes", "250 caractères maximum, facultatif. "],
    ] as const)("maps a 400 error on %s to its field", async (key, message, field, hint) => {
        server.use(
            http.post(api("/stock/movements"), () =>
                HttpResponse.json({ title: "One or more validation errors occurred.", status: 400, errors: { [key]: [message] } }, { status: 400 }),
            ),
        );
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1));

        await user.click(drawer().submit());

        await waitFor(() => expect(drawer()[field]()).toHaveAccessibleDescription(`${hint}${message}`));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each([
        ["a server error", () => new HttpResponse(null, { status: 500 }), "Une erreur interne est survenue côté serveur."],
        ["a 403", () => new HttpResponse(null, { status: 403 }), "Cette action est interdite pour votre rôle (403)."],
        ["a 400 without field errors", () => HttpResponse.json({ status: 400, title: "Bad Request", detail: "Mouvement en double." }, { status: 400 }), "Mouvement en double."],
        ["a network error", () => HttpResponse.error(), "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez."],
    ])("shows %s as a toast and keeps the form", async (_, response, message) => {
        server.use(http.post(api("/stock/movements"), response));
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1));
        await user.type(drawer().notes(), "À garder");

        await user.click(drawer().submit());

        const toast = await screen.findByRole("alert");
        expect(toast).toHaveTextContent("Mouvement refusé");
        expect(toast).toHaveTextContent(message);
        expect(drawer().notes()).toHaveValue("À garder");
        expect(drawer().submit()).not.toHaveClass("is-loading");
        expect(db.movements).toHaveLength(5);
    });

    it("shows the button busy while saving", async () => {
        const pending = gate();
        server.use(
            http.post(api("/stock/movements"), async () => {
                await pending.opened;
            }),
        );
        const { user } = await openDrawer();
        await pick(user, "inox", productName(1));

        await user.click(drawer().submit());
        expect(drawer().submit()).toHaveClass("is-loading");

        pending.open();
        await waitForClosed();
        expect(db.movements).toHaveLength(6);
    });
});
