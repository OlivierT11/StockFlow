export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function fieldIds(name: string) {
    return { control: `f-${name}`, hint: `f-${name}-hint`, error: `f-${name}-err` };
}

/** id, aria-invalid and aria-describedby for the control of a <Field>. */
export function fieldProps(name: string, error: string | undefined, hasHint = false) {
    const ids = fieldIds(name);
    const describedBy = [hasHint && ids.hint, error && ids.error].filter(Boolean).join(" ");
    return {
        id: ids.control,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
    };
}

export const isInteger = (v: string) => v.trim() !== "" && Number.isInteger(Number(v));
