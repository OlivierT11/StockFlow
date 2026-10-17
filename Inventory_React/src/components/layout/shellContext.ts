import { createContext, useContext, useEffect } from "react";

type ShellContextValue = {
    setTitle: (title: string) => void;
    /** Low-stock count of the "Produits" nav badge, null until loaded. */
    lowStockCount: number | null;
    productCount: number | null;
};

export const ShellContext = createContext<ShellContextValue | undefined>(undefined);

export function useShell(): ShellContextValue {
    const context = useContext(ShellContext);
    if (!context) throw new Error("useShell doit être utilisé dans AppShell");
    return context;
}

/** Sets the top bar title and the document title. */
export function usePageTitle(title: string) {
    const { setTitle } = useShell();
    useEffect(() => {
        setTitle(title);
        document.title = `${title} — Inventory`;
    }, [title, setTitle]);
}
