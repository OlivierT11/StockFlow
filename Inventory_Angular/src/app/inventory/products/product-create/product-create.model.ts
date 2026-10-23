export interface Product {
    id: number,
    name: string,
    price: number,
    stock: number,
    lowStockThreshold: number,
    categoryId: number,
    categoryName: string
}
