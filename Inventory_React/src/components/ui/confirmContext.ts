import { createContext, useContext, type ReactNode } from "react";

export type ConfirmOptions = {
    title: string;
    body: ReactNode;
    confirmLabel?: string;
    /** Red confirm button, focus on Cancel. */
    danger?: boolean;
    onConfirm: () => void;
};

export const ConfirmContext = createContext<((options: ConfirmOptions) => void) | undefined>(undefined);

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) throw new Error("useConfirm doit être utilisé dans un ConfirmProvider");
    return context;
}
