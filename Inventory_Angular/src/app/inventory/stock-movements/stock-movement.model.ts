export type StockMovementType = 'in' | 'out' | 'adjustment';

export interface StockMovement {
  id: string;
  productName: string;
  sku: string;
  warehouseName: string;
  type: StockMovementType;
  quantity: number;
  occurredAt: string;
  reference?: string;
}
