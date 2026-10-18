import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { Field } from "./ui/Form";
import { Overlay } from "./ui/Overlay";
import { useToast } from "../context/toast";
import { ApiError, errorMessage } from "../lib/api";
import { fieldProps } from "../lib/forms";
import { gap } from "../lib/style";

export type EntityField = {
    name: string;
    label: string;
    value: string;
    required?: boolean;
    maxLength: number;
    hint?: string;
    validate: (value: string) => string;
};

type EntityFormModalProps = {
    title: string;
    fields: EntityField[];
    /** Rejects with an ApiError to keep the modal open. */
    onSave: (values: Record<string, string>) => Promise<void>;
    onClose: () => void;
};

/** Small create / edit form in a modal, for categories and warehouses (prototype: entityFormModal). */
export function EntityFormModal({ title, fields, onSave, onClose }: EntityFormModalProps) {
    const toast = useToast();
    const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, f.value])));
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const [serverErrors, setServerErrors] = useState<Record<string, string | undefined>>({});
    const [saving, setSaving] = useState(false);

    // A field with a shown error is re-validated live as it is corrected (same rule as useValidation).
    const errors = Object.fromEntries(
        fields.map((f) => [f.name, (checked[f.name] && f.validate(values[f.name].trim())) || serverErrors[f.name] || undefined]),
    );
    const check = (f: EntityField) => setChecked((c) => ({ ...c, [f.name]: !!f.validate(values[f.name].trim()) }));

    async function onSubmit(e: FormEvent, close: () => void) {
        e.preventDefault();
        const invalid = Object.fromEntries(fields.map((f) => [f.name, !!f.validate(values[f.name].trim())]));
        setChecked(invalid);
        setServerErrors({});
        if (Object.values(invalid).some(Boolean)) return;
        setSaving(true);
        try {
            await onSave(Object.fromEntries(fields.map((f) => [f.name, values[f.name].trim()])));
            close();
        } catch (err) {
            setSaving(false);
            if (err instanceof ApiError && err.status === 400 && Object.keys(err.fieldErrors).length) setServerErrors(err.fieldErrors);
            else toast("error", "Enregistrement impossible", errorMessage(err));
        }
    }

    return (
        <Overlay onClose={onClose} persistent={saving}>
            {(close) => (
                <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ent-title">
                    <div className="modal-head">
                        <h2 id="ent-title">{title}</h2>
                        <button type="button" className="btn btn-ghost btn-icon" aria-label="Fermer" onClick={close}><Icon name="x" /></button>
                    </div>
                    <form noValidate onSubmit={(e) => onSubmit(e, close)}>
                        <div className="modal-body od-stack" style={gap(16)}>
                            {fields.map((f, i) => (
                                <Field key={f.name} name={f.name} label={f.label} required={f.required} hint={f.hint} error={errors[f.name]}>
                                    <input
                                        {...fieldProps(f.name, errors[f.name], !!f.hint)}
                                        className="input"
                                        maxLength={f.maxLength}
                                        autoFocus={i === 0}
                                        value={values[f.name]}
                                        onChange={(e) => {
                                            setValues((v) => ({ ...v, [f.name]: e.target.value }));
                                            setServerErrors((x) => ({ ...x, [f.name]: undefined }));
                                        }}
                                        onBlur={() => check(f)}
                                    />
                                </Field>
                            ))}
                        </div>
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={close}>Annuler</button>
                            <button type="submit" className={`btn btn-primary${saving ? " is-loading" : ""}`}>Enregistrer</button>
                        </div>
                    </form>
                </div>
            )}
        </Overlay>
    );
}
