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
import { getSpliceFacingLossMm } from './commercialLengths';

interface FlatPiece {
  originalId: string;
  label: string;
  lengthMm: number;
  color: string;
  instanceIndex: number;
  // Tramo corto de empalme (no una pieza real del proyecto) — varios
  // tramos, de piezas distintas, SÍ pueden compartir una misma barra nueva
  // (ej. el sobrante de cortar el tramo de una pieza se reutiliza para el
  // tramo de la siguiente). Lo que nunca ocurre es que una misma PIEZA
  // final lleve dos tramos de empalme, pero eso ya está garantizado porque
  // cada pieza oversized genera un único filler.
  isSpliceFiller?: boolean;
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
  settings: OptimizationSettings,
  candidateBarLengthsMm?: number[]
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

  // Check for pieces that exceed the longest possible bar (standard bar
  // length, longest offcut, o el mayor largo candidato pasado explícitamente
  // — sin esto, una pieza de 8m se marcaba "imposible" solo por mirar el
  // largo estándar de 6m, aunque se le hubiera pasado 12m como candidato).
  const maxPossibleLength = Math.max(
    material.standardBarLengthMm,
    ...(candidateBarLengthsMm || []),
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
  // Tramos cortos de empalme que necesitan barra nueva (sin retazo que les
  // alcance) — se anidan junto con el resto de las piezas normales en vez
  // de comprarles una barra dedicada cada uno, para que varios tramos
  // cortos puedan compartir una misma barra nueva si caben juntos.
  const spliceFillerPieces: FlatPiece[] = [];

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

          // El tramo corto adicional NO se resuelve aquí con una barra
          // dedicada — se le sigue prefiriendo un retazo existente si
          // alcanza (chosen.extraSegmentSource==='offcut', ya decidido por
          // evaluateOversizedPieceOptions), pero si hace falta una barra
          // nueva, ese tramo se suma al pool general de piezas a anidar
          // (spliceFillerPieces) en vez de comprarle una barra propia. Así,
          // varios tramos cortos de empalmes distintos (del mismo perfil)
          // pueden terminar compartiendo UNA sola barra nueva si caben
          // juntos, en vez de una barra nueva por cada empalme.
          const usedOffcut =
            chosen.extraSegmentSource === 'offcut'
              ? material.offcuts.find((o) => o.id === chosen.extraSegmentOffcutId)
              : undefined;

          const extraCutLengthMm = chosen.extraSegmentLengthMm || 0;
          const effectiveSpliceLossMm = getSpliceFacingLossMm(material.code, material.category, settings.spliceFacingLossMm ?? 5);
          const fillerLabel = `${piece.label} (tramo adicional empalme, incl. ${effectiveSpliceLossMm}mm de saneo)`;

          if (usedOffcut) {
            consumedOffcutIdsForSplice.add(usedOffcut.id);
            const extraRemainingMm = Math.max(0, usedOffcut.lengthMm - extraCutLengthMm);
            oversizedBarPlans.push({
              id: `bar-plan-oversized-${oversizedBarPlans.length + 1}`,
              barIndex: 0,
              sourceType: 'stock_offcut',
              sourceLengthMm: usedOffcut.lengthMm,
              sourceOffcutId: usedOffcut.id,
              sourceLocation: 'Empalme — tramo adicional (retazo de bodega)',
              cuts: [
                {
                  pieceId: pieceKey,
                  label: fillerLabel,
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
              efficiencyPercentage: Number(((extraCutLengthMm / usedOffcut.lengthMm) * 100).toFixed(2))
            });
          } else {
            spliceFillerPieces.push({
              originalId: `${piece.originalId}-empalme`,
              label: fillerLabel,
              lengthMm: extraCutLengthMm,
              color: piece.color,
              instanceIndex: piece.instanceIndex,
              isSpliceFiller: true
            });
          }
        }
      });
    });
  } else {
    stillImpossible.push(...impossiblePieces);
  }

  oversizedBarPlans.forEach((p, idx) => {
    p.barIndex = idx + 1;
  });

  // Los tramos cortos de empalme se suman al pool general de piezas a
  // anidar (re-ordenando descendente para que el heurístico BFD los trate
  // igual que a cualquier otra pieza corta) — de ahí en adelante compiten
  // por retazos y barras nuevas junto con el resto, en vez de tener
  // reservada una barra propia cada uno.
  if (spliceFillerPieces.length > 0) {
    validPieces.push(...spliceFillerPieces);
    validPieces.sort((a, b) => b.lengthMm - a.lengthMm);
  }

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

  // 5. Phase C: If pieces remain, use additional new purchased bars (unlimited
  // virtual supply). Si hay más de un largo comercial candidato (ej. 6m y
  // 12m para un tubular RHS), se prueba CADA barra nueva con todos los
  // largos disponibles y se elige el que da mejor aprovechamiento para las
  // piezas que quedan EN ESE MOMENTO — no un largo único fijo para todo el
  // lote, porque el mix ideal de 6m/12m suele variar a medida que se van
  // consumiendo piezas de distintos tamaños.
  const lengthsToTry =
    candidateBarLengthsMm && candidateBarLengthsMm.length > 0 ? candidateBarLengthsMm : [material.standardBarLengthMm];

  while (unassignedPieces.length > 0) {
    let bestPlan: CutBarPlan | null = null;

    for (const len of lengthsToTry) {
      const trialBar: StockSourceOption = {
        id: `new-bar-${barCounter}`,
        type: 'new_purchased_bar',
        lengthMm: len,
        location: 'Por Comprar / Solicitar',
        used: true
      };
      const trialPlan = tryPackBar(trialBar, unassignedPieces, kerfMm, trimCutMm, minUsableOffcutMm, barCounter);
      if (trialPlan && trialPlan.cuts.length > 0 && (!bestPlan || trialPlan.efficiencyPercentage > bestPlan.efficiencyPercentage)) {
        bestPlan = trialPlan;
      }
    }

    if (!bestPlan) {
      // Ninguna barra, de ningún largo candidato, pudo llevarse ni una pieza
      break;
    }

    barPlans.push(bestPlan);
    barCounter++;

    const packedIds = new Set(bestPlan.cuts.map((c) => c.pieceId));
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

  // Find best combination of pieces that fits in usableCapacity.
  //
  // Heurística: "First-Fit Decreasing" puro (probar los largos en un único
  // orden fijo, de mayor a menor) deja bastante desperdicio sobre la mesa —
  // a veces empezar la barra con una pieza más chica permite que el resto
  // encaje mejor. Para acercarse más al óptimo sin pagar el costo de un
  // knapsack exacto (inviable en tiempo real con miles de piezas), se
  // prueba UN ANCLA por cada largo distinto disponible: "empezar esta
  // barra con este largo, y rellenar el resto greedy de mayor a menor" — y
  // se elige el ancla que más aprovecha la barra. Sigue siendo una
  // heurística, no un óptimo garantizado, pero mejora notoriamente sobre
  // una sola pasada fija.
  //
  // Nota sobre empalmes: una barra nueva comprada para tramos cortos de
  // empalme SÍ puede cortarse en varios tramos, cada uno yendo a una pieza
  // final distinta (ej. sobran 3m al cortar el tramo de una pieza — ese
  // sobrante se reutiliza como tramo de empalme de la SIGUIENTE pieza). La
  // restricción real es otra: CADA PIEZA FABRICADA lleva como máximo un
  // empalme (nunca dos tramos cortos en la misma pieza terminada) — eso ya
  // se cumple solo, porque cada pieza oversized genera un único
  // `spliceFillerPieces` en la sección 1.5, nunca dos.
  const fillGreedyFrom = (anchorIdx: number): { selected: FlatPiece[]; used: number } => {
    const selected: FlatPiece[] = [];
    let used = 0;

    const anchor = availablePieces[anchorIdx];
    if (anchor.lengthMm > usableCapacity) return { selected, used };
    selected.push(anchor);
    used = anchor.lengthMm;

    for (let i = 0; i < availablePieces.length; i++) {
      if (i === anchorIdx) continue;
      const p = availablePieces[i];
      const neededWithKerf = p.lengthMm + kerfMm;
      if (used + neededWithKerf <= usableCapacity) {
        selected.push(p);
        used += neededWithKerf;
      }
    }
    return { selected, used };
  };

  let bestFill = fillGreedyFrom(0);
  const triedLengths = new Set<number>([availablePieces[0]?.lengthMm]);
  // Ancla en cada largo DISTINTO (no cada instancia — probar 50 anclas
  // idénticas de 6000mm no aporta nada más que la primera) para acotar el
  // costo cuando hay cientos de piezas del mismo largo.
  for (let i = 1; i < availablePieces.length; i++) {
    const len = availablePieces[i].lengthMm;
    if (triedLengths.has(len)) continue;
    triedLengths.add(len);
    const candidate = fillGreedyFrom(i);
    if (candidate.used > bestFill.used) bestFill = candidate;
  }

  const selectedPieces = bestFill.selected;
  // Reordenar de mayor a menor para que la secuencia de corte en pantalla
  // (y los topes de sierra acumulados) sigan un orden intuitivo para el
  // operador, sin importar qué ancla ganó internamente.
  selectedPieces.sort((a, b) => b.lengthMm - a.lengthMm);

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
