import { BOMProject, MaterialStockItem } from "../inventario/types";
import { computeProjectProfitability } from "./profitabilityReport";

export interface MonthlyBucket {
  count: number;
  totalWeightKg: number;
  totalCostoMaterialesCLP: number;
  totalBarsToBuy: number;
  totalPlanchasConsumidas: number;
  totalPernosConsumidos: number;
}

export interface MonthlyReportRow {
  month: string; // "2026-01"
  monthLabel: string; // "Enero 2026"
  reales: MonthlyBucket;
  teoricas: MonthlyBucket;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function emptyBucket(): MonthlyBucket {
  return { count: 0, totalWeightKg: 0, totalCostoMaterialesCLP: 0, totalBarsToBuy: 0, totalPlanchasConsumidas: 0, totalPernosConsumidos: 0 };
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-");
  const idx = parseInt(month, 10) - 1;
  return `${MESES[idx] || month} ${year}`;
}

/**
 * Arma el informe mensual agrupando por mes de la fecha del proyecto
 * (BOMProject.date). CRÍTICO: separa cubicaciones REALES (esReal=true) de
 * TEÓRICAS (cotizaciones/estimaciones que pueden no concretarse nunca) en
 * dos totales completamente independientes por mes — nunca se suman entre
 * sí, para que un informe mensual de consumo/costo no quede inflado por
 * cubicaciones que no se ejecutaron.
 */
export function buildMonthlyReport(bomProjects: BOMProject[], inventory: MaterialStockItem[]): MonthlyReportRow[] {
  const byMonth = new Map<string, MonthlyReportRow>();

  for (const project of bomProjects) {
    const monthKey = (project.date || project.createdAt || "").slice(0, 7); // "YYYY-MM"
    if (!monthKey || monthKey.length !== 7) continue;

    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, { month: monthKey, monthLabel: monthLabelFromKey(monthKey), reales: emptyBucket(), teoricas: emptyBucket() });
    }
    const row = byMonth.get(monthKey)!;
    const bucket = project.esReal === true ? row.reales : row.teoricas;

    const profitability = computeProjectProfitability(project, [], inventory);
    const planchasConsumidas = (project.additionalConsumption || [])
      .filter((c) => c.unitType === "plancha")
      .reduce((s, c) => s + c.quantity, 0);
    const pernosConsumidos = (project.additionalConsumption || [])
      .filter((c) => c.unitType === "unidad")
      .reduce((s, c) => s + c.quantity, 0);

    bucket.count += 1;
    bucket.totalWeightKg += project.totalWeightKg || 0;
    bucket.totalCostoMaterialesCLP += profitability.costoRealTotalCLP;
    bucket.totalBarsToBuy += project.totalBarsToBuy || 0;
    bucket.totalPlanchasConsumidas += planchasConsumidas;
    bucket.totalPernosConsumidos += pernosConsumidos;
  }

  return Array.from(byMonth.values()).sort((a, b) => (a.month < b.month ? 1 : -1)); // más reciente primero
}
