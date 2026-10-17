import { createContext, useContext } from "react";
import type { Product } from "../lib/types";

/** Opens the "Nouveau mouvement de stock" drawer, optionally with a product already chosen. */
export const MovementDrawerContext = createContext<((product?: Product) => void) | undefined>(undefined);

export function useMovementDrawer() {
    const context = useContext(MovementDrawerContext);
    if (!context) throw new Error("useMovementDrawer doit être utilisé dans un MovementDrawerProvider");
    return context;
}
