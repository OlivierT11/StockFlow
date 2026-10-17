import { screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { EntityFormModal, type EntityField } from "./EntityFormModal";
import { ApiError, categoriesApi } from "../lib/api";
import { api } from "../test/handlers";
import { renderWithProviders, type As } from "../test/render";
import { server } from "../test/server";

const nameRule = (v: string) => (!v ? "Le nom est obligatoire." : v.length < 3 ? "3 caractères minimum." : "");

const FIELDS: EntityField[] = [
    { name: "name", label: "Nom", value: "", required: true, maxLength: 100, validate: nameRule },
    { name: "address", label: "Adresse", value: "", maxLength: 200, hint: "Facultatif.", validate: () => "" },
];

type Save = (values: Record<string, string>) => Promise<void>;

/** Opens the modal from a button, and unmounts it on close, as the pages do. */
function Opener({ fields, onSave, onClose }: { fields: EntityField[]; onSave: Save; onClose: () => void }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Nouvel entrepôt</button>
            {open && (
                <EntityFormModal
                    title="Nouvel entrepôt"
                    fields={fields}
                    onSave={onSave}
                    onClose={() => {
                        setOpen(false);
                        onClose();
                    }}
                />
            )}
        </>
    );
}

async function openModal({ fields = FIELDS, onSave = vi.fn<Save>().mockResolvedValue(undefined), as = null }: { fields?: EntityField[]; onSave?: Save; as?: As } = {}) {
    const onClose = vi.fn();
    const { user } = renderWithProviders(<Opener fields={fields} onSave={onSave} onClose={onClose} />, { as });
    await user.click(screen.getByRole("button", { name: "Nouvel entrepôt" }));
    const dialog = screen.getByRole("dialog", { name: "Nouvel entrepôt" });
    return {
        user,
        onSave,
        onClose,
        dialog,
        name: within(dialog).getByRole("textbox", { name: /^Nom/ }),
        address: within(dialog).queryByRole("textbox", { name: "Adresse" })!,
        save: () => user.click(within(dialog).getByRole("button", { name: "Enregistrer" })),
    };
}

const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe("EntityFormModal", () => {
    it("shows the fields with their initial values and focuses the first one", async () => {
        const fields = [{ ...FIELDS[0], value: "Entrepôt Nord" }, { ...FIELDS[1], value: "12 rue des Docks" }];
        const { dialog, name, address } = await openModal({ fields });
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(within(dialog).getByRole("heading", { level: 2, name: "Nouvel entrepôt" })).toBeInTheDocument();
        expect(name).toHaveFocus();
        expect(name).toHaveValue("Entrepôt Nord");
        expect(name).toHaveAttribute("maxlength", "100");
        expect(address).toHaveValue("12 rue des Docks");
        expect(address).toHaveAccessibleDescription("Facultatif.");
        expect(name).not.toHaveAttribute("aria-invalid");
    });

    it("refuses to save an invalid form and shows the error on the field", async () => {
        const { onSave, name, save, dialog } = await openModal();
        await save();
        expect(onSave).not.toHaveBeenCalled();
        expect(name).toBeInvalid();
        expect(name).toHaveAccessibleDescription("Le nom est obligatoire.");
        expect(dialog).toBeInTheDocument();
    });

    it("validates a field when it loses the focus, then live as it is corrected", async () => {
        const { user, name } = await openModal();
        await user.type(name, "A");
        expect(name).toBeValid();
        await user.tab();
        expect(name).toHaveAccessibleDescription("3 caractères minimum.");

        await user.type(name, "b");
        expect(name).toHaveAccessibleDescription("3 caractères minimum.");
        await user.type(name, "c");
        expect(name).toBeValid();
        expect(name).not.toHaveAttribute("aria-describedby");
    });

    it("does not validate live a field that was valid when it lost the focus", async () => {
        const { user, name } = await openModal();
        await user.type(name, "Atelier");
        await user.tab();
        await user.clear(name);
        expect(name).toBeValid();
    });

    it("saves the trimmed values and closes", async () => {
        const { user, onSave, onClose, name, address, save } = await openModal();
        await user.type(name, "  Entrepôt Est  ");
        await user.type(address, " 3 quai Est ");
        await save();
        expect(onSave).toHaveBeenCalledWith({ name: "Entrepôt Est", address: "3 quai Est" });
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("cannot be dismissed from the scrim while saving", async () => {
        const pending = deferred();
        const { user, dialog, name, save, onClose } = await openModal({ onSave: () => pending.promise });
        await user.type(name, "Entrepôt Est");
        await save();
        expect(within(dialog).getByRole("button", { name: "Enregistrer" })).toHaveClass("is-loading");

        await user.click(screen.getByRole("presentation"));
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(onClose).not.toHaveBeenCalled();

        pending.resolve();
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("shows the 400 field errors of the server and clears one as its field is edited", async () => {
        const onSave = vi.fn<Save>().mockRejectedValue(new ApiError(400, { fieldErrors: { name: "Ce nom est déjà utilisé.", address: "Adresse inconnue." } }));
        const { user, dialog, name, address, save } = await openModal({ onSave });
        await user.type(name, "Entrepôt Nord");
        await save();

        expect(await within(dialog).findByText("Ce nom est déjà utilisé.")).toBeInTheDocument();
        expect(name).toBeInvalid();
        expect(address).toHaveAccessibleDescription("Facultatif. Adresse inconnue.");
        expect(within(dialog).getByRole("button", { name: "Enregistrer" })).not.toHaveClass("is-loading");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        await user.type(name, "s");
        expect(name).toBeValid();
        expect(within(dialog).queryByText("Ce nom est déjà utilisé.")).not.toBeInTheDocument();
        // The other field keeps its error until it is edited too.
        expect(address).toBeInvalid();
    });

    it("clears the server errors when the form is submitted again", async () => {
        const onSave = vi.fn<Save>().mockRejectedValueOnce(new ApiError(400, { fieldErrors: { address: "Adresse inconnue." } })).mockResolvedValueOnce(undefined);
        const { user, name, address, save } = await openModal({ onSave });
        await user.type(name, "Entrepôt Est");
        await save();
        await waitFor(() => expect(address).toBeInvalid());

        await save();
        expect(address).toBeValid();
        expect(onSave).toHaveBeenCalledTimes(2);
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    });

    it("maps the ValidationProblemDetails of the API to the fields", async () => {
        server.use(
            http.post(api("/categories"), () =>
                HttpResponse.json({ title: "One or more validation errors occurred.", status: 400, errors: { Name: ["La catégorie existe déjà."] } }, { status: 400 }),
            ),
        );
        const fields = [FIELDS[0]];
        const { user, dialog, name, save } = await openModal({ fields, as: "Admin", onSave: async (v) => void (await categoriesApi.create({ name: v.name })) });
        await user.type(name, "Visserie");
        await save();
        expect(await within(dialog).findByText("La catégorie existe déjà.")).toBeInTheDocument();
        expect(name).toHaveAccessibleDescription("La catégorie existe déjà.");
    });

    it.each([
        { name: "a conflict", error: new ApiError(409, { title: "Conflit", detail: "La catégorie est utilisée." }), message: "La catégorie est utilisée." },
        { name: "a 400 without field errors", error: new ApiError(400, { message: "This user already exists." }), message: "La requête a échoué (400)." },
        { name: "an unexpected error", error: new TypeError("x is undefined"), message: "Une erreur inattendue est survenue." },
    ])("shows $name as an error toast and stays open", async ({ error, message }) => {
        const { user, dialog, name, save } = await openModal({ onSave: vi.fn<Save>().mockRejectedValue(error) });
        await user.type(name, "Entrepôt Est");
        await save();
        const toast = await screen.findByRole("alert");
        expect(toast).toHaveTextContent("Enregistrement impossible");
        expect(toast).toHaveTextContent(message);
        expect(dialog).toBeInTheDocument();
        expect(name).toBeValid();
    });

    it("shows a network failure of the API as an error toast", async () => {
        server.use(http.post(api("/categories"), () => HttpResponse.error()));
        const { user, name, save } = await openModal({ fields: [FIELDS[0]], as: "Admin", onSave: async (v) => void (await categoriesApi.create({ name: v.name })) });
        await user.type(name, "Quincaillerie");
        await save();
        expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
    });

    it.each(["Annuler", "Fermer"])("closes without saving with %s", async (label) => {
        const { user, dialog, onSave, onClose, name } = await openModal();
        await user.type(name, "Entrepôt Est");
        await user.click(within(dialog).getByRole("button", { name: label }));
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });

    it("closes from the scrim when it is not saving", async () => {
        const { user, onClose } = await openModal();
        await user.click(screen.getByRole("presentation"));
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("gives the focus back to the button that opened it", async () => {
        const { user, dialog } = await openModal();
        await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Nouvel entrepôt" })).toHaveFocus());
    });
});
