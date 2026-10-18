// Contrato con backend: GET /api/dashboard/summary?from=ISO&to=ISO
export interface DashboardKpis {
  salesTotal: number;
  income: number;
  profit: number;
  documents: number;
  ticketAvg: number;
  prevIncome: number;
}

export interface DashboardSalesPoint {
  date: string;
  total: number;
}

export interface DashboardTopProduct {
  productId: string;
  name: string;
  qty: number;
  total: number;
}

export interface DashboardLowStock {
  productId: string;
  name: string;
  stock: number;
  min: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  salesByDay: DashboardSalesPoint[];
  topProducts: DashboardTopProduct[];
  bottomProducts: DashboardTopProduct[];
  lowStock: DashboardLowStock[];
}
