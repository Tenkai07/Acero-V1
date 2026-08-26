import * as XLSX from 'xlsx';
import { BOMProfileGroup, MaterialStockItem } from '../types';
import { getAvailableBarsCount, getReservedBarsCount, getAvailableOffcuts, getReservedOffcuts } from './stockReservations';
import { groupBarPlansByPattern } from './cutPatternGrouping';

function mainGrade(group: BOMProfileGroup): string {
  return group.pieces[0]?.grade || 'A36';
}

/** Ancho de columna + autofiltro sobre todo el rango de datos, para que cada
 * hoja se pueda ordenar/filtrar directamente en Excel en vez de quedar como
 * un bloque de texto plano. */
function formatSheet(ws: XLSX.WorkSheet, colWidths: number[], rowCount: number) {
  ws['!cols'] = colWidths.map((wch) => ({ wch }));
  if (rowCount > 0) {
    const lastCol = XLSX.utils.encode_col(colWidths.length - 1);
    ws['!autofilter'] = { ref: `A1:${lastCol}${rowCount + 1}` };
  }
}

/**
 * Clasifica una fila de corte como empalme "Necesario" (la pieza no cabe en
 * NINGUNA barra real) o "Por Ahorro" (la pieza sí cabía en una barra real,
 * pero empalmarla con una más chica consume menos material total), o
 * "Directo" si no lleva empalme. El origen de la barra (`sourceLocation`)
 * solo es confiable cuando la barra tiene un único corte — cuando varios
 * tramos cortos de empalme comparten una misma barra nueva, esa barra
 * vuelve a un origen genérico ("Por Comprar / Solicitar") y la marca queda
 * solo en el texto de la pieza (`cutLabel`) — por eso se revisan ambos
 * juntos.
 */
function clasificarEmpalme(sourceLocation: string | undefined, cutLabel: string): { tipo: string; rol: string } {
  const combined = `${sourceLocation || ''} ${cutLabel}`;
  // Estrategia "tira empalmada": se sueldan dos barras del mismo largo
  // ANTES de cortar. Solo la pieza que queda sobre la unión lleva
  // soldadura; las demás piezas de esa tira salen enteras y son directas,
  // aunque su barra de origen diga "Tira empalmada".
  if (cutLabel.includes('empalmada sobre la unión')) {
    return { tipo: 'Empalme en Tira (2 barras pre-soldadas)', rol: 'Pieza sobre la unión' };
  }
  if (combined.includes('tramo principal')) {
    return { tipo: combined.includes('por ahorro') ? 'Empalme por Ahorro' : 'Empalme Necesario', rol: 'Tramo Principal' };
  }
  if (combined.includes('tramo adicional')) {
    return { tipo: combined.includes('por ahorro') ? 'Empalme por Ahorro' : 'Empalme Necesario', rol: 'Tramo Adicional' };
  }
  return { tipo: 'Directo (sin empalme)', rol: '' };
}

/**
 * Exporta el resumen consolidado de una cubicación a un Excel de hasta 4
 * hojas:
 *  1. "Requerimiento Total" — SIEMPRE se incluye: cuánta perfilería hace
 *     falta en total, 100% material nuevo, sin tocar bodega.
 *  2. "Detalle Barra por Barra" — el plan de corte completo, UNA FILA POR
 *     PIEZA (no una celda con todas las piezas de la barra concatenadas),
 *     para poder ordenar/filtrar y cotejar el cálculo a mano en Excel.
 *  3. "Stock en Bodega" — solo si se corrió el cotejo con inventario
 *     (`group.stockComparison` existe en al menos un perfil): qué hay
 *     disponible vs. reservado para otros proyectos.
 *  4. "Resumen de Compra" — solo junto con la hoja 3: el faltante neto a
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
    // Piezas demasiado largas para una barra estándar NI para un empalme
    // simple (necesitan empalme múltiple, resuelto en "2. Ajustar Medidas &
    // Empalmes", no acá) quedan fuera de "Barras Necesarias" y
    // "Aprovechamiento" — se muestran aparte para que la fila siga
    // cuadrando: Piezas Resueltas + Piezas Pendientes = Piezas totales.
    const piezasPendientes = result?.missingPieces.reduce((s, p) => s + p.quantity, 0) || 0;
    const metrosPendientes = (result?.missingPieces.reduce((s, p) => s + p.lengthMm * p.quantity, 0) || 0) / 1000;

    // Contar empalmes por tipo (1 por pieza empalmada = 1 fila "Tramo
    // Principal"), para ver de un vistazo cuántos son necesarios (la pieza
    // no cabía en ninguna barra real) vs. por ahorro (cabía, pero convino
    // igual) sin tener que abrir la hoja de detalle.
    let empalmesNecesarios = 0;
    let empalmesPorAhorro = 0;
    let empalmesEnTira = 0;
    result?.barPlans.forEach((plan) => {
      plan.cuts.forEach((cut) => {
        const { tipo, rol } = clasificarEmpalme(plan.sourceLocation, cut.label);
        if (rol === 'Pieza sobre la unión') {
          empalmesEnTira++;
          return;
        }
        if (rol !== 'Tramo Principal') return;
        if (tipo === 'Empalme Necesario') empalmesNecesarios++;
        else if (tipo === 'Empalme por Ahorro') empalmesPorAhorro++;
      });
    });

    return {
      Perfil: g.cleanProfileCode,
      Calidad: mainGrade(g),
      'Largo Comercial (m)': (g.commercialBarLengthMm / 1000).toFixed(1),
      'Piezas Totales': g.totalPiecesCount,
      'Piezas Resueltas': g.totalPiecesCount - piezasPendientes,
      'Piezas Pendientes (Empalme Múltiple)': piezasPendientes,
      'Empalmes Necesarios': empalmesNecesarios,
      'Empalmes por Ahorro': empalmesPorAhorro,
      'Empalmes en Tira (2 barras pre-soldadas)': empalmesEnTira,
      'Metros Lineales Netos (Totales)': Number((g.totalLengthMm / 1000).toFixed(2)),
      'Metros Pendientes (Empalme Múltiple)': Number(metrosPendientes.toFixed(2)),
      'Peso Total (kg)': Number(g.totalWeightKg.toFixed(2)),
      'Barras Necesarias (Piezas Resueltas)': result?.totalBarsUsed || 0,
      'Aprovechamiento (%) (Piezas Resueltas)': result?.overallEfficiencyPercentage || 0
    };
  });

  const totalBarrasReq = requerimientoRows.reduce((s, r) => s + r['Barras Necesarias (Piezas Resueltas)'], 0);
  const totalPesoReq = requerimientoRows.reduce((s, r) => s + r['Peso Total (kg)'], 0);
  const totalMetrosReq = requerimientoRows.reduce((s, r) => s + r['Metros Lineales Netos (Totales)'], 0);
  const totalMetrosPendientesReq = requerimientoRows.reduce((s, r) => s + r['Metros Pendientes (Empalme Múltiple)'], 0);
  const totalRawMm = groups.reduce((s, g) => s + (g.pureTheoreticalNestingResult?.totalRawMaterialLengthMm || 0), 0);
  const totalUsefulMm = groups.reduce((s, g) => s + (g.pureTheoreticalNestingResult?.totalUsefulCutsLengthMm || 0), 0);
  requerimientoRows.push({
    Perfil: 'TOTAL PROYECTO',
    Calidad: '',
    'Largo Comercial (m)': '' as unknown as string,
    'Piezas Totales': groups.reduce((s, g) => s + g.totalPiecesCount, 0),
    'Piezas Resueltas': requerimientoRows.reduce((s, r) => s + r['Piezas Resueltas'], 0),
    'Piezas Pendientes (Empalme Múltiple)': requerimientoRows.reduce((s, r) => s + r['Piezas Pendientes (Empalme Múltiple)'], 0),
    'Empalmes Necesarios': requerimientoRows.reduce((s, r) => s + (r['Empalmes Necesarios'] as number), 0),
    'Empalmes por Ahorro': requerimientoRows.reduce((s, r) => s + (r['Empalmes por Ahorro'] as number), 0),
    'Empalmes en Tira (2 barras pre-soldadas)': requerimientoRows.reduce(
      (s, r) => s + (r['Empalmes en Tira (2 barras pre-soldadas)'] as number),
      0
    ),
    'Metros Lineales Netos (Totales)': Number(totalMetrosReq.toFixed(2)),
    'Metros Pendientes (Empalme Múltiple)': Number(totalMetrosPendientesReq.toFixed(2)),
    'Peso Total (kg)': Number(totalPesoReq.toFixed(2)),
    'Barras Necesarias (Piezas Resueltas)': totalBarrasReq,
    // Ponderado por material real (no un promedio simple de % entre
    // perfiles), consistente con el número que muestra la app en pantalla.
    // Calculado solo sobre las piezas resueltas, igual que cada fila.
    'Aprovechamiento (%) (Piezas Resueltas)': totalRawMm > 0 ? Number(((totalUsefulMm / totalRawMm) * 100).toFixed(1)) : 0
  });

  const wsRequerimiento = XLSX.utils.json_to_sheet(requerimientoRows);
  formatSheet(wsRequerimiento, [16, 10, 14, 12, 13, 22, 16, 16, 26, 18, 22, 13, 18, 20], requerimientoRows.length);
  XLSX.utils.book_append_sheet(workbook, wsRequerimiento, 'Requerimiento Total');

  // -------------------------------------------------------------------
  // Hoja "Piezas Pendientes (Empalme Múltiple)": listado concreto de las
  // piezas que no entraron en el cálculo de arriba por ser más largas que
  // lo que cubre un solo empalme — para que quede visible qué falta
  // resolver a mano en "2. Ajustar Medidas & Empalmes" antes de comprar.
  // -------------------------------------------------------------------
  const pendientesRows: Record<string, string | number>[] = [];
  groups.forEach((g) => {
    (g.pureTheoreticalNestingResult?.missingPieces || []).forEach((p) => {
      pendientesRows.push({
        Perfil: g.cleanProfileCode,
        Calidad: mainGrade(g),
        Pieza: p.label,
        'Largo (mm)': p.lengthMm,
        Cantidad: p.quantity,
        'Metros Totales': Number(((p.lengthMm * p.quantity) / 1000).toFixed(2))
      });
    });
  });

  if (pendientesRows.length > 0) {
    const wsPendientes = XLSX.utils.json_to_sheet(pendientesRows);
    formatSheet(wsPendientes, [16, 10, 30, 12, 10, 14], pendientesRows.length);
    XLSX.utils.book_append_sheet(workbook, wsPendientes, 'Piezas Pendientes (Empalme)');
  }

  // -------------------------------------------------------------------
  // Hoja "Patrones de Corte": agrupa barras con EXACTAMENTE el mismo
  // patrón (mismo largo de origen y las mismas piezas con las mismas
  // cantidades) en una sola fila con su número de repeticiones — igual al
  // formato "layouts" de las herramientas de corte especializadas. Es un
  // resumen rápido; el detalle pieza por pieza sigue disponible en
  // "Detalle Barra por Barra" para cotejar a mano.
  // -------------------------------------------------------------------
  const patronesRows: Record<string, string | number>[] = [];
  groups.forEach((g) => {
    const result = g.pureTheoreticalNestingResult;
    if (!result) return;
    const patternGroups = groupBarPlansByPattern(result.barPlans);
    patternGroups.forEach((pg, idx) => {
      const plan = pg.representative;
      const piecesByLenLabel = new Map<string, number>();
      plan.cuts.forEach((c) => {
        const key = `${c.lengthMm}mm (${c.label})`;
        piecesByLenLabel.set(key, (piecesByLenLabel.get(key) || 0) + 1);
      });
      const piezasStr = Array.from(piecesByLenLabel.entries())
        .map(([k, qty]) => `${k} x${qty}`)
        .join('  +  ');

      patronesRows.push({
        Perfil: g.cleanProfileCode,
        Calidad: mainGrade(g),
        'N° Patrón': idx + 1,
        Origen: plan.sourceLocation || plan.sourceType,
        'Largo Barra (mm)': plan.sourceLengthMm,
        Piezas: piezasStr,
        Repeticiones: pg.repeatCount,
        'Sobrante por Barra (mm)': plan.remainingMm,
        'Sobrante Total del Patrón (mm)': pg.totalRemainingMm,
        '¿Retazo Reutilizable?': plan.isReusableOffcut ? 'Sí' : 'No'
      });
    });
  });

  if (patronesRows.length > 0) {
    const wsPatrones = XLSX.utils.json_to_sheet(patronesRows);
    formatSheet(wsPatrones, [16, 10, 10, 32, 14, 55, 13, 18, 22, 16], patronesRows.length);
    XLSX.utils.book_append_sheet(workbook, wsPatrones, 'Patrones de Corte');
  }

  // -------------------------------------------------------------------
  // Hoja "Detalle Barra por Barra": el plan de corte completo (Etapa 1,
  // 100% material nuevo), UNA FILA POR PIEZA CORTADA — no una sola celda
  // con todas las piezas de la barra concatenadas — para que se pueda
  // ordenar/filtrar en Excel igual que cualquier planilla de corte, y para
  // cotejar el cálculo pieza por pieza, no solo el % resumido por perfil.
  // Los datos de la barra (origen, largo, sobrante, eficiencia) se repiten
  // en cada fila de sus piezas: es más largo, pero se filtra sin perder
  // contexto (formato "plano" estándar de lista de corte).
  // -------------------------------------------------------------------
  // "ID Pieza" permite filtrar/agrupar el tramo principal y el tramo
  // adicional de una misma pieza empalmada aunque terminen en barras
  // distintas (ver `clasificarEmpalme` arriba para el resto del contexto).
  const detalleRows: Record<string, string | number>[] = [];
  groups.forEach((g) => {
    const result = g.pureTheoreticalNestingResult;
    if (!result) return;
    result.barPlans.forEach((plan) => {
      plan.cuts.forEach((cut) => {
        const { tipo, rol } = clasificarEmpalme(plan.sourceLocation, cut.label);
        detalleRows.push({
          Perfil: g.cleanProfileCode,
          Calidad: mainGrade(g),
          'ID Pieza': cut.pieceId,
          'N° Barra': plan.barIndex,
          Origen: plan.sourceLocation || plan.sourceType,
          'Tipo de Empalme': tipo,
          'Rol en Empalme': rol,
          'Largo Barra (mm)': plan.sourceLengthMm,
          'N° Corte': cut.cutIndex,
          Pieza: cut.label,
          'Largo Pieza (mm)': cut.lengthMm,
          'Tope Acumulado (mm)': cut.stopPositionMm,
          'Sobrante Barra (mm)': plan.remainingMm,
          '¿Retazo Reutilizable?': plan.isReusableOffcut ? 'Sí' : 'No',
          'Eficiencia Barra (%)': plan.efficiencyPercentage
        });
      });
    });
  });

  if (detalleRows.length > 0) {
    const wsDetalle = XLSX.utils.json_to_sheet(detalleRows);
    formatSheet(wsDetalle, [16, 10, 22, 9, 30, 18, 16, 14, 9, 30, 14, 16, 15, 14, 14], detalleRows.length);
    XLSX.utils.book_append_sheet(workbook, wsDetalle, 'Detalle Barra por Barra');
  }

  if (hasStockComparison) {
    // -----------------------------------------------------------------
    // Hoja: Stock en Bodega (solo perfiles que sí se cotejaron)
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
      formatSheet(wsStock, [16, 10, 18, 20, 16, 16, 20, 18, 18], stockRows.length);
      XLSX.utils.book_append_sheet(workbook, wsStock, 'Stock en Bodega');
    }

    // -----------------------------------------------------------------
    // Hoja: Resumen de Compra (faltante neto, con calidad)
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
    formatSheet(wsCompra, [16, 10, 16, 14, 14, 14, 16], compraRows.length);
    XLSX.utils.book_append_sheet(workbook, wsCompra, 'Resumen de Compra');
  }

  const cleanName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
  XLSX.writeFile(workbook, `Resumen_Cubicacion_${cleanName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
