import {
  CuttingPieceRequest,
  MaterialStockItem,
  OptimizationSettings,
  OptimizationResult,
  CutBarPlan,
  CutPieceDetail,
  OversizedPieceComparison
} from '../types';
import { COLOR_PALETTE } from '../data/initialStock';
import { getAvailableBarsCount, getAvailableOffcuts } from './stockReservations';
import { evaluateOversizedPieceOptions } from './oversizedPieceOptions';

interface FlatPiece {
  originalId: string;
  label: string;
  lengthMm: number;
  color: string;
  instanceIndex: number;
}

interface StockSourceOption {
  id: string;
  type: 'stock_offcut' | 'stock_standard_bar' | 'new_purchased_bar';
  lengthMm: number;
  offcutId?: string;
  location?: string;
  used: boolean;
}

export function run1DNestingOptimization(
  material: MaterialStockItem,
  piecesRequest: CuttingPieceRequest[],
  settings: OptimizationSettings
): OptimizationResult {
  const {
    kerfMm = 3,
    trimCutMm = 10,
    minUsableOffcutMm = 1000,
    prioritizeOffcuts = true
  } = settings;

  // 1. Flatten requested pieces
  const piecesToCut: FlatPiece[] = [];
  let colorIdx = 0;

  piecesRequest.forEach((req) => {
    if (req.lengthMm <= 0 || req.quantity <= 0) return;
    const pieceColor = req.color || COLOR_PALETTE[colorIdx % COLOR_PALETTE.length];
    colorIdx++;

    for (let q = 0; q < req.quantity; q++) {
      piecesToCut.push({
        originalId: req.id,
        label: req.label || `Pza ${req.lengthMm}mm`,
        lengthMm: req.lengthMm,
        color: pieceColor,
        instanceIndex: q + 1
      });
    }
  });

  const totalPiecesRequested = piecesToCut.length;
  if (totalPiecesRequested === 0) {
    return createEmptyResult();
  }

  // Check for pieces that exceed the longest possible bar (standard bar length or longest offcut)
  const maxPossibleLength = Math.max(
    material.standardBarLengthMm,
    ...material.offcuts.map((o) => o.lengthMm)
  );

  const validPieces = piecesToCut.filter(
    (p) => p.lengthMm + trimCutMm <= maxPossibleLength
  );
  const impossiblePieces = piecesToCut.filter(
    (p) => p.lengthMm + trimCutMm > maxPossibleLength
  );

  // Sort valid pieces descending by length (BFD - Best Fit Decreasing heuristic)
  validPieces.sort((a, b) => b.lengthMm - a.lengthMm);

  // 1.5 Piezas que no caben en NINGUNA barra/retazo existente: si está
  // habilitado, en vez de darlas por imposibles se evalúa comprar una barra
  // comercial más grande (si el material tiene largos alternativos) vs.
  // empalmarlas (barra estándar + tramo corto adicional), y se aplica
  // automáticamente la alternativa de menor desperdicio. La comparación se
  // recalcula PIEZA POR PIEZA (no una sola vez para todo el grupo del mismo
  // largo) contra el stock de retazos que va quedando: si solo hay un
  // retazo que alcanza para el tramo corto, únicamente la primera pieza lo
  // aprovecha vía empalme y el resto cae a la alternativa que en ese
  // momento tenga menos desperdicio. Cada alternativa elegida se modela
  // como 1-2 "barras" físicas más en `barPlans`, así se integra sin cambios
  // al resto del cálculo de totales.
  //
  // Simplificación: el segmento principal del empalme siempre se trata como
  // una barra NUEVA (no se intenta compartir el pool de barras estándar ya
  // en bodega con el packing normal de piezas cortas) — mantiene el cálculo
  // simple y da una estimación conservadora ("peor caso" de compra).
  const oversizedPieceComparisons: OversizedPieceComparison[] = [];
  const oversizedBarPlans: CutBarPlan[] = [];
  const consumedOffcutIdsForSplice = new Set<string>();
  const stillImpossible: FlatPiece[] = [];

  if (settings.allowMultipleStandardLengths && impossiblePieces.length > 0) {
    const byLength = new Map<number, FlatPiece[]>();
    impossiblePieces.forEach((p) => {
      const arr = byLength.get(p.lengthMm) || [];
      arr.push(p);
      byLength.set(p.lengthMm, arr);
    });

    byLength.forEach((instances, lengthMm) => {
      const firstOffcutSnapshot = getAvailableOffcuts(material).filter((o) => !consumedOffcutIdsForSplice.has(o.id));
      const comparison = evaluateOversizedPieceOptions(lengthMm, instances.length, material, settings, firstOffcutSnapshot);

      if (!comparison) {
        stillImpossible.push(...instances);
        return;
      }
      oversizedPieceComparisons.push(comparison);

      instances.forEach((piece) => {
        const offcutSnapshot = getAvailableOffcuts(material).filter((o) => !consumedOffcutIdsForSplice.has(o.id));
        const perInstance = evaluateOversizedPieceOptions(lengthMm, 1, material, settings, offcutSnapshot);
        if (!perInstance) {
          stillImpossible.push(piece);
          return;
        }
        const chosen = perInstance.options.find((o) => o.type === perInstance.recommendedType)!;
        const pieceKey = `${piece.originalId}_${piece.instanceIndex}`;

        if (chosen.type === 'bigger_bar') {
          oversizedBarPlans.push({
            id: `bar-plan-oversized-${oversizedBarPlans.length + 1}`,
            barIndex: 0,
            sourceType: 'new_purchased_bar',
            sourceLengthMm: chosen.barLengthUsedMm,
            sourceLocation: 'Por Comprar (barra comercial más grande)',
            cuts: [
              {
                pieceId: pieceKey,
                label: piece.label,
                lengthMm: piece.lengthMm,
                color: piece.color,
                cutIndex: 1,
                stopPositionMm: trimCutMm + piece.lengthMm
              }
            ],
            totalCutLengthMm: piece.lengthMm,
            kerfTotalMm: 0,
            trimCutMm,
            remainingMm: chosen.wasteMm,
            isReusableOffcut: chosen.wasteMm >= minUsableOffcutMm,
            efficiencyPercentage: Number(((piece.lengthMm / chosen.barLengthUsedMm) * 100).toFixed(2))
          });
        } else {
          // Empalme: dos barras físicas separadas para 1 sola pieza — el
          // tramo principal (barra estándar íntegra) y el tramo corto
          // adicional (de retazo si alcanzó uno, si no de barra nueva).
          oversizedBarPlans.push({
            id: `bar-plan-oversized-${oversizedBarPlans.length + 1}`,
            barIndex: 0,
            sourceType: 'new_purchased_bar',
            sourceLengthMm: chosen.barLengthUsedMm,
            sourceLocation: 'Empalme — tramo principal (barra estándar nueva)',
            cuts: [
              {
                pieceId: pieceKey,
                label: `${piece.label} (tramo principal)`,
                lengthMm: chosen.barLengthUsedMm,
                color: piece.color,
                cutIndex: 1,
                stopPositionMm: chosen.barLengthUsedMm
              }
            ],
            totalCutLengthMm: chosen.barLengthUsedMm,
            kerfTotalMm: 0,
            trimCutMm: 0,
            remainingMm: 0,
            isReusableOffcut: false,
            efficiencyPercentage: 100
          });

          const usedOffcut =
            chosen.extraSegmentSource === 'offcut'
              ? material.offcuts.find((o) => o.id === chosen.extraSegmentOffcutId)
              : undefined;
          if (usedOffcut) consumedOffcutIdsForSplice.add(usedOffcut.id);

          const extraSourceLengthMm = usedOffcut ? usedOffcut.lengthMm : chosen.barLengthUsedMm;
          const extraCutLengthMm = chosen.extraSegmentLengthMm || 0;
          const extraRemainingMm = Math.max(0, extraSourceLengthMm - extraCutLengthMm);

          oversizedBarPlans.push({
            id: `bar-plan-oversized-${oversizedBarPlans.length + 1}`,
            barIndex: 0,
            sourceType: usedOffcut ? 'stock_offcut' : 'new_purchased_bar',
            sourceLengthMm: extraSourceLengthMm,
            sourceOffcutId: usedOffcut?.id,
            sourceLocation: usedOffcut
              ? 'Empalme — tramo adicional (retazo de bodega)'
              : 'Empalme — tramo adicional (barra nueva)',
            cuts: [
              {
                pieceId: pieceKey,
                label: `${piece.label} (tramo adicional, incl. ${settings.spliceFacingLossMm ?? 90}mm de saneo de empalme)`,
                lengthMm: extraCutLengthMm,
                color: piece.color,
                cutIndex: 1,
                stopPositionMm: extraCutLengthMm
              }
            ],
            totalCutLengthMm: extraCutLengthMm,
            kerfTotalMm: 0,
            trimCutMm: 0,
            remainingMm: extraRemainingMm,
            isReusableOffcut: extraRemainingMm >= minUsableOffcutMm,
            efficiencyPercentage: Number(((extraCutLengthMm / extraSourceLengthMm) * 100).toFixed(2))
          });
        }
      });
    });
  } else {
    stillImpossible.push(...impossiblePieces);
  }

  oversizedBarPlans.forEach((p, idx) => {
    p.barIndex = idx + 1;
  });

  // 2. Prepare stock inventory pool
  const stockPool: StockSourceOption[] = [];

  // Add bodega offcuts if enabled — solo los que NO están reservados para
  // otro proyecto (offcut.reservedForProject) NI ya consumidos por una
  // resolución de empalme (consumedOffcutIdsForSplice).
  const availableOffcuts = getAvailableOffcuts(material).filter(
    (o) => !consumedOffcutIdsForSplice.has(o.id)
  );
  if (prioritizeOffcuts && availableOffcuts.length > 0) {
    // Sort offcuts ascending or descending? Ascending allows small offcuts to be consumed first for smaller pieces, but we evaluate best-fit dynamically
    const sortedOffcuts = [...availableOffcuts].sort((a, b) => a.lengthMm - b.lengthMm);
    sortedOffcuts.forEach((off) => {
      stockPool.push({
        id: `offcut-${off.id}`,
        type: 'stock_offcut',
        lengthMm: off.lengthMm,
        offcutId: off.id,
        location: off.location || 'Bodega Retazos',
        used: false
      });
    });
  }

  // Add available standard warehouse bars — descontando lo reservado
  // manualmente para otros proyectos (material.reservations).
  const availableBarsCount = getAvailableBarsCount(material);
  for (let i = 0; i < availableBarsCount; i++) {
    stockPool.push({
      id: `stock-bar-${i + 1}`,
      type: 'stock_standard_bar',
      lengthMm: material.standardBarLengthMm,
      location: material.location || 'Bodega Principal',
      used: false
    });
  }

  const barPlans: CutBarPlan[] = [...oversizedBarPlans];
  const unassignedPieces = [...validPieces];
  let barCounter = oversizedBarPlans.length + 1;

  // 3. Phase A: Try to fulfill pieces using existing offcuts first (if prioritized)
  if (prioritizeOffcuts) {
    const offcutSources = stockPool.filter((s) => s.type === 'stock_offcut' && !s.used);
    
    for (const offcut of offcutSources) {
      if (unassignedPieces.length === 0) break;

      const plan = tryPackBar(offcut, unassignedPieces, kerfMm, trimCutMm, minUsableOffcutMm, barCounter);
      if (plan && plan.cuts.length > 0) {
        offcut.used = true;
        barPlans.push(plan);
        barCounter++;

        // Remove packed pieces from unassigned list
        const packedIds = new Set(plan.cuts.map((c) => c.pieceId));
        let i = unassignedPieces.length;
        while (i--) {
          const pieceKey = `${unassignedPieces[i].originalId}_${unassignedPieces[i].instanceIndex}`;
          if (packedIds.has(pieceKey)) {
            unassignedPieces.splice(i, 1);
          }
        }
      }
    }
  }

  // 4. Phase B: Fulfill remaining pieces using standard stock bars
  const standardSources = stockPool.filter((s) => s.type === 'stock_standard_bar' && !s.used);
  for (const stdBar of standardSources) {
    if (unassignedPieces.length === 0) break;

    const plan = tryPackBar(stdBar, unassignedPieces, kerfMm, trimCutMm, minUsableOffcutMm, barCounter);
    if (plan && plan.cuts.length > 0) {
      stdBar.used = true;
      barPlans.push(plan);
      barCounter++;

      const packedIds = new Set(plan.cuts.map((c) => c.pieceId));
      let i = unassignedPieces.length;
      while (i--) {
        const pieceKey = `${unassignedPieces[i].originalId}_${unassignedPieces[i].instanceIndex}`;
        if (packedIds.has(pieceKey)) {
          unassignedPieces.splice(i, 1);
        }
      }
    }
  }

  // 5. Phase C: If pieces remain, use additional new purchased bars (unlimited virtual supply)
  while (unassignedPieces.length > 0) {
    const newBar: StockSourceOption = {
      id: `new-bar-${barCounter}`,
      type: 'new_purchased_bar',
      lengthMm: material.standardBarLengthMm,
      location: 'Por Comprar / Solicitar',
      used: true
    };

    const plan = tryPackBar(newBar, unassignedPieces, kerfMm, trimCutMm, minUsableOffcutMm, barCounter);
    if (!plan || plan.cuts.length === 0) {
      // Piece cannot fit even in a full bar
      break;
    }

    barPlans.push(plan);
    barCounter++;

    const packedIds = new Set(plan.cuts.map((c) => c.pieceId));
    let i = unassignedPieces.length;
    while (i--) {
      const pieceKey = `${unassignedPieces[i].originalId}_${unassignedPieces[i].instanceIndex}`;
      if (packedIds.has(pieceKey)) {
        unassignedPieces.splice(i, 1);
      }
    }
  }

  // 6. Aggregate results and statistics
  let totalRawMaterialLengthMm = 0;
  let totalUsefulCutsLengthMm = 0;
  let totalKerfLossMm = 0;
  let totalTrimLossMm = 0;
  let totalReusableOffcutsLengthMm = 0;
  let totalScrapWasteLengthMm = 0;
  let stockOffcutsUsed = 0;
  let stockStandardBarsUsed = 0;
  let newBarsToBuy = 0;
  let totalPiecesCut = 0;

  const generatedOffcuts: { lengthMm: number; barIndex: number }[] = [];

  barPlans.forEach((plan) => {
    totalRawMaterialLengthMm += plan.sourceLengthMm;
    totalUsefulCutsLengthMm += plan.totalCutLengthMm;
    totalKerfLossMm += plan.kerfTotalMm;
    totalTrimLossMm += plan.trimCutMm;

    if (plan.isReusableOffcut) {
      totalReusableOffcutsLengthMm += plan.remainingMm;
      generatedOffcuts.push({
        lengthMm: plan.remainingMm,
        barIndex: plan.barIndex
      });
    } else {
      totalScrapWasteLengthMm += plan.remainingMm;
    }

    if (plan.sourceType === 'stock_offcut') stockOffcutsUsed++;
    else if (plan.sourceType === 'stock_standard_bar') stockStandardBarsUsed++;
    else if (plan.sourceType === 'new_purchased_bar') newBarsToBuy++;

    totalPiecesCut += plan.cuts.length;
  });

  const overallEfficiencyPercentage =
    totalRawMaterialLengthMm > 0
      ? Number(((totalUsefulCutsLengthMm / totalRawMaterialLengthMm) * 100).toFixed(2))
      : 0;

  const totalWeightKg = Number(
    ((totalRawMaterialLengthMm / 1000) * material.theoreticalWeightPerMeter).toFixed(2)
  );
  const wasteWeightKg = Number(
    (((totalScrapWasteLengthMm + totalKerfLossMm + totalTrimLossMm) / 1000) * material.theoreticalWeightPerMeter).toFixed(2)
  );
  const estimatedCost = Math.round((totalRawMaterialLengthMm / 1000) * material.costPerMeter);

  // Gather missing pieces
  const missingPiecesMap = new Map<string, CuttingPieceRequest>();
  [...unassignedPieces, ...stillImpossible].forEach((p) => {
    if (!missingPiecesMap.has(p.originalId)) {
      missingPiecesMap.set(p.originalId, {
        id: p.originalId,
        lengthMm: p.lengthMm,
        quantity: 1,
        label: p.label,
        color: p.color
      });
    } else {
      const item = missingPiecesMap.get(p.originalId)!;
      item.quantity += 1;
    }
  });

  return {
    totalBarsUsed: barPlans.length,
    stockStandardBarsUsed,
    stockOffcutsUsed,
    newBarsToBuy,
    totalPiecesCut,
    totalPiecesRequested,
    totalRawMaterialLengthMm,
    totalUsefulCutsLengthMm,
    totalKerfLossMm,
    totalTrimLossMm,
    totalReusableOffcutsLengthMm,
    totalScrapWasteLengthMm,
    overallEfficiencyPercentage,
    totalWeightKg,
    wasteWeightKg,
    estimatedCost,
    barPlans,
    generatedOffcuts,
    missingPieces: Array.from(missingPiecesMap.values()),
    oversizedPieceComparisons: oversizedPieceComparisons.length > 0 ? oversizedPieceComparisons : undefined
  };
}

/**
 * Packs a single bar using a combination of Best-Fit / Knapsack heuristic with lookahead
 */
function tryPackBar(
  source: StockSourceOption,
  availablePieces: FlatPiece[],
  kerfMm: number,
  trimCutMm: number,
  minUsableOffcutMm: number,
  barIndex: number
): CutBarPlan | null {
  const barLength = source.lengthMm;
  const usableCapacity = barLength - trimCutMm;

  if (usableCapacity <= 0 || availablePieces.length === 0) {
    return null;
  }

  // Find best combination of pieces that fits in usableCapacity
  // Heuristic: First-Fit Decreasing with multi-element branch lookahead
  const selectedPieces: FlatPiece[] = [];
  let currentUsed = 0; // does not include trimCutMm

  for (let i = 0; i < availablePieces.length; i++) {
    const p = availablePieces[i];
    const neededWithKerf = selectedPieces.length === 0 ? p.lengthMm : p.lengthMm + kerfMm;

    if (currentUsed + neededWithKerf <= usableCapacity) {
      selectedPieces.push(p);
      currentUsed += neededWithKerf;
    }
  }

  if (selectedPieces.length === 0) {
    return null;
  }

  // Calculate cut details and cumulative stop positions for operator
  const cuts: CutPieceDetail[] = [];
  let cumulativeMm = trimCutMm;
  let totalCutsLength = 0;

  selectedPieces.forEach((p, idx) => {
    cumulativeMm += p.lengthMm;
    cuts.push({
      pieceId: `${p.originalId}_${p.instanceIndex}`,
      label: p.label,
      lengthMm: p.lengthMm,
      color: p.color,
      cutIndex: idx + 1,
      stopPositionMm: cumulativeMm
    });
    totalCutsLength += p.lengthMm;
    cumulativeMm += kerfMm; // add kerf for next cut
  });

  const kerfCount = Math.max(0, cuts.length - 1);
  const kerfTotalMm = kerfCount * kerfMm;
  const remainingMm = Math.max(0, barLength - (trimCutMm + totalCutsLength + kerfTotalMm));
  const isReusableOffcut = remainingMm >= minUsableOffcutMm;
  const efficiencyPercentage = Number(((totalCutsLength / barLength) * 100).toFixed(2));

  return {
    id: `bar-plan-${barIndex}`,
    barIndex,
    sourceType: source.type,
    sourceLengthMm: barLength,
    sourceOffcutId: source.offcutId,
    sourceLocation: source.location,
    cuts,
    totalCutLengthMm: totalCutsLength,
    kerfTotalMm,
    trimCutMm,
    remainingMm,
    isReusableOffcut,
    efficiencyPercentage
  };
}

function createEmptyResult(): OptimizationResult {
  return {
    totalBarsUsed: 0,
    stockStandardBarsUsed: 0,
    stockOffcutsUsed: 0,
    newBarsToBuy: 0,
    totalPiecesCut: 0,
    totalPiecesRequested: 0,
    totalRawMaterialLengthMm: 0,
    totalUsefulCutsLengthMm: 0,
    totalKerfLossMm: 0,
    totalTrimLossMm: 0,
    totalReusableOffcutsLengthMm: 0,
    totalScrapWasteLengthMm: 0,
    overallEfficiencyPercentage: 0,
    totalWeightKg: 0,
    wasteWeightKg: 0,
    estimatedCost: 0,
    barPlans: [],
    generatedOffcuts: [],
    missingPieces: []
  };
}
