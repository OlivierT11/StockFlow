import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "./ToastContext";
import { useToast } from "./toast";

/** Buttons that raise the toasts used in the tests. */
function Harness({ onAction }: { onAction: () => void }) {
    const toast = useToast();
    return (
        <>
            <button type="button" onClick={() => toast("success", "Produit créé", "Vis inox A2 a été ajouté au catalogue.")}>
                Succès
            </button>
            <button type="button" onClick={() => toast("error", "Suppression impossible", "Le produit a des mouvements de stock.")}>
                Erreur
            </button>
            <button type="button" onClick={() => toast("info", "Liste à jour")}>
                Info
            </button>
            <button type="button" onClick={() => toast("success", "Produit créé", "Vis inox A2 a été ajouté.", { label: "Voir", onClick: onAction })}>
                Avec action
            </button>
        </>
    );
}

function setup() {
    const onAction = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
        <ToastProvider>
            <Harness onAction={onAction} />
        </ToastProvider>,
    );
    const raise = (name: string) => user.click(screen.getByRole("button", { name }));
    return { user, onAction, raise };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const iconOf = (toast: HTMLElement) => toast.querySelector("use")?.getAttribute("href");

describe("ToastProvider", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("kinds", () => {
        it("announces a success politely, with its title and message", async () => {
            const { raise } = setup();
            await raise("Succès");

            const toast = screen.getByRole("status");
            expect(within(toast).getByText("Produit créé")).toBeInTheDocument();
            expect(within(toast).getByText("Vis inox A2 a été ajouté au catalogue.")).toBeInTheDocument();
            expect(iconOf(toast)).toBe("#i-check-circle");
            expect(toast.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
        });

        it("shows an error as an alert", async () => {
            const { raise } = setup();
            await raise("Erreur");

            const toast = screen.getByRole("alert");
            expect(toast).toHaveTextContent("Suppression impossible");
            expect(toast).toHaveTextContent("Le produit a des mouvements de stock.");
            expect(iconOf(toast)).toBe("#i-alert-circle");
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });

        it("shows an info as a status, with only a title", async () => {
            const { raise } = setup();
            await raise("Info");

            const toast = screen.getByRole("status");
            expect(toast).toHaveTextContent(/^Liste à jour$/);
            expect(iconOf(toast)).toBe("#i-info");
            expect(within(toast).queryByRole("button", { name: "Voir" })).not.toBeInTheDocument();
        });

        it("stacks the toasts in the order they were raised", async () => {
            const { raise } = setup();
            await raise("Info");
            await raise("Succès");

            expect(screen.getAllByRole("status").map((t) => t.querySelector(".toast-title")?.textContent)).toEqual(["Liste à jour", "Produit créé"]);
        });
    });

    describe("dismissal", () => {
        it("dismisses a toast after 4.5 s", async () => {
            const { raise } = setup();
            await raise("Succès");

            await advance(4400);
            expect(screen.getByRole("status")).toBeInTheDocument();

            await advance(100 + 160);
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });

        it("keeps a toast with an action for 8 s", async () => {
            const { raise } = setup();
            await raise("Avec action");

            await advance(7900);
            expect(screen.getByRole("status")).toBeInTheDocument();

            await advance(100 + 160);
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });

        it("runs the action, then closes the toast", async () => {
            const { user, raise, onAction } = setup();
            await raise("Avec action");

            await user.click(screen.getByRole("button", { name: "Voir" }));
            expect(onAction).toHaveBeenCalledTimes(1);

            await advance(160);
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });

        it("closes only the toast whose close button is clicked", async () => {
            const { user, raise } = setup();
            await raise("Succès");
            await raise("Erreur");

            await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "Fermer la notification" }));
            await advance(160);

            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
            expect(screen.getByRole("status")).toHaveTextContent("Produit créé");
        });

        it("closes once when the close button is clicked twice", async () => {
            const { user, raise } = setup();
            await raise("Succès");
            await raise("Info");

            await user.dblClick(within(screen.getAllByRole("status")[0]).getByRole("button", { name: "Fermer la notification" }));
            await advance(160);

            expect(screen.getAllByRole("status")).toHaveLength(1);
            expect(screen.getByRole("status")).toHaveTextContent("Liste à jour");

            await advance(5000);
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });
    });
});

describe("useToast", () => {
    it("throws outside a ToastProvider", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => renderHook(() => useToast())).toThrow("useToast doit être utilisé dans un ToastProvider");
    });
});
