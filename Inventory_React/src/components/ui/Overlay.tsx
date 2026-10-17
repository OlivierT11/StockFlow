import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const CLOSE_MS = 160;

function focusables(root: Element | null | undefined): HTMLElement[] {
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("disabled"));
}

type OverlayProps = {
    /** Side panel instead of a centered modal. */
    drawer?: boolean;
    /** A click on the scrim does not close it (forms that would lose input). */
    persistent?: boolean;
    /** Called once the closing animation is over. */
    onClose: () => void;
    /** Receives the animated close function, for Cancel buttons and after a save. */
    children: (close: () => void) => ReactNode;
};

/** Scrim + focus trap + Escape for modals and drawers (prototype: openOverlay / closeOverlay). */
export function Overlay({ drawer, persistent, onClose, children }: OverlayProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [phase, setPhase] = useState<"enter" | "open" | "closing">("enter");
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    });

    const close = useCallback(() => setPhase("closing"), []);

    // Unmount (through the parent) once the closing transition is over.
    useEffect(() => {
        if (phase !== "closing") return;
        const timer = setTimeout(() => onCloseRef.current(), CLOSE_MS);
        return () => clearTimeout(timer);
    }, [phase]);

    useEffect(() => {
        const lastFocus = document.activeElement as HTMLElement | null;
        const raf = requestAnimationFrame(() =>
            requestAnimationFrame(() => setPhase((p) => (p === "enter" ? "open" : p))),
        );
        document.body.style.overflow = "hidden";
        const focusTimer = setTimeout(() => {
            const dialog = ref.current?.querySelector('[role="dialog"]');
            if (dialog && !dialog.contains(document.activeElement)) focusables(dialog)[0]?.focus();
        }, 60);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(focusTimer);
            document.body.style.overflow = "";
            lastFocus?.focus?.();
        };
    }, []);

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Escape") {
            e.preventDefault();
            close();
            return;
        }
        if (e.key !== "Tab") return;
        const list = focusables(ref.current?.querySelector('[role="dialog"]'));
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    const cls = ["overlay", drawer && "drawer-overlay", phase === "open" && "is-open", phase === "closing" && "is-closing"]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            ref={ref}
            className={cls}
            role="presentation"
            onKeyDown={onKeyDown}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !persistent) close();
            }}
        >
            {children(close)}
        </div>
    );
}
