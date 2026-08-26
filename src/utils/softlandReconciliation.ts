import { MaterialStockItem } from "../inventario/types";
import { SoftlandConsumptionRow } from "./softlandImporter";

export interface DeductionRow {
  code: string;
  description: string;
  matched: boolean;
  materialId?: string;
  materialName?: string;
  unitReported: string;
  quantityReported: number;
  metersEquivalent: number; // cantidad reportada convertida a metros lineales
  currentStockMeters: number; // stock actual en metros (barras completas + retazos)
  projectedStockMeters: number; // stock estimado tras aplicar el descuento
  wholeBarsToDeduct: number; // aproximación en barras completas (redondeado)
  alertaStockNegativo: boolean;
  alertaSinMatch: boolean;
}

function normalizeCode(code: string): string {
  return (code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function isWeightUnit(unit: string): boolean {
  return /kg|kilo/i.test(unit);
}

function isMeterUnit(unit: string): boolean {
  return /^m$|metro/i.test(unit.trim());
}

/**
 * Convierte la cantidad reportada por Softland a metros lineales, según la
 * unidad detectada en el reporte:
 * - "barra"/"unidad"/vacío -> se asume 1 unidad = 1 barra estándar del material
 * - "m"/"metro"            -> ya viene en metros
 * - "kg"                   -> se convierte usando el peso teórico (kg/m) del material
 * Si la unidad no calza con ninguna de estas, se asume igualmente "barras"
 * como valor por defecto más común en despachos de perfiles/planchas.
 */
function toMetersEquivalent(quantity: number, unit: string, material: MaterialStockItem): number {
  const barLenM = (material.standardBarLengthMm || 6000) / 1000;
  if (isMeterUnit(unit)) return quantity;
  if (isWeightUnit(unit)) {
    const wpm = material.theoreticalWeightPerMeter || 1;
    return quantity / wpm;
  }
  // Por defecto: unidades = barras completas
  return quantity * barLenM;
}

function currentStockInMeters(material: MaterialStockItem): number {
  // OJO: esto se usa solo para el reporte INTERNO de reconciliación (ayudar
  // al bodeguero a ver el stock físico real, incluyendo retazos). Los
  // retazos son un concepto que Softland no conoce — cualquier archivo que
  // se genere para SUBIR a Softland debe usar únicamente standardBarsCount
  // (barras/planchas/unidades completas), nunca sumar offcuts.
  const barLenM = (material.standardBarLengthMm || 6000) / 1000;
  const barsMeters = material.standardBarsCount * barLenM;
  const offcutsMeters = material.offcuts.reduce((s, o) => s + o.lengthMm / 1000, 0);
  return barsMeters + offcutsMeters;
}

/**
 * Compara el consumo reportado por Softland contra el inventario actual de
 * la app y arma la "planilla de descuento": qué falta descontar, por
 * material, y qué quedaría el stock si se aplica.
 */
export function buildDeductionSheet(
  consumptionRows: SoftlandConsumptionRow[],
  inventory: MaterialStockItem[]
): DeductionRow[] {
  const byCode = new Map(inventory.map((m) => [normalizeCode(m.code), m]));

  return consumptionRows.map((row) => {
    const material = byCode.get(normalizeCode(row.code));
    if (!material) {
      return {
        code: row.code,
        description: row.description,
        matched: false,
        unitReported: row.unit,
        quantityReported: row.quantity,
        metersEquivalent: 0,
        currentStockMeters: 0,
        projectedStockMeters: 0,
        wholeBarsToDeduct: 0,
        alertaStockNegativo: false,
        alertaSinMatch: true
      };
    }

    const metersEquivalent = toMetersEquivalent(row.quantity, row.unit, material);
    const currentMeters = currentStockInMeters(material);
    const projectedMeters = currentMeters - metersEquivalent;
    const barLenM = (material.standardBarLengthMm || 6000) / 1000;

    return {
      code: row.code,
      description: row.description || material.name,
      matched: true,
      materialId: material.id,
      materialName: material.name,
      unitReported: row.unit || "barra(s)",
      quantityReported: row.quantity,
      metersEquivalent: Number(metersEquivalent.toFixed(2)),
      currentStockMeters: Number(currentMeters.toFixed(2)),
      projectedStockMeters: Number(projectedMeters.toFixed(2)),
      wholeBarsToDeduct: Math.round(metersEquivalent / barLenM),
      alertaStockNegativo: projectedMeters < 0,
      alertaSinMatch: false
    };
  });
}

/**
 * Aplica el descuento al inventario. Es una APROXIMACIÓN por barras
 * completas: convierte el consumo a metros y descuenta esa cantidad
 * primero de barras enteras (restando de standardBarsCount) y, si sobra,
 * de los retazos más grandes disponibles. No sabe qué barra física exacta
 * se cortó — para trazabilidad exacta de qué retazo se usó, sigue siendo
 * necesario el flujo de Pre-anidado dentro de Cubicación. Úsalo como punto
 * de partida y verifica contra el conteo físico de bodega.
 */
export function applyDeductionToInventory(
  deductionRows: DeductionRow[],
  inventory: MaterialStockItem[]
): MaterialStockItem[] {
  const updated = inventory.map((m) => ({ ...m, offcuts: [...m.offcuts] }));

  for (const row of deductionRows) {
    if (!row.matched || !row.materialId) continue;
    const material = updated.find((m) => m.id === row.materialId);
    if (!material) continue;

    let remainingMeters = row.metersEquivalent;
    const barLenM = (material.standardBarLengthMm || 6000) / 1000;

    // 1) Descuenta primero barras completas
    const barsAvailableMeters = material.standardBarsCount * barLenM;
    if (remainingMeters > 0 && barsAvailableMeters > 0) {
      const metersFromBars = Math.min(remainingMeters, barsAvailableMeters);
      const barsUsed = Math.ceil(metersFromBars / barLenM);
      material.standardBarsCount = Math.max(0, material.standardBarsCount - barsUsed);
      remainingMeters -= metersFromBars;
    }

    // 2) Si aún falta, consume retazos (del más grande al más chico)
    if (remainingMeters > 0.001 && material.offcuts.length > 0) {
      material.offcuts.sort((a, b) => b.lengthMm - a.lengthMm);
      const stillNeededMm = remainingMeters * 1000;
      let consumedMm = 0;
      material.offcuts = material.offcuts.filter((o) => {
        if (consumedMm >= stillNeededMm) return true;
        consumedMm += o.lengthMm;
        return false; // se descarta: se consumió este retazo
      });
    }

    material.lastUpdated = new Date().toISOString();
  }

  return updated;
}
