import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fieldIds, fieldProps, isInteger } from "../lib/forms";
import { useValidation } from "./useValidation";

const NAME_REQUIRED = "Le nom est obligatoire.";
const STOCK_INVALID = "Le stock doit être un entier positif ou nul.";

/** A two-field form wired like the app's forms: check on blur, changed on input, checkAll on submit. */
function ProductForm({ onSave, serverErrors = {} }: { onSave: () => void; serverErrors?: Record<string, string> }) {
    const [name, setName] = useState("");
    const [stock, setStock] = useState("");
    const v = useValidation({
        name: () => (name.trim() ? "" : NAME_REQUIRED),
        stock: () => (isInteger(stock) && Number(stock) >= 0 ? "" : STOCK_INVALID),
    });
    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                if (v.checkAll()) onSave();
            }}
        >
            {v.summary.length > 0 && (
                <div role="alert">
                    <ul>
                        {v.summary.map(([k, message]) => (
                            <li key={k}>{message}</li>
                        ))}
                    </ul>
                </div>
            )}
            <label htmlFor={fieldIds("name").control}>Nom</label>
            <input
                {...fieldProps("name", v.errors.name)}
                value={name}
                onChange={(e) => {
                    setName(e.target.value);
                    v.changed("name");
                }}
                onBlur={() => v.check("name")}
            />
            {v.errors.name && <p id={fieldIds("name").error}>{v.errors.name}</p>}
            <label htmlFor={fieldIds("stock").control}>Stock</label>
            <input
                {...fieldProps("stock", v.errors.stock)}
                value={stock}
                onChange={(e) => {
                    setStock(e.target.value);
                    v.changed("stock");
                }}
                onBlur={() => v.check("stock")}
            />
            {v.errors.stock && <p id={fieldIds("stock").error}>{v.errors.stock}</p>}
            <button type="submit">Enregistrer</button>
            <button type="button" onClick={() => v.setServerErrors(serverErrors)}>
                Réponse 400
            </button>
        </form>
    );
}

function setup(props: { serverErrors?: Record<string, string> } = {}) {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<ProductForm onSave={onSave} {...props} />);
    return { user, onSave, name: screen.getByLabelText("Nom"), stock: screen.getByLabelText("Stock") };
}

const summary = () => within(screen.getByRole("alert")).getAllByRole("listitem").map((li) => li.textContent);

describe("useValidation", () => {
    it("shows no error before a field has been left", async () => {
        const { user, name } = setup();

        await user.type(name, "a");
        await user.clear(name);

        expect(name).not.toHaveAttribute("aria-invalid");
        expect(name).toHaveAccessibleDescription("");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("checks a field when it loses focus", async () => {
        const { user, name, stock } = setup();

        await user.click(name);
        await user.tab();

        expect(name).toHaveAttribute("aria-invalid", "true");
        expect(name).toHaveAccessibleDescription(NAME_REQUIRED);
        expect(stock).toHaveAccessibleDescription("");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows nothing when the field left is valid", async () => {
        const { user, name } = setup();

        await user.type(name, "Vis inox");
        await user.tab();

        expect(name).not.toHaveAttribute("aria-invalid");
        expect(screen.queryByText(NAME_REQUIRED)).not.toBeInTheDocument();
    });

    it("re-checks a field showing an error while it is being corrected", async () => {
        const { user, name } = setup();
        await user.click(name);
        await user.tab();

        await user.type(name, "V");
        expect(name).toHaveAccessibleDescription("");
        expect(name).toHaveFocus();

        await user.clear(name);
        expect(name).toHaveAccessibleDescription(NAME_REQUIRED);
    });

    it("checks every field on submit and lists the errors in a summary", async () => {
        const { user, onSave, name, stock } = setup();

        await user.click(screen.getByRole("button", { name: "Enregistrer" }));

        expect(onSave).not.toHaveBeenCalled();
        expect(summary()).toEqual([NAME_REQUIRED, STOCK_INVALID]);
        expect(name).toHaveAccessibleDescription(NAME_REQUIRED);
        expect(stock).toHaveAccessibleDescription(STOCK_INVALID);
    });

    it("updates the summary as the fields are corrected", async () => {
        const { user, name, stock } = setup();
        await user.click(screen.getByRole("button", { name: "Enregistrer" }));

        await user.type(name, "Vis inox");
        expect(summary()).toEqual([STOCK_INVALID]);

        await user.type(stock, "12");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("submits when every field is valid", async () => {
        const { user, onSave, name, stock } = setup();

        await user.type(name, "Vis inox");
        await user.type(stock, "40");
        await user.click(screen.getByRole("button", { name: "Enregistrer" }));

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the server errors, each one until its field is edited", async () => {
        const { user, name, stock } = setup({ serverErrors: { name: "Un produit porte déjà ce nom.", categoryId: "La catégorie 99 n'existe pas." } });
        await user.type(name, "Vis inox");
        await user.type(stock, "40");

        await user.click(screen.getByRole("button", { name: "Réponse 400" }));

        expect(name).toHaveAccessibleDescription("Un produit porte déjà ce nom.");
        expect(summary()).toEqual(["Un produit porte déjà ce nom.", "La catégorie 99 n'existe pas."]);

        await user.type(stock, "0");
        expect(name).toHaveAccessibleDescription("Un produit porte déjà ce nom.");

        await user.type(name, " A2");
        expect(name).toHaveAccessibleDescription("");
        expect(summary()).toEqual(["La catégorie 99 n'existe pas."]);
    });

    it("prefers the client error to a server error on the same field", async () => {
        const { user, name } = setup({ serverErrors: { name: "Un produit porte déjà ce nom." } });
        await user.click(name);
        await user.tab();

        await user.click(screen.getByRole("button", { name: "Réponse 400" }));

        expect(name).toHaveAccessibleDescription(NAME_REQUIRED);
        expect(summary()).toEqual([NAME_REQUIRED]);
    });

    it("drops the server errors on the next submit", async () => {
        const { user, onSave, name, stock } = setup({ serverErrors: { categoryId: "La catégorie 99 n'existe pas." } });
        await user.type(name, "Vis inox");
        await user.type(stock, "40");
        await user.click(screen.getByRole("button", { name: "Réponse 400" }));
        expect(summary()).toEqual(["La catégorie 99 n'existe pas."]);

        await user.click(screen.getByRole("button", { name: "Enregistrer" }));

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
