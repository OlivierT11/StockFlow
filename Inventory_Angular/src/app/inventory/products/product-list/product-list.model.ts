export interface Product {
    id: number,
    name: string,
    price: number,
    stock: number,
    lowStockThreshold: number,
    categoryId: number,
    categoryName: string
}

export interface PaginatedResponse<T> {
    products: T[];
    totalPages: number;
    currentPage: number;
    pageSize: number;
}

export interface PaginationState {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    products: Product[];
}
