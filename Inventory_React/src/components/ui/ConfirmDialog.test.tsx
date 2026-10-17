import { render, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmProvider } from "./ConfirmDialog";
import { useConfirm, type ConfirmOptions } from "./confirmContext";

type Options = Omit<ConfirmOptions, "onConfirm">;

/** Asks for a confirmation and shows the answer: "oui" once confirmed, "non" once closed without confirming. */
function Asker({ options }: { options: Options }) {
    const confirm = useConfirm();
    const [answer, setAnswer] = useState("en attente");
    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setAnswer("non");
                    confirm({ ...options, onConfirm: () => setAnswer("oui") });
                }}
            >
                Supprimer
            </button>
            <output aria-label="Réponse">{answer}</output>
        </>
    );
}

async function ask(options: Options = { title: "Supprimer ce produit ?", body: <p>Cette action est définitive.</p> }) {
    const user = userEvent.setup();
    render(
        <ConfirmProvider>
            <Asker options={options} />
        </ConfirmProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    const dialog = screen.getByRole("dialog", { name: options.title });
    return { user, dialog, answer: () => screen.getByRole("status", { name: "Réponse" }).textContent };
}

describe("ConfirmDialog", () => {
    it("shows the title and body in a modal dialog", async () => {
        const { dialog } = await ask();
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(within(dialog).getByRole("heading", { level: 2, name: "Supprimer ce produit ?" })).toBeInTheDocument();
        expect(within(dialog).getByText("Cette action est définitive.")).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Annuler" })).toBeInTheDocument();
    });

    it("confirms: calls onConfirm and closes", async () => {
        const { user, dialog, answer } = await ask();
        await user.click(within(dialog).getByRole("button", { name: "Confirmer" }));
        expect(answer()).toBe("oui");
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(answer()).toBe("oui");
    });

    it("cancels: closes without calling onConfirm", async () => {
        const { user, dialog, answer } = await ask();
        await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(answer()).toBe("non");
    });

    it("cancels on Escape", async () => {
        const { user, answer } = await ask();
        await user.keyboard("{Escape}");
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(answer()).toBe("non");
    });

    it("focuses the confirm button of a regular dialog", async () => {
        const { dialog } = await ask({ title: "Enregistrer ?", body: "Les modifications seront appliquées.", confirmLabel: "Enregistrer" });
        const confirmButton = within(dialog).getByRole("button", { name: "Enregistrer" });
        expect(confirmButton).toHaveFocus();
        expect(confirmButton).toHaveClass("btn-primary");
        expect(dialog.querySelector(".modal-icon")).toBeNull();
    });

    it("shows a warning, a red confirm button and focuses Cancel for a danger dialog", async () => {
        const { dialog } = await ask({ title: "Supprimer cette catégorie ?", body: "Elle sera supprimée.", confirmLabel: "Supprimer", danger: true });
        const confirmButton = within(dialog).getByRole("button", { name: "Supprimer" });
        expect(confirmButton).toHaveClass("btn-danger");
        expect(within(dialog).getByRole("button", { name: "Annuler" })).toHaveFocus();
        expect(dialog.querySelector(".modal-icon.danger use")).toHaveAttribute("href", "#i-alert");
    });

    it("replaces an open dialog with the next request", async () => {
        const user = userEvent.setup();
        const onFirst = vi.fn();
        const onSecond = vi.fn();
        function TwoAsks() {
            const confirm = useConfirm();
            return (
                <button
                    type="button"
                    onClick={() => {
                        confirm({ title: "Première", body: "1", onConfirm: onFirst });
                        confirm({ title: "Seconde", body: "2", onConfirm: onSecond });
                    }}
                >
                    Demander
                </button>
            );
        }
        render(
            <ConfirmProvider>
                <TwoAsks />
            </ConfirmProvider>,
        );
        await user.click(screen.getByRole("button", { name: "Demander" }));
        expect(screen.getAllByRole("dialog")).toHaveLength(1);
        await user.click(within(screen.getByRole("dialog", { name: "Seconde" })).getByRole("button", { name: "Confirmer" }));
        expect(onSecond).toHaveBeenCalledTimes(1);
        expect(onFirst).not.toHaveBeenCalled();
    });

    it("gives the focus back to the button that opened it", async () => {
        const { user, dialog } = await ask();
        await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Supprimer" })).toHaveFocus());
    });
});

describe("useConfirm", () => {
    it("throws outside a ConfirmProvider", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        function Orphan() {
            useConfirm();
            return null;
        }
        expect(() => render(<Orphan />)).toThrow("useConfirm doit être utilisé dans un ConfirmProvider");
    });
});
