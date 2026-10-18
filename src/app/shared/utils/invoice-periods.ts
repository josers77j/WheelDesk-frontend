export interface InvoicePeriods { firstDate: string | null; today: string; periods: string[] }
export function availableYears(periods: string[]): number[] {
  return [...new Set(periods.map(period => Number(period.slice(0, 4))))].sort((a, b) => a - b);
}
export function availableMonths(periods: string[], year: number): number[] {
  return periods.filter(period => period.startsWith(`${year}-`)).map(period => Number(period.slice(5, 7)));
}
export function monthRange(period: string, today: string): { from: string; to: string } {
  const [year, month] = period.split('-').map(Number);
  const end = `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
  return { from: `${period}-01`, to: end > today ? today : end };
}
export const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
