// In-memory data behind the fake API (handlers.ts). Reset after every test by setup.ts.
import type { Category, MovementType, Product, Role, StockMovement, Warehouse } from "../lib/types";

export type User = { id: number; username: string; email: string; password: string; role: Role };

type ProductRow = Omit<Product, "categoryName">;
type MovementRow = Omit<StockMovement, "productName" | "warehouseName">;

export const ADMIN = { id: 1, email: "admin@inventory.fr", password: "Admin1234!" } as const;
export const USER = { id: 2, email: "claire.martin@inventory.fr", password: "User1234!" } as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The API serializes some dates without a zone designator (see toDate()). */
export const apiDate = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().replace("Z", "");

function seed() {
    const users: User[] = [
        { id: ADMIN.id, username: "admin", email: ADMIN.email, password: ADMIN.password, role: "Admin" },
        { id: USER.id, username: "cmartin", email: USER.email, password: USER.password, role: "User" },
    ];
    const categories: Category[] = [
        { id: 1, name: "Visserie" },
        { id: 2, name: "Outillage" },
        { id: 3, name: "Électricité" }, // no products: can be deleted
    ];
    const warehouses: Warehouse[] = [
        { id: 1, name: "Entrepôt Nord", address: "12 rue des Docks, 59000 Lille" },
        { id: 2, name: "Entrepôt Sud", address: "48 avenue Berthelot, 69007 Lyon" },
        { id: 3, name: "Entrepôt Ouest", address: null }, // no movements: can be deleted
    ];
    const products: ProductRow[] = [
        { id: 1, name: "Vis inox A2 M6 × 40", price: 12.9, stock: 48, lowStockThreshold: 20, categoryId: 1 },
        { id: 2, name: "Vis à bois 4 × 50", price: 9.4, stock: 6, lowStockThreshold: 15, categoryId: 1 }, // low
        { id: 3, name: "Boulon hexagonal M10", price: 7.85, stock: 0, lowStockThreshold: 10, categoryId: 1 }, // out
        { id: 4, name: "Écrou frein M8", price: 6.2, stock: 83, lowStockThreshold: 20, categoryId: 1 },
        { id: 5, name: "Perceuse-visseuse 18 V", price: 189, stock: 7, lowStockThreshold: 3, categoryId: 2 },
        { id: 6, name: "Meuleuse d’angle 125 mm", price: 94.5, stock: 4, lowStockThreshold: 2, categoryId: 2 },
        { id: 7, name: "Niveau à bulle 60 cm", price: 18.9, stock: 3, lowStockThreshold: 4, categoryId: 2 }, // low
        { id: 8, name: "Mètre ruban 5 m", price: 8.5, stock: 26, lowStockThreshold: 10, categoryId: 2 },
        { id: 9, name: "Scie sauteuse 650 W", price: 76, stock: 2, lowStockThreshold: 2, categoryId: 2 }, // low
        { id: 10, name: "Gants nitrile taille L", price: 11.5, stock: 14, lowStockThreshold: 30, categoryId: null }, // low
        { id: 11, name: "Ruban adhésif toilé 50 mm", price: 5.2, stock: 37, lowStockThreshold: 15, categoryId: null },
        { id: 12, name: "Colle PU rapide 310 ml", price: 8.75, stock: 12, lowStockThreshold: 12, categoryId: null }, // low
    ];
    const movement = (id: number, productId: number, warehouseId: number, type: MovementType, quantity: number, msAgo: number, userId: number, notes: string | null): MovementRow => ({
        id,
        productId,
        warehouseId,
        type,
        quantity,
        delta: type === "Out" ? -quantity : quantity,
        date: apiDate(msAgo),
        userId,
        notes,
    });
    const movements: MovementRow[] = [
        movement(1, 1, 1, "In", 20, 1 * HOUR, ADMIN.id, "Réception fournisseur"),
        movement(2, 4, 2, "Out", 10, 2 * HOUR, USER.id, "Chantier Villeurbanne"),
        movement(3, 5, 1, "Out", 2, 1 * DAY, ADMIN.id, null),
        movement(4, 1, 2, "Adjustment", -3, 3 * DAY, ADMIN.id, "Inventaire tournant"),
        movement(5, 8, 1, "In", 5, 10 * DAY, USER.id, null),
    ];
    return { users, categories, warehouses, products, movements, accessTokens: new Map<string, number>(), refreshTokens: new Map<string, number>() };
}

let state = seed();
let tokenSeq = 0;

export const db = {
    get users() {
        return state.users;
    },
    get categories() {
        return state.categories;
    },
    get warehouses() {
        return state.warehouses;
    },
    get products() {
        return state.products;
    },
    get movements() {
        return state.movements;
    },

    reset() {
        state = seed();
    },

    nextId(rows: { id: number }[]) {
        return Math.max(0, ...rows.map((r) => r.id)) + 1;
    },

    product(row: ProductRow): Product {
        return { ...row, categoryName: state.categories.find((c) => c.id === row.categoryId)?.name ?? null };
    },
    movement(row: MovementRow): StockMovement {
        return {
            ...row,
            productName: state.products.find((p) => p.id === row.productId)?.name ?? "",
            warehouseName: state.warehouses.find((w) => w.id === row.warehouseId)?.name ?? "",
        };
    },

    /** Issues a token pair, as the login and refresh endpoints do. */
    issueTokens(userId: number) {
        tokenSeq += 1;
        const access = `access-${userId}-${tokenSeq}`;
        const refresh = `refresh-${userId}-${tokenSeq}`;
        state.accessTokens.set(access, userId);
        state.refreshTokens.set(refresh, userId);
        return { access, refresh };
    },
    userForAccess(token: string | undefined) {
        const id = token ? state.accessTokens.get(token) : undefined;
        return state.users.find((u) => u.id === id);
    },
    /** Simulates the 15-minute expiry: every access token now gets a 401. */
    expireAccessTokens() {
        state.accessTokens.clear();
    },
    /** Simulates a revoked or expired refresh token: the next refresh fails. */
    expireRefreshTokens() {
        state.refreshTokens.clear();
    },
    takeRefresh(token: string) {
        const userId = state.refreshTokens.get(token);
        state.refreshTokens.delete(token);
        return userId;
    },
};
