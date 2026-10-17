import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ADMIN, db } from "../test/db";
import { api } from "../test/handlers";
import { renderApp } from "../test/render";
import { server } from "../test/server";

// The hook is used by the product list (row button) and the detail page (with fromDetail and onDeleted).

const productExists = (id: number) => db.products.some((p) => p.id === id);

/** The list with all 12 products on one page. */
async function renderList() {
    const view = renderApp("/produits?size=25");
    await screen.findByText("1–12 sur 12 produits");
    return view;
}

async function renderDetail(id: number) {
    const view = renderApp(`/produits/${id}`);
    await screen.findByRole("heading", { level: 1, name: db.products.find((p) => p.id === id)!.name });
    return view;
}

/** The toast whose title is `title`. */
async function findToast(title: string) {
    const titleEl = await screen.findByText(title);
    return titleEl.closest<HTMLElement>("[role=status], [role=alert]")!;
}

/** Records every DELETE /products/:id, then lets the fake API answer it. */
function captureDeletes() {
    const ids: string[] = [];
    server.use(
        http.delete(api("/products/:id"), ({ params }) => {
            ids.push(String(params.id));
        }),
    );
    return ids;
}

const dialogClosed = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

describe("useProductDelete", () => {
    describe("a product with movements", () => {
        it("explains why it cannot be deleted and opens its history from the list", async () => {
            const deletes = captureDeletes();
            const { user } = await renderList();

            await user.click(screen.getByRole("button", { name: "Supprimer Vis inox A2 M6 × 40" }));

            const dialog = await screen.findByRole("dialog", { name: "Suppression impossible" });
            expect(dialog).toHaveTextContent(
                "Vis inox A2 M6 × 40 porte 2 mouvements de stock. L’historique doit rester consultable : un produit avec des mouvements ne peut pas être supprimé.",
            );
            await user.click(within(dialog).getByRole("button", { name: "Voir l’historique" }));

            await dialogClosed();
            expect(window.location.pathname).toBe("/produits/1");
            expect(await screen.findByRole("heading", { level: 1, name: "Vis inox A2 M6 × 40" })).toBeInTheDocument();
            expect(deletes).toEqual([]);
            expect(productExists(1)).toBe(true);
        });

        it("only closes the explanation when it is cancelled", async () => {
            const { user } = await renderList();

            await user.click(screen.getByRole("button", { name: "Supprimer Écrou frein M8" }));
            const dialog = await screen.findByRole("dialog", { name: "Suppression impossible" });
            expect(dialog).toHaveTextContent("Écrou frein M8 porte 1 mouvement de stock.");
            await user.click(within(dialog).getByRole("button", { name: "Annuler" }));

            await dialogClosed();
            expect(window.location.pathname).toBe("/produits");
        });

        it("offers « Compris » on the detail page and stays there", async () => {
            const deletes = captureDeletes();
            const { user } = await renderDetail(4);

            await user.click(screen.getByRole("button", { name: "Supprimer" }));

            const dialog = await screen.findByRole("dialog", { name: "Suppression impossible" });
            expect(within(dialog).queryByRole("button", { name: "Voir l’historique" })).not.toBeInTheDocument();
            await user.click(within(dialog).getByRole("button", { name: "Compris" }));

            await dialogClosed();
            expect(window.location.pathname).toBe("/produits/4");
            expect(deletes).toEqual([]);
        });
    });

    describe("a product without movements", () => {
        it("asks for a danger confirmation, deletes it and refreshes the list and the counters", async () => {
            const { user } = await renderList();
            expect(await screen.findByLabelText("6 produits à surveiller")).toBeInTheDocument();

            await user.click(screen.getByRole("button", { name: "Supprimer Vis à bois 4 × 50" }));

            const dialog = await screen.findByRole("dialog", { name: "Supprimer ce produit ?" });
            expect(dialog).toHaveTextContent("Vis à bois 4 × 50 sera retiré du catalogue. Cette action est irréversible.");
            // Danger mode: the safe choice has the focus.
            expect(within(dialog).getByRole("button", { name: "Annuler" })).toHaveFocus();
            expect(productExists(2)).toBe(true);

            await user.click(within(dialog).getByRole("button", { name: "Supprimer définitivement" }));

            expect(await findToast("Produit supprimé")).toHaveTextContent("Vis à bois 4 × 50");
            expect(productExists(2)).toBe(false);
            // invalidate(): the list and the nav badge are fetched again.
            expect(await screen.findByText("1–11 sur 11 produits")).toBeInTheDocument();
            expect(screen.queryByRole("link", { name: "Vis à bois 4 × 50" })).not.toBeInTheDocument();
            expect(await screen.findByLabelText("5 produits à surveiller")).toBeInTheDocument();
            expect(window.location.pathname).toBe("/produits");
        });

        it("deletes nothing when the confirmation is cancelled", async () => {
            const deletes = captureDeletes();
            const { user } = await renderList();

            await user.click(screen.getByRole("button", { name: "Supprimer Vis à bois 4 × 50" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer ce produit ?" });
            await user.click(within(dialog).getByRole("button", { name: "Annuler" }));

            await dialogClosed();
            expect(deletes).toEqual([]);
            expect(productExists(2)).toBe(true);
        });

        it("goes back to the list after a delete from the detail page", async () => {
            const { user } = await renderDetail(2);

            await user.click(screen.getByRole("button", { name: "Supprimer" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer ce produit ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer définitivement" }));

            expect(await findToast("Produit supprimé")).toHaveTextContent("Vis à bois 4 × 50");
            await waitFor(() => expect(window.location.pathname).toBe("/produits"));
            expect(await screen.findByText("1–10 sur 11 produits")).toBeInTheDocument();
            expect(productExists(2)).toBe(false);
        });

        it("treats a 404 on delete as already deleted", async () => {
            const { user } = await renderDetail(2);
            await user.click(screen.getByRole("button", { name: "Supprimer" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer ce produit ?" });
            // Someone else deletes it while the dialog is open.
            db.products.splice(db.products.findIndex((p) => p.id === 2), 1);

            await user.click(within(dialog).getByRole("button", { name: "Supprimer définitivement" }));

            const toast = await findToast("Produit déjà supprimé");
            expect(toast).toHaveAttribute("role", "status");
            expect(toast).toHaveTextContent("Vis à bois 4 × 50");
            await waitFor(() => expect(window.location.pathname).toBe("/produits"));
            expect(await screen.findByText("1–10 sur 11 produits")).toBeInTheDocument();
        });

        it.each([
            { status: 403, message: "Cette action est interdite pour votre rôle (403)." },
            { status: 500, message: "Une erreur interne est survenue côté serveur." },
            { status: 0, message: "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez." },
        ])("shows a $status error in a toast and keeps the product", async ({ status, message }) => {
            server.use(http.delete(api("/products/:id"), () => (status ? new HttpResponse(null, { status }) : HttpResponse.error())));
            const { user } = await renderDetail(2);

            await user.click(screen.getByRole("button", { name: "Supprimer" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer ce produit ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer définitivement" }));

            const toast = await findToast("Suppression refusée");
            expect(toast).toHaveAttribute("role", "alert");
            expect(toast).toHaveTextContent(message);
            expect(window.location.pathname).toBe("/produits/2");
            expect(productExists(2)).toBe(true);
        });
    });

    describe("when the API refuses with 409", () => {
        it("reports the refusal when a movement is recorded between the count check and the DELETE", async () => {
            server.use(
                http.get(
                    api("/products/:id/movements"),
                    () => {
                        // The count check sees no movement, then another user records one before the confirmation.
                        db.movements.push({
                            id: db.nextId(db.movements),
                            productId: 2,
                            warehouseId: 1,
                            type: "In",
                            quantity: 5,
                            delta: 5,
                            date: new Date().toISOString(),
                            userId: ADMIN.id,
                            notes: null,
                        });
                        return HttpResponse.json({ movements: [], totalItems: 0, totalPages: 0 });
                    },
                    { once: true },
                ),
            );
            const { user } = await renderList();

            await user.click(screen.getByRole("button", { name: "Supprimer Vis à bois 4 × 50" }));
            const dialog = await screen.findByRole("dialog", { name: "Supprimer ce produit ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer définitivement" }));

            expect(await findToast("Suppression refusée")).toHaveTextContent("Le produit 2 a des mouvements de stock : il ne peut pas être supprimé.");
            expect(productExists(2)).toBe(true);
            expect(screen.getByRole("link", { name: "Vis à bois 4 × 50" })).toBeInTheDocument();
            expect(screen.queryByText("Produit supprimé")).not.toBeInTheDocument();
        });

        it("lets the API decide when the movement count cannot be read", async () => {
            server.use(http.get(api("/products/:id/movements"), () => HttpResponse.error()));
            const { user } = await renderList();

            await user.click(screen.getByRole("button", { name: "Supprimer Vis inox A2 M6 × 40" }));

            const dialog = await screen.findByRole("dialog", { name: "Supprimer ce produit ?" });
            await user.click(within(dialog).getByRole("button", { name: "Supprimer définitivement" }));

            expect(await findToast("Suppression refusée")).toHaveTextContent("Le produit 1 a des mouvements de stock : il ne peut pas être supprimé.");
            expect(productExists(1)).toBe(true);
        });
    });
});
