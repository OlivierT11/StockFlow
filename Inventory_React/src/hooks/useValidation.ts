import { useState } from "react";

type Messages = Partial<Record<string, string>>;

/**
 * Per-field rules that return an error message or "".
 * A field is checked on blur, and all of them on submit (which also fills the summary).
 * A field already showing an error is re-checked live while it is corrected: the message
 * disappears as the user types, not on the blur caused by clicking "Submit" — which would
 * move the button under the pointer and swallow the click.
 */
export function useValidation<K extends string>(rules: Record<K, () => string>) {
    const [checked, setChecked] = useState<Messages>({});
    const [server, setServer] = useState<Messages>({});
    const [summaryKeys, setSummaryKeys] = useState<string[]>([]);
    const keys = Object.keys(rules) as K[];
    const isRule = (k: string): k is K => k in rules;

    const errors: Messages = {};
    for (const [k, message] of Object.entries(checked)) {
        const live = message && isRule(k) ? rules[k]() : message;
        if (live) errors[k] = live;
    }
    for (const [k, message] of Object.entries(server)) {
        if (message && !errors[k]) errors[k] = message;
    }
    const summary = summaryKeys.filter((k) => errors[k]).map((k) => [k, errors[k] as string] as [string, string]);

    function check(name: K) {
        const message = rules[name]();
        setChecked((c) => ({ ...c, [name]: message || undefined }));
    }

    function checkAll(): boolean {
        const found = keys.map((k) => [k, rules[k]()] as [string, string]).filter(([, m]) => m);
        setChecked(Object.fromEntries(found));
        setServer({});
        setSummaryKeys(found.map(([k]) => k));
        return found.length === 0;
    }

    /** Field errors returned by the API (400); each one stays until its field is edited. */
    function setServerErrors(fieldErrors: Record<string, string>) {
        setServer(fieldErrors);
        setSummaryKeys(Object.keys(fieldErrors));
    }

    /** Call from the field's onChange. */
    function changed(name: string) {
        if (server[name]) setServer((s) => ({ ...s, [name]: undefined }));
    }

    return { errors, summary, check, checkAll, setServerErrors, changed };
}
