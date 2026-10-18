import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Field, FormSummary, PasswordInput } from "./Form";
import { fieldProps } from "../../lib/forms";

describe("Field", () => {
    it("labels its control", () => {
        render(
            <Field name="name" label="Nom">
                <input {...fieldProps("name", undefined)} />
            </Field>,
        );
        const input = screen.getByRole("textbox", { name: "Nom" });
        expect(input).toHaveAttribute("id", "f-name");
        expect(input).not.toHaveAttribute("aria-describedby");
        expect(input).not.toHaveAttribute("aria-invalid");
    });

    it("marks a required field for sighted and screen reader users", () => {
        render(
            <Field name="name" label="Nom" required>
                <input {...fieldProps("name", undefined)} />
            </Field>,
        );
        // jsdom's name computation drops the space before the screen reader text.
        expect(screen.getByRole("textbox", { name: /^Nom\s?\(obligatoire\)$/ })).toBeInTheDocument();
        expect(screen.getByText("(obligatoire)")).toHaveClass("sr-only");
        expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
    });

    it("describes the control with its hint", () => {
        render(
            <Field name="address" label="Adresse" hint="Facultatif">
                <input {...fieldProps("address", undefined, true)} />
            </Field>,
        );
        const input = screen.getByRole("textbox", { name: "Adresse" });
        expect(input).toHaveAttribute("aria-describedby", "f-address-hint");
        expect(input).toHaveAccessibleDescription("Facultatif");
    });

    it("describes an invalid control with its hint and error", () => {
        const { container } = render(
            <Field name="price" label="Prix" hint="En euros" error="Saisissez un prix.">
                <input {...fieldProps("price", "Saisissez un prix.", true)} />
            </Field>,
        );
        const input = screen.getByRole("textbox", { name: "Prix" });
        expect(input).toBeInvalid();
        expect(input).toHaveAttribute("aria-describedby", "f-price-hint f-price-err");
        expect(input).toHaveAccessibleDescription("En euros Saisissez un prix.");
        expect(container.firstElementChild).toHaveClass("field", "has-error");
        expect(container.firstElementChild).toHaveAttribute("data-field", "price");
    });

    it("has no error styling without an error", () => {
        const { container } = render(
            <Field name="price" label="Prix" className="col-2">
                <input {...fieldProps("price", undefined)} />
            </Field>,
        );
        expect(container.firstElementChild).toHaveAttribute("class", "field col-2");
    });

    it("uses a plain label for a control that is not labelable", () => {
        render(
            <Field name="type" label="Type" labelId="type-label" required extra={<p>Le stock sera recalculé.</p>}>
                <div role="radiogroup" aria-labelledby="type-label">
                    <label><input type="radio" name="type" />Entrée</label>
                </div>
            </Field>,
        );
        expect(screen.getByRole("radiogroup", { name: /^Type\s?\(obligatoire\)$/ })).toBeInTheDocument();
        expect(screen.getByText("Le stock sera recalculé.")).toBeInTheDocument();
        expect(document.querySelector("label[for]")).toBeNull();
    });
});

describe("FormSummary", () => {
    it("renders nothing without errors", () => {
        const { container } = render(<FormSummary errors={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("counts a single error in the singular", () => {
        render(<FormSummary errors={[["name", "Le nom est obligatoire."]]} />);
        expect(screen.getByRole("alert")).toHaveTextContent("1 champ à corriger :");
    });

    it("lists the errors and focuses the field of the clicked one", async () => {
        const user = userEvent.setup();
        render(
            <>
                <FormSummary
                    errors={[
                        ["name", "Le nom est obligatoire."],
                        ["price", "Le prix doit être positif."],
                    ]}
                />
                <input {...fieldProps("name", "x")} aria-label="Nom" />
                <input {...fieldProps("price", "x")} aria-label="Prix" />
            </>,
        );
        expect(screen.getByRole("alert")).toHaveTextContent("2 champs à corriger :");
        const link = screen.getByRole("link", { name: "Le prix doit être positif." });
        expect(link).toHaveAttribute("href", "#f-price");

        await user.click(link);
        expect(screen.getByRole("textbox", { name: "Prix" })).toHaveFocus();
        // The default jump is prevented: the URL does not change.
        expect(window.location.hash).toBe("");

        await user.click(screen.getByRole("link", { name: "Le nom est obligatoire." }));
        expect(screen.getByRole("textbox", { name: "Nom" })).toHaveFocus();
    });

    it("ignores a link whose field is not on the page", async () => {
        const user = userEvent.setup();
        render(<FormSummary errors={[["stock", "Le stock est obligatoire."]]} />);
        const link = screen.getByRole("link", { name: "Le stock est obligatoire." });
        await user.click(link);
        expect(link).toHaveFocus();
        expect(window.location.hash).toBe("");
    });
});

describe("PasswordInput", () => {
    it("hides the password until it is shown, then hides it again", async () => {
        const user = userEvent.setup();
        render(
            <>
                <label htmlFor="pw">Mot de passe</label>
                <PasswordInput id="pw" defaultValue="Secret1!" />
            </>,
        );
        const input = screen.getByLabelText("Mot de passe");
        expect(input).toHaveAttribute("type", "password");
        expect(input).toHaveValue("Secret1!");

        const show = screen.getByRole("button", { name: "Afficher le mot de passe" });
        expect(show).toHaveAttribute("aria-pressed", "false");
        await user.click(show);

        expect(input).toHaveAttribute("type", "text");
        const hide = screen.getByRole("button", { name: "Masquer le mot de passe" });
        expect(hide).toHaveAttribute("aria-pressed", "true");
        expect(hide.querySelector("use")).toHaveAttribute("href", "#i-eye-off");

        await user.click(hide);
        expect(input).toHaveAttribute("type", "password");
        expect(screen.getByRole("button", { name: "Afficher le mot de passe" }).querySelector("use")).toHaveAttribute("href", "#i-eye");
    });

    it("passes its props to the input but keeps its own class and type", () => {
        render(<PasswordInput aria-label="Confirmation" className="ignored" type="text" autoComplete="new-password" />);
        const input = screen.getByLabelText("Confirmation");
        expect(input).toHaveAttribute("class", "input");
        expect(input).toHaveAttribute("type", "password");
        expect(input).toHaveAttribute("autocomplete", "new-password");
    });

    it("does not submit the form when toggled", async () => {
        const user = userEvent.setup();
        let submitted = false;
        render(
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    submitted = true;
                }}
            >
                <PasswordInput aria-label="Mot de passe" />
            </form>,
        );
        await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
        expect(submitted).toBe(false);
    });
});
