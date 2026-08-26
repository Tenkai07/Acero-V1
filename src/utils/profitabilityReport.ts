import { SteelProject } from "../types";
import { BOMProject, MaterialStockItem } from "../inventario/types";

export interface ProjectProfitability {
  bomProjectId: string;
  bomProjectName: string;
  linkedSteelProjectName: string | null;
  presupuestadoCLP: number | null; // null si no hay proyecto de presupuesto vinculado
  costoPerfilesCLP: number;
  costoPlanchasPernosCLP: number;
  costoRealTotalCLP: number;
  diferenciaCLP: number | null; // presupuestado - costoReal (null si no hay presupuesto)
  margenPct: number | null;
  itemsSinCosto: string[]; // materiales usados que no se pudieron valorizar (sin match en inventario)
}

/**
 * Calcula el costo real de materiales de un proyecto de cubicación:
 * - Perfiles: usa barsNeededTotal (barras necesarias, vengan de stock o de
 *   compra) de cada grupo, valorizado al costo por metro del material
 *   asociado en bodega.
 * - Planchas y pernos: usa el registro de additionalConsumption (ya
 *   descontado vía "Registrar Consumo por Proyecto"), respetando que las
 *   planchas se miden en fracción de plancha completa y los pernos en
 *   unidades enteras.
 * Si el proyecto tiene un SteelProject vinculado (linkedSteelProjectId),
 * compara contra su totalPriceCLP para calcular margen. Esto es rentabilidad
 * de MATERIALES únicamente — no incluye mano de obra ni otros costos.
 */
export function computeProjectProfitability(
  bomProject: BOMProject,
  steelProjects: SteelProject[],
  inventory: MaterialStockItem[]
): ProjectProfitability {
  const inventoryById = new Map(inventory.map((m) => [m.id, m]));
  const itemsSinCosto: string[] = [];

  let costoPerfilesCLP = 0;
  for (const group of bomProject.groups) {
    const material = group.matchedMaterialId ? inventoryById.get(group.matchedMaterialId) : undefined;
    const barsNeeded = group.stockComparison?.barsNeededTotal ?? 0;
    if (barsNeeded <= 0) continue;
    if (!material || !material.costPerMeter) {
      itemsSinCosto.push(group.profileName);
      continue;
    }
    const barLenM = (material.standardBarLengthMm || 6000) / 1000;
    costoPerfilesCLP += barsNeeded * barLenM * material.costPerMeter;
  }

  let costoPlanchasPernosCLP = 0;
  for (const c of bomProject.additionalConsumption || []) {
    const material = inventoryById.get(c.materialId);
    if (!material || !material.costPerMeter) {
      itemsSinCosto.push(c.materialName);
      continue;
    }
    // Planchas: costPerMeter = costo por plancha completa, quantity = fracción/equivalente en planchas.
    // Pernos: costPerMeter = costo por unidad, quantity = unidades enteras.
    costoPlanchasPernosCLP += c.quantity * material.costPerMeter;
  }

  const linkedSteelProject = bomProject.linkedSteelProjectId
    ? steelProjects.find((p) => p.id === bomProject.linkedSteelProjectId) || null
    : null;

  const presupuestadoCLP = linkedSteelProject ? linkedSteelProject.totalPriceCLP : null;
  const costoRealTotalCLP = costoPerfilesCLP + costoPlanchasPernosCLP;
  const diferenciaCLP = presupuestadoCLP !== null ? presupuestadoCLP - costoRealTotalCLP : null;
  const margenPct = presupuestadoCLP && presupuestadoCLP > 0 ? (diferenciaCLP! / presupuestadoCLP) * 100 : null;

  return {
    bomProjectId: bomProject.id,
    bomProjectName: bomProject.name,
    linkedSteelProjectName: linkedSteelProject?.name || null,
    presupuestadoCLP,
    costoPerfilesCLP: Math.round(costoPerfilesCLP),
    costoPlanchasPernosCLP: Math.round(costoPlanchasPernosCLP),
    costoRealTotalCLP: Math.round(costoRealTotalCLP),
    diferenciaCLP: diferenciaCLP !== null ? Math.round(diferenciaCLP) : null,
    margenPct: margenPct !== null ? Number(margenPct.toFixed(1)) : null,
    itemsSinCosto: [...new Set(itemsSinCosto)]
  };
}
