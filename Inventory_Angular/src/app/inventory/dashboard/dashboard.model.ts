export interface DashboardMetric {
  label: string;
  value: number;
  change?: number;
  format?: 'number' | 'currency';
}

export interface DashboardSummary {
  metrics: DashboardMetric[];
  lowStockCount: number;
  recentMovements: number;
}
