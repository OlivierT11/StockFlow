// Shapes of the Inventory API (Inventory_Api/Inventory/DTOs). Enums are serialized as strings.

export type Role = "Admin" | "User";

export type Product = {
    id: number;
    name: string;
    price: number;
    stock: number;
    lowStockThreshold: number;
    categoryId: number | null;
    categoryName: string | null;
};

export type ProductList = {
    products: Product[];
    totalItems: number;
    totalPages: number;
};

export type ProductCreate = {
    name: string;
    price: number;
    stock: number;
    lowStockThreshold: number;
    categoryId: number | null;
};

export type ProductUpdate = ProductCreate & { id: number };

export type ProductSort = "name" | "price" | "stock";
export type SortDirection = "asc" | "desc";

export type ProductQuery = {
    askedPage?: number;
    pageSize?: number;
    name?: string;
    minPrice?: number;
    maxPrice?: number;
    lowStockOnly?: boolean;
    categoryId?: number;
    sortBy?: ProductSort;
    sortDirection?: SortDirection;
};

export type Category = {
    id: number;
    name: string;
};

export type Warehouse = {
    id: number;
    name: string;
    address: string | null;
};

export type MovementType = "In" | "Out" | "Adjustment";

export type StockMovement = {
    id: number;
    productId: number;
    productName: string;
    warehouseId: number;
    warehouseName: string;
    type: MovementType;
    quantity: number;
    /** Signed effect on the stock: negative for Out, signed quantity for Adjustment. */
    delta: number;
    /** UTC, sometimes serialized without a zone designator: parse with toDate(). */
    date: string;
    userId: number;
    notes: string | null;
};

export type StockMovementList = {
    movements: StockMovement[];
    totalItems: number;
    totalPages: number;
};

export type StockMovementCreate = {
    productId: number;
    warehouseId: number;
    type: MovementType;
    quantity: number;
    notes: string | null;
};

export type MovementQuery = {
    warehouseId?: number;
    /** ISO date-time, inclusive. */
    from?: string;
    /** ISO date-time, exclusive. */
    to?: string;
    askedPage?: number;
    pageSize?: number;
};

export type Dashboard = {
    productCount: number;
    totalStockValue: number;
    lowStockProductCount: number;
    lowStockProducts: Product[];
    recentMovements: StockMovement[];
    generatedAtUtc: string;
};

export type Profile = {
    userId: string | null;
    email: string | null;
    role: string | null;
};
