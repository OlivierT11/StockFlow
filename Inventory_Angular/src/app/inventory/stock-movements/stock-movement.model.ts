export type StockMovementType = 'in' | 'out' | 'adjustment';

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  type: StockMovementType;
  quantity: number;
  delta: number;
  date: string;          // ISO 8601
  userId: number;
  notes: string | null;
}
