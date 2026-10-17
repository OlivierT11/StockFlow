import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "../Icon";
import { fieldIds } from "../../lib/forms";
import { plural } from "../../lib/format";

type FieldProps = {
    name: string;
    label: string;
    required?: boolean;
    hint?: ReactNode;
    error?: string;
    className?: string;
    /** For controls that are not a single labelable element (radio group, combobox slot). */
    labelId?: string;
    extra?: ReactNode;
    children: ReactNode;
};

/** Label, control, hint and per-field error (prototype: fieldHtml + setFieldError). */
export function Field({ name, label, required, hint, error, className, labelId, extra, children }: FieldProps) {
    const ids = fieldIds(name);
    const labelContent = (
        <>
            {label}
            {required && (
                <>
                    <span className="req" aria-hidden="true">*</span>
                    <span className="sr-only"> (obligatoire)</span>
                </>
            )}
        </>
    );
    return (
        <div className={`field${className ? ` ${className}` : ""}${error ? " has-error" : ""}`} data-field={name}>
            {labelId
                ? <span className="field-label" id={labelId}>{labelContent}</span>
                : <label className="field-label" htmlFor={ids.control}>{labelContent}</label>}
            {children}
            {extra}
            {hint && <span className="field-hint" id={ids.hint}>{hint}</span>}
            {error && (
                <span className="field-error" id={ids.error}>
                    <Icon name="alert-circle" />
                    <span>{error}</span>
                </span>
            )}
        </div>
    );
}

/** Error recap at the top of a form; each entry focuses its field. */
export function FormSummary({ errors }: { errors: [string, string][] }) {
    if (!errors.length) return null;
    return (
        <div className="form-summary" role="alert">
            <strong>{errors.length} {plural(errors.length, "champ")} à corriger :</strong>
            <ul>
                {errors.map(([name, message]) => (
                    <li key={name}>
                        <a
                            href={`#${fieldIds(name).control}`}
                            onClick={(e) => {
                                e.preventDefault();
                                document.getElementById(fieldIds(name).control)?.focus();
                            }}
                        >
                            {message}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Password input with a show / hide toggle. */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="input-affix">
            <input {...props} className="input" type={visible ? "text" : "password"} />
            <button
                type="button"
                className="affix-btn"
                aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
            >
                <Icon name={visible ? "eye-off" : "eye"} />
            </button>
        </div>
    );
}
