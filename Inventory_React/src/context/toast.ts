import { createContext, useContext } from "react";

export type ToastKind = "success" | "error" | "info";
export type ToastAction = { label: string; onClick: () => void };
export type ToastFn = (kind: ToastKind, title: string, message?: string, action?: ToastAction) => void;

export const ToastContext = createContext<ToastFn | undefined>(undefined);

export function useToast(): ToastFn {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast doit être utilisé dans un ToastProvider");
    return context;
}
