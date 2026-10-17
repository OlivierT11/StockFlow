import { fmtInt } from "./format";
import type { MovementType, Product, StockMovement } from "./types";

export type StockState = "ok" | "low" | "out";

/** Same rule as the API: "low" when the stock is at or below the threshold. */
export function stockState(p: Pick<Product, "stock" | "lowStockThreshold">): StockState {
    if (p.stock === 0) return "out";
    return p.stock <= p.lowStockThreshold ? "low" : "ok";
}

export const MOVEMENT_TYPES: MovementType[] = ["In", "Out", "Adjustment"];

export const typeLabel: Record<MovementType, string> = {
    In: "Entrée",
    Out: "Sortie",
    Adjustment: "Ajustement",
};

export const signedQty = (delta: number) => `${delta >= 0 ? "+" : "−"}${fmtInt(Math.abs(delta))}`;

/** Text colour class of a movement quantity. */
export const qtyTextClass = (m: Pick<StockMovement, "type">) =>
    m.type === "In" ? "text-success" : m.type === "Out" ? "text-warning" : "";

export const qtyMiniClass = (m: Pick<StockMovement, "type">) =>
    m.type === "In" ? "in" : m.type === "Out" ? "out" : "adj";

/** Movements only carry a user id: name the current user, number the others. */
export const movementUser = (userId: number, currentUserId: number | undefined) =>
    userId === currentUserId ? "Vous" : `Utilisateur n° ${userId}`;
