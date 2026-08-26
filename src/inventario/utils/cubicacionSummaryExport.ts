import * as XLSX from 'xlsx';
import { BOMProfileGroup, MaterialStockItem } from '../types';
import { getAvailableBarsCount, getReservedBarsCount, getAvailableOffcuts, getReservedOffcuts } from './stockReservations';

function mainGrade(group: BOMProfileGroup): string {
  return group.pieces[0]?.grade || 'A36';
}

/**
 * Exporta el resumen consolidado de una cubicación a un Excel de hasta 3
 * hojas:
 *  1. "Requerimiento Total del Proyecto" — SIEMPRE se incluye: cuánta
 *     perfilería hace falta en total, 100% material nuevo, sin tocar bodega.
 *  2. "Stock en Bodega" — solo si se corrió el cotejo con inventario
 *     (`group.stockComparison` existe en al menos un perfil): qué hay
 *     disponible vs. reservado para otros proyectos.
 *  3. "Resumen de Compra" — solo junto con la hoja 2: el faltante neto a
 *     comprar por perfil, con su calidad.
 */
export function exportCubicacionSummaryToExcel(
  groups: BOMProfileGroup[],
  inventory: MaterialStockItem[],
  projectName: string = 'Proyecto'
) {
  if (groups.length === 0) return;

  const workbook = XLSX.utils.book_new();
  const hasStockComparison = groups.some((g) => !!g.stockComparison);

  // -------------------------------------------------------------------
  // Hoja 1: Requerimiento Total del Proyecto (siempre)
  // -------------------------------------------------------------------
  const requerimientoRows = groups.map((g) => {
    const result = g.pureTheoreticalNestingResult || g.nestingResult;
    return {
      Perfil: g.cleanProfileCode,
      Calidad: mainGrade(g),
      'Largo Comercial (m)': (g.commercialBarLengthMm / 1000).toFixed(1),
      Piezas: g.totalPiecesCount,
      'Metros Lineales Netos': Number((g.totalLengthMm / 1000).toFixed(2)),
      'Peso Total (kg)': Number(g.totalWeightKg.toFixed(2)),
      'Barras Necesarias (100% Nuevo)': result?.totalBarsUsed || 0,
      'Aprovechamiento (%)': result?.overallEfficiencyPercentage || 0
    };
  });

  const totalBarrasReq = requerimientoRows.reduce((s, r) => s + r['Barras Necesarias (100% Nuevo)'], 0);
  const totalPesoReq = requerimientoRows.reduce((s, r) => s + r['Peso Total (kg)'], 0);
  const totalMetrosReq = requerimientoRows.reduce((s, r) => s + r['Metros Lineales Netos'], 0);
  requerimientoRows.push({
    Perfil: 'TOTAL PROYECTO',
    Calidad: '',
    'Largo Comercial (m)': '' as unknown as string,
    Piezas: groups.reduce((s, g) => s + g.totalPiecesCount, 0),
    'Metros Lineales Netos': Number(totalMetrosReq.toFixed(2)),
    'Peso Total (kg)': Number(totalPesoReq.toFixed(2)),
    'Barras Necesarias (100% Nuevo)': totalBarrasReq,
    'Aprovechamiento (%)': 0
  });

  const wsRequerimiento = XLSX.utils.json_to_sheet(requerimientoRows);
  XLSX.utils.book_append_sheet(workbook, wsRequerimiento, 'Requerimiento Total');

  if (hasStockComparison) {
    // -----------------------------------------------------------------
    // Hoja 2: Stock en Bodega (solo perfiles que sí se cotejaron)
    // -----------------------------------------------------------------
    const stockRows = groups
      .filter((g) => g.stockComparison && g.stockComparison.status !== 'not_in_catalog')
      .map((g) => {
        const mat = inventory.find((m) => m.id === g.matchedMaterialId);
        const barsTotal = mat?.standardBarsCount || 0;
        const barsReserved = mat ? getReservedBarsCount(mat) : 0;
        const barsAvailable = mat ? getAvailableBarsCount(mat) : 0;
        const offcutsAvailable = mat ? getAvailableOffcuts(mat).length : 0;
        const offcutsReserved = mat ? getReservedOffcuts(mat).length : 0;

        return {
          Perfil: g.cleanProfileCode,
          Calidad: mainGrade(g),
          'Barras Totales en Bodega': barsTotal,
          'Barras Reservadas (otro proyecto)': barsReserved,
          'Barras Disponibles': barsAvailable,
          'Retazos Disponibles': offcutsAvailable,
          'Retazos Reservados (otro proyecto)': offcutsReserved,
          'Se Usarán de Bodega (Barras)': g.stockComparison!.barsFromStock,
          'Se Usarán de Bodega (Retazos)': g.stockComparison!.offcutsFromStock
        };
      });

    if (stockRows.length > 0) {
      const wsStock = XLSX.utils.json_to_sheet(stockRows);
      XLSX.utils.book_append_sheet(workbook, wsStock, 'Stock en Bodega');
    }

    // -----------------------------------------------------------------
    // Hoja 3: Resumen de Compra (faltante neto, con calidad)
    // -----------------------------------------------------------------
    const compraRows = groups.map((g) => {
      const mat = inventory.find((m) => m.id === g.matchedMaterialId);
      return {
        Perfil: g.cleanProfileCode,
        Calidad: mainGrade(g),
        'Largo Comercial (m)': (g.commercialBarLengthMm / 1000).toFixed(1),
        'Barras a Comprar': g.stockComparison?.barsToBuy || 0,
        'Metros a Comprar': Number((g.stockComparison?.metersToBuy || 0).toFixed(2)),
        'Peso a Comprar (kg)': Number((g.stockComparison?.weightToBuyKg || 0).toFixed(2)),
        'Costo Estimado ($CLP)': mat
          ? Math.round((g.stockComparison?.metersToBuy || 0) * mat.costPerMeter)
          : 0
      };
    });

    const totalBarrasComprar = compraRows.reduce((s, r) => s + r['Barras a Comprar'], 0);
    const totalPesoComprar = compraRows.reduce((s, r) => s + r['Peso a Comprar (kg)'], 0);
    const totalMetrosComprar = compraRows.reduce((s, r) => s + r['Metros a Comprar'], 0);
    const totalCosto = compraRows.reduce((s, r) => s + r['Costo Estimado ($CLP)'], 0);
    compraRows.push({
      Perfil: 'TOTAL A COMPRAR',
      Calidad: '',
      'Largo Comercial (m)': '' as unknown as string,
      'Barras a Comprar': totalBarrasComprar,
      'Metros a Comprar': Number(totalMetrosComprar.toFixed(2)),
      'Peso a Comprar (kg)': Number(totalPesoComprar.toFixed(2)),
      'Costo Estimado ($CLP)': totalCosto
    });

    const wsCompra = XLSX.utils.json_to_sheet(compraRows);
    XLSX.utils.book_append_sheet(workbook, wsCompra, 'Resumen de Compra');
  }

  const cleanName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
  XLSX.writeFile(workbook, `Resumen_Cubicacion_${cleanName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
