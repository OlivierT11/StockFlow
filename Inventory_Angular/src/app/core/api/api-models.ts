// Shapes of the Inventory API (Inventory_Api/Inventory/DTOs), ported from Inventory_React/src/lib/types.ts.
// Enums are serialized as strings.

// LEARN(B1) : une union de littéraux de chaîne. Le compilateur refuse toute autre valeur, et affine le type
// dans un `if (role === 'Admin')`.
export type Role = 'Admin' | 'User';

// LEARN(B1) : `type` et `interface` sont interchangeables pour décrire des objets comme ceux-ci. Une interface
// peut être rouverte (declaration merging) et se lit mieux dans les messages d'erreur ; choisis un style et garde-le.
export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  // LEARN(B1) : `number | null` n'est pas la même chose que `categoryId?: number` (qui veut dire « peut être absent »).
  categoryId: number | null;
  categoryName: string | null;
}

export interface ProductList {
  products: Product[];
  totalItems: number;
  totalPages: number;
}

export interface ProductCreate {
  name: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  categoryId: number | null;
}

// LEARN(B1) : un type intersection (&) ajoute des champs à un type existant.
export type ProductUpdate = ProductCreate & { id: number };

export type ProductSort = 'name' | 'price' | 'stock';
export type SortDirection = 'asc' | 'desc';

/** Query string of GET /api/v1/products/paged. Every field is optional (`?`). */
export interface ProductQuery {
  askedPage?: number;
  pageSize?: number;
  name?: string;
  minPrice?: number;
  maxPrice?: number;
  lowStockOnly?: boolean;
  categoryId?: number;
  sortBy?: ProductSort;
  sortDirection?: SortDirection;
}

export interface Category {
  id: number;
  name: string;
}

export interface Warehouse {
  id: number;
  name: string;
  address: string | null;
}

// LEARN(B1) : `Omit` (comme `Pick`, `Partial`, `Record`) est un utility type : il construit un nouveau type à partir d'un autre.
export type WarehouseRequest = Omit<Warehouse, 'id'>;

export type MovementType = 'In' | 'Out' | 'Adjustment';

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  type: MovementType;
  quantity: number;
  /** Signed effect on the stock: negative for Out, signed quantity for Adjustment. */
  delta: number;
  /** UTC, sometimes serialized without a zone designator: display it with the `apiDate` pipe. */
  date: string;
  userId: number;
  notes: string | null;
}

export interface StockMovementList {
  movements: StockMovement[];
  totalItems: number;
  totalPages: number;
}

export interface StockMovementCreate {
  productId: number;
  warehouseId: number;
  type: MovementType;
  quantity: number;
  notes: string | null;
}

export interface MovementQuery {
  warehouseId?: number;
  /** ISO date-time, inclusive. */
  from?: string;
  /** ISO date-time, exclusive. */
  to?: string;
  askedPage?: number;
  pageSize?: number;
}

export interface Dashboard {
  productCount: number;
  totalStockValue: number;
  lowStockProductCount: number;
  lowStockProducts: Product[];
  recentMovements: StockMovement[];
  generatedAtUtc: string;
}

export interface Profile {
  userId: string | null;
  email: string | null;
  role: string | null;
}
