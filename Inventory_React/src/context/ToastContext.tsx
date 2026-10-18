import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { ToastContext, type ToastAction, type ToastFn, type ToastKind } from "./toast";
import { Icon } from "../components/Icon";

type ToastItem = {
    id: number;
    kind: ToastKind;
    title: string;
    message?: string;
    action?: ToastAction;
};

const LEAVE_MS = 160;

function Toast({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
    const [leaving, setLeaving] = useState(false);
    const closed = useRef(false);

    const close = useCallback(() => {
        if (closed.current) return;
        closed.current = true;
        setLeaving(true);
        setTimeout(() => onDone(item.id), LEAVE_MS);
    }, [item.id, onDone]);

    useEffect(() => {
        const timer = setTimeout(close, item.action ? 8000 : 4500);
        return () => clearTimeout(timer);
    }, [close, item.action]);

    const iconName = item.kind === "success" ? "check-circle" : item.kind === "error" ? "alert-circle" : "info";
    return (
        <div className={`toast toast-${item.kind}${leaving ? " is-leaving" : ""}`} role={item.kind === "error" ? "alert" : "status"}>
            <Icon name={iconName} />
            <div className="toast-text">
                <span className="toast-title">{item.title}</span>
                {item.message && <span className="toast-msg">{item.message}</span>}
            </div>
            {item.action && (
                <button
                    type="button"
                    className="btn-link toast-action"
                    onClick={() => {
                        item.action?.onClick();
                        close();
                    }}
                >
                    {item.action.label}
                </button>
            )}
            <button type="button" className="toast-close" aria-label="Fermer la notification" onClick={close}>
                <Icon name="x" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: PropsWithChildren) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const nextId = useRef(1);

    const toast = useCallback<ToastFn>((kind, title, message, action) => {
        const id = nextId.current++;
        setItems((list) => [...list, { id, kind, title, message, action }]);
    }, []);

    const remove = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toasts" aria-live="polite" aria-atomic="false">
                {items.map((item) => (
                    <Toast key={item.id} item={item} onDone={remove} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}
