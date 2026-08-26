import {
  BOMProfileGroup,
  MaterialStockItem,
  OptimizationSettings,
  OptimizationResult,
  CuttingPieceRequest
} from '../types';
import { run1DNestingOptimization } from './nesting1D';
import { runSplicedStripNesting } from './splicedBarStrategy';
import { COLOR_PALETTE } from '../data/initialStock';
import { getReservedBarsCount, getReservedOffcuts } from './stockReservations';
import { inferAlternateBarLengths, canonicalProfileCode } from './commercialLengths';

/**
 * Cuántas semillas de multi-arranque se prueban por perfil además de la
 * corrida determinista (ver `randomSeed` en OptimizationSettings).
 *
 * En 0 a propósito, con evidencia: se midió sobre el proyecto real P420
 * (67 perfiles, 2295 piezas) con 60 semillas por perfil y el resultado fue
 * EXACTAMENTE el mismo (1362 barras, 14.262m) tardando 17,9s en vez de
 * 4,7s. En el perfil más difícil (RHS100X5) se probaron 300 semillas y las
 * 300 dieron el mismo número de barras. O sea: el multi-arranque sobre
 * este heurístico no escapa del óptimo local, solo cuesta tiempo.
 *
 * Se deja la infraestructura porque el hallazgo es útil: si algún día se
 * cambia el heurístico de llenado, subir este número vuelve a tener
 * sentido y ya está todo conectado. Mientras tanto, 0 = sin costo.
 */
const MULTISTART_SEEDS = 0;

export interface ConsolidatedPurchaseReport {
  totalProfilesCount: number;
  totalPiecesCount: number;
  totalLengthMeters: number;
  totalWeightKg: number;
  
  // Theoretical total requirement (from scratch without stock)
  totalTheoreticalBarsNeeded: number;
  totalTheoreticalMetersNeeded: number;
  totalTheoreticalWeightKg: number;
  
  // Stock vs Buy breakdown
  totalBarsFromStock: number;
  totalOffcutsFromStock: number;
  totalBarsToBuy: number;
  totalMetersToBuy: number;
  totalWeightToBuyKg: number;
  estimatedCostToBuy: number;
  
  // Savings achieved with warehouse stock
  totalBarsSavedFromStock: number;
  totalMetersSavedFromStock: number;
  totalWeightSavedFromStock: number;
  
  profilesToBuy: {
    profileName: string;
    cleanCode: string;
    commercialBarLengthMm: number;
    grade: string;
    theoreticalBarsNeeded: number;
    barsToBuy: number;
    metersToBuy: number;
    weightKg: number;
    barsInStock: number;
    offcutsInStock: number;
    unitWeightKgM: number;
    estimatedCost: number;
  }[];

  profilesInStockReady: {
    profileName: string;
    cleanCode: string;
    theoreticalBarsNeeded: number;
    barsUsedFromStock: number;
    offcutsUsedFromStock: number;
    totalPieces: number;
    efficiencyPercentage: number;
  }[];
}

/**
 * Junta en un solo grupo los perfiles que son EL MISMO material escrito de
 * distinta forma (ver `canonicalProfileCode`: "RHS150X6" = "RHS150X150X6").
 * Se conserva el id y el material vinculado del primer grupo, y se muestra
 * el código canónico corto.
 */
function mergeEquivalentProfileGroups(groups: BOMProfileGroup[]): BOMProfileGroup[] {
  const byCanonical = new Map<string, BOMProfileGroup[]>();
  groups.forEach((g) => {
    const key = canonicalProfileCode(g.cleanProfileCode);
    const list = byCanonical.get(key);
    if (list) list.push(g);
    else byCanonical.set(key, [g]);
  });

  const result: BOMProfileGroup[] = [];
  byCanonical.forEach((list, canonicalCode) => {
    if (list.length === 1) {
      result.push(list[0]);
      return;
    }
    result.push({
      ...list[0],
      cleanProfileCode: canonicalCode,
      pieces: list.flatMap((g) => g.pieces),
      totalPiecesCount: list.reduce((s, g) => s + g.totalPiecesCount, 0),
      totalLengthMm: list.reduce((s, g) => s + g.totalLengthMm, 0),
      totalWeightKg: list.reduce((s, g) => s + g.totalWeightKg, 0),
      // Si alguno de los grupos sí quedó vinculado a un material de bodega,
      // ese vínculo vale para el grupo fusionado.
      matchedMaterialId: list.find((g) => g.matchedMaterialId)?.matchedMaterialId
    });
  });
  return result;
}

/**
 * Runs 1D Pre-Nesting and Warehouse Stock Analysis for an entire multi-profile BOM project
 */
export function runProjectPreNesting(
  groupsRaw: BOMProfileGroup[],
  inventory: MaterialStockItem[],
  settings: OptimizationSettings
): {
  updatedGroups: BOMProfileGroup[];
  consolidatedReport: ConsolidatedPurchaseReport;
} {
  // Un mismo perfil puede venir escrito de dos formas en la planilla
  // ("RHS150X6" y "RHS150X150X6" son el mismo tubo cuadrado). Si se dejan
  // separados, sus piezas nunca se combinan entre sí y se compra material
  // de más — en el proyecto real P420 costaba ~144m de acero. Se agrupan
  // ANTES de anidar para que compitan por las mismas barras.
  const groups = mergeEquivalentProfileGroups(groupsRaw);

  const updatedGroups: BOMProfileGroup[] = [];

  let totalPiecesCount = 0;
  let totalLengthMeters = 0;
  let totalWeightKg = 0;

  let totalTheoreticalBarsNeeded = 0;
  let totalTheoreticalMetersNeeded = 0;
  let totalTheoreticalWeightKg = 0;

  let totalBarsFromStock = 0;
  let totalOffcutsFromStock = 0;
  let totalBarsToBuy = 0;
  let totalMetersToBuy = 0;
  let totalWeightToBuyKg = 0;
  let estimatedCostToBuy = 0;

  const profilesToBuy: ConsolidatedPurchaseReport['profilesToBuy'] = [];
  const profilesInStockReady: ConsolidatedPurchaseReport['profilesInStockReady'] = [];

  groups.forEach((group, gIdx) => {
    // Convert BOM pieces to CuttingPieceRequests
    const pieceRequests: CuttingPieceRequest[] = [];
    let colorIdx = 0;

    group.pieces.forEach((p) => {
      pieceRequests.push({
        id: p.id,
        label: p.itemNumber,
        lengthMm: p.lengthMm,
        quantity: p.quantity,
        color: COLOR_PALETTE[(gIdx * 3 + colorIdx) % COLOR_PALETTE.length],
        grade: p.grade,
        weightKg: p.weightKg,
        areaM2: p.areaM2,
        originalLengthMm: p.originalLengthMm,
        isSpliced: p.isSpliced
      });
      colorIdx++;
    });

    // Find or create a virtual stock item if not in catalog
    const matchedMat = inventory.find((m) => m.id === group.matchedMaterialId);

    // Calculate theoretical weight per meter
    const totalGroupLengthM = group.totalLengthMm / 1000;
    const derivedKgM =
      totalGroupLengthM > 0 && group.totalWeightKg > 0
        ? group.totalWeightKg / totalGroupLengthM
        : matchedMat?.theoreticalWeightPerMeter || 5.0;

    // Largos comerciales candidatos para este perfil: el estándar de 6m
    // siempre se evalúa, más cualquier largo alternativo — manual si el
    // material ya lo tiene configurado en bodega, o inferido automáticamente
    // por tipo de perfil/espesor si no (ej. tubulares RHS/SHS: 6m y 12m
    // siempre; ángulos: 6m salvo que sean gruesos ≥8mm).
    const alternateLengths =
      matchedMat?.alternateBarLengthsMm || inferAlternateBarLengths(group.cleanProfileCode, matchedMat?.category) || [];
    const candidateLengths = Array.from(
      new Set([group.commercialBarLengthMm || matchedMat?.standardBarLengthMm || 6000, 6000, ...alternateLengths])
    );

    // El largo "principal" (para mostrar en la ficha del grupo y para
    // materiales ya en bodega, cuyo stock físico real está a un largo fijo)
    // sigue siendo el registrado en inventario si existe; si es un material
    // "virtual" (aún no en bodega) se usa el primero de los candidatos —ya
    // no importa mucho cuál, porque abajo se elige el mejor largo BARRA POR
    // BARRA, no uno solo fijo para todo el lote.
    const barLength = matchedMat?.standardBarLengthMm || candidateLengths[0];

    const pureTheoreticalMaterial: MaterialStockItem = {
      id: `pure-theo-${group.id}`,
      code: group.cleanProfileCode,
      name: group.profileName,
      category: matchedMat?.category || 'otro',
      dimensions: group.cleanProfileCode,
      grade: group.pieces[0]?.grade || 'A36',
      theoreticalWeightPerMeter: derivedKgM,
      costPerMeter: matchedMat?.costPerMeter || derivedKgM * 1400,
      standardBarLengthMm: barLength,
      standardBarsCount: 0,
      offcuts: [],
      minStockBars: 0,
      location: 'Material Nuevo',
      lastUpdated: new Date().toISOString(),
      // Sin esto, evaluateOversizedPieceOptions solo veía UN largo (el de
      // standardBarLengthMm) al decidir empalmes, perdiendo la posibilidad
      // de combinar 6m+12m o 12m+12m — quedaba igual de limitado que antes
      // de "profundizar" el empalme multi-largo.
      alternateBarLengthsMm: alternateLengths.length > 0 ? alternateLengths : undefined
    };

    // 1. PURE THEORETICAL 1D NESTING (100% new bars, 0 stock) — el usuario
    // confirmó que SIEMPRE se compra de UN SOLO largo comercial por
    // perfil: es lo que se cotiza con el proveedor (una orden de compra
    // mezclando 6m y 12m no se puede cotizar limpio). Por eso NUNCA se usa
    // una corrida "mixta" (varios largos a la vez) como resultado oficial
    // — se prueba CADA largo candidato como escenario de largo único
    // completo (empaque normal + cualquier empalme, todo a ese mismo
    // largo) y se elige el que resuelva más piezas y, entre esos, el que
    // use menos material bruto total.
    // Se evalúan TODAS las combinaciones de:
    //   · cada largo comercial candidato (como escenario de largo único),
    //   · cortar barra por barra vs. "tira empalmada" (dos barras del mismo
    //     largo soldadas ANTES de cortar, ej. 12m+12m=24m — cuando dos
    //     piezas medianas no caben en una barra pero tres sí caben en dos
    //     soldadas, esto reduce muchísimo el desperdicio),
    //   · llenado heurístico rápido vs. llenado óptimo por barra (knapsack).
    // …y gana la que compre menos material sin dejar más piezas pendientes.
    // Ninguna de las dos últimas domina siempre: el llenado óptimo por
    // barra a veces deja piezas huérfanas que empeoran el total del perfil,
    // así que se comparan de verdad en vez de asumir cuál es mejor.
    const theoreticalSettings = { ...settings, prioritizeOffcuts: false };
    let pureTheoreticalNestingResult: OptimizationResult | null = null;
    let pureTheoreticalLen = candidateLengths[0];

    const considerTheoretical = (candidate: OptimizationResult | null, len: number) => {
      if (!candidate) return;
      if (!pureTheoreticalNestingResult) {
        pureTheoreticalNestingResult = candidate;
        pureTheoreticalLen = len;
        return;
      }
      const best = pureTheoreticalNestingResult;
      const better =
        candidate.missingPieces.length < best.missingPieces.length ||
        (candidate.missingPieces.length === best.missingPieces.length &&
          (candidate.totalRawMaterialLengthMm < best.totalRawMaterialLengthMm ||
            // A igual material (empate exacto, típico cuando un largo es
            // múltiplo entero de otro, ej. 12m=2×6m), preferir el largo
            // MAYOR: mismo material, menos barras que comprar y manipular.
            (candidate.totalRawMaterialLengthMm === best.totalRawMaterialLengthMm && len > pureTheoreticalLen)));
      if (better) {
        pureTheoreticalNestingResult = candidate;
        pureTheoreticalLen = len;
      }
    };

    // `undefined` = corrida determinista (siempre el mejor llenado local).
    // Los números son semillas de multi-arranque: cada una explora una
    // solución distinta y nos quedamos con la mejor del perfil completo.
    // Es lo que permite escapar del atasco típico del anidado voraz —
    // llenar las primeras barras al máximo consume las piezas chicas que
    // después harían falta para completar las últimas.
    const seeds: (number | undefined)[] = [undefined];
    for (let s = 1; s <= MULTISTART_SEEDS; s++) seeds.push(s * 7919);

    for (const exact of [false, true]) {
      for (const seed of seeds) {
        // El knapsack exacto es caro; con él basta la corrida determinista
        // (ya busca el óptimo de cada barra, el azar aporta mucho menos).
        if (exact && seed !== undefined) continue;
        const variantSettings = { ...theoreticalSettings, useExactFill: exact, randomSeed: seed };
        for (const len of candidateLengths) {
          considerTheoretical(
            run1DNestingOptimization(pureTheoreticalMaterial, pieceRequests, variantSettings, [len]),
            len
          );
          if (settings.allowMultipleStandardLengths) {
            considerTheoretical(runSplicedStripNesting(pureTheoreticalMaterial, pieceRequests, variantSettings, len), len);
          }
        }
      }
    }
    if (!pureTheoreticalNestingResult) {
      pureTheoreticalNestingResult = run1DNestingOptimization(
        pureTheoreticalMaterial,
        pieceRequests,
        theoreticalSettings,
        [candidateLengths[0]]
      );
    }
    // El largo "predominante" real (para mostrar en pantalla/Excel) es el
    // más usado entre las barras nuevas del resultado ganador — nunca
    // simplemente el primer candidato de la lista, que no necesariamente
    // es el que terminó usándose (ej. si ganó "fijo a 12m", mostrar "6m"
    // sería directamente incorrecto).
    const newBarLengthCounts = new Map<number, number>();
    pureTheoreticalNestingResult.barPlans
      .filter((p) => p.sourceType === 'new_purchased_bar')
      .forEach((p) => newBarLengthCounts.set(p.sourceLengthMm, (newBarLengthCounts.get(p.sourceLengthMm) || 0) + 1));
    // Si ganó la estrategia de tira empalmada, los `sourceLengthMm` de sus
    // planes son el largo de la TIRA (ej. 24m), no el de la barra que se
    // compra (12m) — el largo comercial a mostrar/cotizar es el simple.
    const bestLength =
      pureTheoreticalNestingResult.splicedStripsCount !== undefined
        ? pureTheoreticalLen
        : [...newBarLengthCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || candidateLengths[0];

    // 2. STOCK-OPTIMIZED 1D NESTING (Consumes warehouse offcuts and stock bars first)
    const effectiveMaterial: MaterialStockItem = matchedMat
      ? { ...matchedMat, standardBarLengthMm: barLength }
      : {
          id: `virtual-${group.id}`,
          code: group.cleanProfileCode,
          name: group.profileName,
          category: 'otro',
          dimensions: group.cleanProfileCode,
          grade: group.pieces[0]?.grade || 'A36',
          theoreticalWeightPerMeter: derivedKgM,
          costPerMeter: derivedKgM * 1400,
          standardBarLengthMm: barLength,
          standardBarsCount: 0,
          offcuts: [],
          minStockBars: 0,
          location: 'No registrado en bodega',
          lastUpdated: new Date().toISOString(),
          alternateBarLengthsMm: alternateLengths.length > 0 ? alternateLengths : undefined
        };

    // Igual que en el cálculo teórico: se prueba cada largo comercial como
    // escenario de largo único completo (nunca una mezcla) y se elige el
    // que compre MENOS material nuevo en total — el stock existente en
    // bodega es el mismo en cualquier caso, lo único que cambia entre
    // variantes es cuánto y de qué largo hay que comprar.
    const newBoughtLengthMm = (r: OptimizationResult) =>
      r.barPlans.filter((p) => p.sourceType === 'new_purchased_bar').reduce((s, p) => s + p.sourceLengthMm, 0);

    let nestingRes: OptimizationResult | null = null;
    let nestingResLen = candidateLengths[0];

    const considerStock = (candidate: OptimizationResult | null, len: number) => {
      if (!candidate) return;
      if (!nestingRes) {
        nestingRes = candidate;
        nestingResLen = len;
        return;
      }
      const best = nestingRes;
      const better =
        candidate.missingPieces.length < best.missingPieces.length ||
        (candidate.missingPieces.length === best.missingPieces.length &&
          (newBoughtLengthMm(candidate) < newBoughtLengthMm(best) ||
            (newBoughtLengthMm(candidate) === newBoughtLengthMm(best) && len > nestingResLen)));
      if (better) {
        nestingRes = candidate;
        nestingResLen = len;
      }
    };

    // Mismas variantes que en el teórico. Ojo con la tira empalmada: se
    // arma solo con barras NUEVAS (el stock de bodega está a largo simple),
    // así que renuncia a consumir bodega — por eso la comparación es sobre
    // cuánto material NUEVO compra cada alternativa, que es justo lo que
    // cambia entre ellas.
    for (const exact of [false, true]) {
      for (const seed of seeds) {
        if (exact && seed !== undefined) continue;
        const variantSettings = { ...settings, useExactFill: exact, randomSeed: seed };
        for (const len of candidateLengths) {
          considerStock(run1DNestingOptimization(effectiveMaterial, pieceRequests, variantSettings, [len]), len);
          if (settings.allowMultipleStandardLengths) {
            considerStock(runSplicedStripNesting(effectiveMaterial, pieceRequests, variantSettings, len), len);
          }
        }
      }
    }
    if (!nestingRes) {
      nestingRes = run1DNestingOptimization(effectiveMaterial, pieceRequests, settings, [candidateLengths[0]]);
    }

    // Stock check
    const stockBarsAvail = effectiveMaterial.standardBarsCount;
    const stockOffcutsAvail = effectiveMaterial.offcuts.length;
    const barsNeededTotal = nestingRes.totalBarsUsed;
    const barsFromStock = nestingRes.stockStandardBarsUsed;
    const offcutsFromStock = nestingRes.stockOffcutsUsed;
    const barsToBuy = nestingRes.newBarsToBuy;

    // El mix comprado puede tener varios largos (ej. algunas barras de 6m y
    // otras de 12m) — se calculan los metros reales sumando cada barra
    // comprada por su propio largo, en vez de asumir un único largo fijo.
    const newBarPlans = nestingRes.barPlans.filter((p) => p.sourceType === 'new_purchased_bar');
    const metersToBuy = newBarPlans.reduce((s, p) => s + p.sourceLengthMm, 0) / 1000;
    const weightToBuyKg = Number((metersToBuy * effectiveMaterial.theoreticalWeightPerMeter).toFixed(2));
    const costToBuy = Math.round(metersToBuy * effectiveMaterial.costPerMeter);
    const buyBreakdownByLength = new Map<number, number>();
    newBarPlans.forEach((p) => {
      // En la estrategia de tira empalmada cada "plan" es una tira de 2
      // barras (ej. 24m): se cotiza y se compra el largo SIMPLE (12m), dos
      // por tira — mostrar "41 de 24m" sería pedirle al proveedor un largo
      // que no fabrica.
      const isStrip = nestingRes.splicedStripsCount !== undefined;
      const purchasedLen = isStrip ? p.sourceLengthMm / 2 : p.sourceLengthMm;
      const purchasedQty = isStrip ? 2 : 1;
      buyBreakdownByLength.set(purchasedLen, (buyBreakdownByLength.get(purchasedLen) || 0) + purchasedQty);
    });
    const buyBreakdownLabel = Array.from(buyBreakdownByLength.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([len, count]) => `${count} de ${(len / 1000).toLocaleString('es-CL')}m`)
      .join(' + ');

    const hasEnoughStock = barsToBuy === 0;
    const status = !matchedMat
      ? 'not_in_catalog'
      : hasEnoughStock
      ? 'in_stock'
      : 'need_buy';

    const stockBarsReserved = matchedMat ? getReservedBarsCount(effectiveMaterial) : 0;
    const stockOffcutsReserved = matchedMat ? getReservedOffcuts(effectiveMaterial).length : 0;
    const reservedNote =
      stockBarsReserved > 0 || stockOffcutsReserved > 0
        ? ` (bodega tiene además ${stockBarsReserved} barra(s) y ${stockOffcutsReserved} retazo(s) reservados para otro proyecto — no se ofrecieron)`
        : '';

    const message =
      (hasEnoughStock
        ? `✅ Stock suficiente en bodega (Consumo: ${barsFromStock} barras + ${offcutsFromStock} retazos)`
        : `🛒 Debes comprar ${barsToBuy} barras (${buyBreakdownLabel || `${(effectiveMaterial.standardBarLengthMm / 1000).toFixed(0)}m`}) — ${metersToBuy.toFixed(2)} m totales`) +
      reservedNote;

    const updatedGroup: BOMProfileGroup = {
      ...group,
      commercialBarLengthMm: bestLength,
      pureTheoreticalNestingResult,
      nestingResult: nestingRes,
      stockComparison: {
        status,
        stockBarsAvailable: stockBarsAvail,
        stockOffcutsAvailable: stockOffcutsAvail,
        stockBarsReserved,
        stockOffcutsReserved,
        barsNeededTotal,
        barsFromStock,
        offcutsFromStock,
        barsToBuy,
        metersToBuy,
        weightToBuyKg,
        message
      }
    };

    updatedGroups.push(updatedGroup);

    // Global aggregations
    totalPiecesCount += group.totalPiecesCount;
    totalLengthMeters += totalGroupLengthM;
    totalWeightKg += group.totalWeightKg;

    const groupTheoBars = pureTheoreticalNestingResult.totalBarsUsed;
    const groupTheoMeters = pureTheoreticalNestingResult.totalRawMaterialLengthMm / 1000;
    const groupTheoWeight = groupTheoMeters * derivedKgM;

    totalTheoreticalBarsNeeded += groupTheoBars;
    totalTheoreticalMetersNeeded += groupTheoMeters;
    totalTheoreticalWeightKg += groupTheoWeight;

    totalBarsFromStock += barsFromStock;
    totalOffcutsFromStock += offcutsFromStock;
    totalBarsToBuy += barsToBuy;
    totalMetersToBuy += metersToBuy;
    totalWeightToBuyKg += weightToBuyKg;
    estimatedCostToBuy += costToBuy;

    if (barsToBuy > 0) {
      profilesToBuy.push({
        profileName: group.profileName,
        cleanCode: group.cleanProfileCode,
        commercialBarLengthMm: effectiveMaterial.standardBarLengthMm,
        grade: group.pieces[0]?.grade || 'A36',
        theoreticalBarsNeeded: groupTheoBars,
        barsToBuy,
        metersToBuy,
        weightKg: weightToBuyKg,
        barsInStock: stockBarsAvail,
        offcutsInStock: stockOffcutsAvail,
        unitWeightKgM: effectiveMaterial.theoreticalWeightPerMeter,
        estimatedCost: costToBuy
      });
    } else {
      profilesInStockReady.push({
        profileName: group.profileName,
        cleanCode: group.cleanProfileCode,
        theoreticalBarsNeeded: groupTheoBars,
        barsUsedFromStock: barsFromStock,
        offcutsUsedFromStock: offcutsFromStock,
        totalPieces: group.totalPiecesCount,
        efficiencyPercentage: nestingRes.overallEfficiencyPercentage
      });
    }
  });

  const totalBarsSaved = Math.max(0, totalTheoreticalBarsNeeded - totalBarsToBuy);
  const totalMetersSaved = Math.max(0, totalTheoreticalMetersNeeded - totalMetersToBuy);
  const totalWeightSaved = Math.max(0, totalTheoreticalWeightKg - totalWeightToBuyKg);

  const consolidatedReport: ConsolidatedPurchaseReport = {
    totalProfilesCount: groups.length,
    totalPiecesCount,
    totalLengthMeters: Number(totalLengthMeters.toFixed(2)),
    totalWeightKg: Number(totalWeightKg.toFixed(2)),
    totalTheoreticalBarsNeeded,
    totalTheoreticalMetersNeeded: Number(totalTheoreticalMetersNeeded.toFixed(2)),
    totalTheoreticalWeightKg: Number(totalTheoreticalWeightKg.toFixed(2)),
    totalBarsFromStock,
    totalOffcutsFromStock,
    totalBarsToBuy,
    totalMetersToBuy: Number(totalMetersToBuy.toFixed(2)),
    totalWeightToBuyKg: Number(totalWeightToBuyKg.toFixed(2)),
    estimatedCostToBuy,
    totalBarsSavedFromStock: totalBarsSaved,
    totalMetersSavedFromStock: Number(totalMetersSaved.toFixed(2)),
    totalWeightSavedFromStock: Number(totalWeightSaved.toFixed(2)),
    profilesToBuy,
    profilesInStockReady
  };

  return { updatedGroups, consolidatedReport };
}
