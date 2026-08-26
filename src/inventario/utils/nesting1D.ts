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
    prioritizeOffcuts = true,
    useExactFill = false,
    randomSeed
  } = settings;

  // Generador determinista (mismo seed ⇒ misma solución, para que un
  // resultado sea reproducible y auditable). Sin seed, el anidado queda
  // 100% determinista como siempre.
  const rng: (() => number) | null = (() => {
    if (randomSeed === undefined) return null;
    // splitmix32. Se probó antes un LCG simple y resultó inservible acá:
    // con semillas chicas y correlativas sus PRIMEROS valores salían todos
    // bajos y proporcionales a la semilla (0,14 / 0,24 / 0,34 …), así que
    // ninguna corrida llegaba a cruzar el umbral y las 300 semillas daban
    // exactamente la misma solución. Este mezclador decorrelaciona la
    // semilla desde el primer valor.
    let state = randomSeed | 0;
    return () => {
      state = (state + 0x9e3779b9) | 0;
      let t = state ^ (state >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      t = t ^ (t >>> 15);
      return (t >>> 0) / 4294967296;
    };
  })();

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

  // Largos reales que esta corrida en particular tiene permitido usar —
  // puede ser UN SOLO largo (el usuario pidió cotizar siempre a un largo
  // único, porque así se cotiza con el proveedor) o varios. Tanto el
  // empalme "necesario" (sección 1.5) como el "por ahorro" (sección 5.5)
  // deben respetar ESTE conjunto, no el catálogo completo del material
  // (`material.alternateBarLengthsMm`) — si no, un empalme podía mezclar
  // un largo que la corrida actual ni siquiera está evaluando (ej. meter
  // un tramo de 6m en una corrida "solo 12m"), rompiendo justamente el
  // escenario de largo único que se está probando.
  const lengthsToTry =
    candidateBarLengthsMm && candidateBarLengthsMm.length > 0 ? candidateBarLengthsMm : [material.standardBarLengthMm];
  const materialForSplice: MaterialStockItem = {
    ...material,
    standardBarLengthMm: lengthsToTry[0],
    alternateBarLengthsMm: lengthsToTry.slice(1)
  };

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
      const comparison = evaluateOversizedPieceOptions(lengthMm, instances.length, materialForSplice, settings, firstOffcutSnapshot);

      if (!comparison) {
        stillImpossible.push(...instances);
        return;
      }
      oversizedPieceComparisons.push(comparison);

      instances.forEach((piece) => {
        const offcutSnapshot = getAvailableOffcuts(material).filter((o) => !consumedOffcutIdsForSplice.has(o.id));
        const perInstance = evaluateOversizedPieceOptions(lengthMm, 1, materialForSplice, settings, offcutSnapshot);
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

      const plan = tryPackBar(offcut, unassignedPieces, kerfMm, trimCutMm, minUsableOffcutMm, barCounter, useExactFill, rng);
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

    const plan = tryPackBar(stdBar, unassignedPieces, kerfMm, trimCutMm, minUsableOffcutMm, barCounter, useExactFill, rng);
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
  // consumiendo piezas de distintos tamaños. (`lengthsToTry` ya se definió
  // arriba, antes de la sección 1.5, para que el empalme también lo respete.)

  // (Se probó reemplazar este bucle por un Best-Fit-Decreasing con varias
  // barras "abiertas" a la vez para el caso de largo único, esperando que
  // evitara que las primeras barras acapararan las mejores piezas
  // complementarias. En la práctica empeoró el resultado en al menos 2
  // perfiles reales sin mejorar el caso que se quería arreglar — se
  // revirtió. El ancla única + relleno greedy sigue siendo, empíricamente,
  // el heurístico más confiable que se ha probado para este caso.)
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
      const trialPlan = tryPackBar(trialBar, unassignedPieces, kerfMm, trimCutMm, minUsableOffcutMm, barCounter, useExactFill, rng);
      // A igual eficiencia (empate exacto, típico cuando un largo es
      // múltiplo entero de otro — ej. 2 piezas de 4290mm en una barra de
      // 12m da la MISMA eficiencia que 1 pieza de 4290mm en una de 6m,
      // porque 12000 = 2×6000), se prefiere la barra más GRANDE: mismo
      // material total consumido, pero la mitad de barras físicas que
      // manipular/soldar. Sin este desempate, el orden de `lengthsToTry`
      // decidía arbitrariamente y normalmente ganaba el largo más chico.
      if (
        trialPlan &&
        trialPlan.cuts.length > 0 &&
        (!bestPlan ||
          trialPlan.efficiencyPercentage > bestPlan.efficiencyPercentage ||
          (trialPlan.efficiencyPercentage === bestPlan.efficiencyPercentage && trialPlan.sourceLengthMm > bestPlan.sourceLengthMm))
      ) {
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

  // 5.5 Optimización de "barras solitarias": una barra nueva comprada con
  // UNA sola pieza puede estar desperdiciando mucho material si la pieza
  // cabe en un largo real grande pero es bastante más corta que él (ej. una
  // pieza de 6.504mm sola en una barra de 12m bota 5.496mm) — Fase C no
  // pudo usar el largo más chico ahí porque la pieza literalmente no cabe
  // en él (6.504mm > 6.000mm), así que se queda con el único largo que sí
  // la recibe entera, aunque desperdicie mucho.
  //
  // Ojo con la trampa: evaluar cada pieza AISLADA contra "empalmar con una
  // barra nueva dedicada solo a su tramo corto" casi nunca gana (6000 de
  // barra principal + 6000 de barra nueva solo para cortar 500mm da 12000,
  // igual o peor que la barra grande sola). La ganancia real aparece porque
  // MUCHAS piezas distintas pueden compartir una única barra nueva para sus
  // tramos cortos (varios tramos de ~500-3000mm caben juntos en una sola
  // barra de 6m). Por eso acá se junta el LOTE completo de candidatas,
  // se simula empacar todos los tramos cortos juntos, y solo se aplica el
  // cambio si el total de material (tramos principales + barras nuevas
  // realmente necesarias para los tramos cortos, tras compartir) es MENOR
  // que el total original — nunca pieza por pieza. El usuario confirmó
  // priorizar el ahorro de material real por sobre evitar empalmes
  // "innecesarios".
  // Igual que en la sección 1.5: usa `lengthsToTry` (los largos que ESTA
  // corrida tiene permitido usar), no el catálogo completo del material —
  // si la corrida actual es de largo único (ej. solo 12m, para cotizar),
  // acá no debe aparecer ningún otro largo, o se rompería justamente el
  // escenario de largo único que se está probando.
  const realCandidateLengths = Array.from(new Set(lengthsToTry));

  if (realCandidateLengths.length > 1) {
    const smallestRealLength = Math.min(...realCandidateLengths);
    const effectiveSpliceLossMm = getSpliceFacingLossMm(material.code, material.category, settings.spliceFacingLossMm ?? 5);

    type SplitCandidate = {
      planIdx: number;
      cut: CutPieceDetail;
      mainLengthMm: number;
      fillerNeededMm: number;
      offcut?: { id: string; lengthMm: number };
    };
    const candidates: SplitCandidate[] = [];

    barPlans.forEach((plan, planIdx) => {
      if (plan.cuts.length !== 1) return;
      if (plan.sourceType !== 'new_purchased_bar') return;
      if (plan.sourceLengthMm <= smallestRealLength) return;
      // Excluir cualquier tramo que YA sea parte de un empalme (necesario,
      // Sección 1.5): ni el tramo principal (placeholder del largo usado,
      // ej. 12000mm, para una pieza real mucho más larga como 20325mm) ni
      // un tramo adicional que terminó solo en su propia barra nueva son
      // piezas completas — son fragmentos de una pieza que YA lleva su
      // único empalme permitido. Sin este filtro se re-empalmaba el
      // fragmento como si fuera una pieza normal, dejando la pieza final
      // con DOS empalmes y contándola como "por ahorro" en vez de
      // "necesario".
      const cut = plan.cuts[0];
      if (plan.id.startsWith('bar-plan-oversized-')) return;
      if (cut.label.includes('tramo principal') || cut.label.includes('tramo adicional')) return;
      const offcutSnapshot = getAvailableOffcuts(material).filter((o) => !consumedOffcutIdsForSplice.has(o.id));
      const comparison = evaluateOversizedPieceOptions(cut.lengthMm, 1, materialForSplice, settings, offcutSnapshot);
      const spliceOption = comparison?.options.find((o) => o.type === 'splice');
      if (!spliceOption) return;

      candidates.push({
        planIdx,
        cut,
        mainLengthMm: spliceOption.barLengthUsedMm,
        fillerNeededMm: spliceOption.extraSegmentLengthMm || 0,
        offcut:
          spliceOption.extraSegmentSource === 'offcut' && spliceOption.extraSegmentOffcutId
            ? { id: spliceOption.extraSegmentOffcutId, lengthMm: material.offcuts.find((o) => o.id === spliceOption.extraSegmentOffcutId)?.lengthMm || 0 }
            : undefined
      });
    });

    if (candidates.length > 0) {
      const originalTotalMm = candidates.reduce((s, c) => s + barPlans[c.planIdx].sourceLengthMm, 0);
      // Costo de material nuevo si se convierte: el tramo principal de
      // TODAS las candidatas (uses o no retazo para el tramo corto) más las
      // barras nuevas realmente necesarias para los tramos cortos que no
      // encontraron retazo (fillerBarsTotalMm, calculado abajo). Los tramos
      // cortos cubiertos por un retazo de bodega no suman material nuevo.
      const mainTotalMm = candidates.reduce((s, c) => s + c.mainLengthMm, 0);

      // Simular el empaque conjunto de los tramos cortos que SÍ necesitan
      // barra nueva (los que ya tienen un retazo de bodega no consumen
      // material nuevo, se excluyen de la simulación y siempre convienen).
      const needsNewBar = candidates.filter((c) => !c.offcut);
      const fillerSim: FlatPiece[] = needsNewBar
        .map((c, idx) => ({
          originalId: `${c.cut.pieceId}-ahorro`,
          label: `${c.cut.label} (tramo adicional empalme por ahorro, incl. ${effectiveSpliceLossMm}mm de saneo)`,
          lengthMm: c.fillerNeededMm,
          color: c.cut.color,
          instanceIndex: idx + 1,
          isSpliceFiller: true
        }))
        .sort((a, b) => b.lengthMm - a.lengthMm);

      const fillerBarPlans: CutBarPlan[] = [];
      let simCounter = 1;
      while (fillerSim.length > 0) {
        let bestPlan: CutBarPlan | null = null;
        for (const len of lengthsToTry) {
          const trialBar: StockSourceOption = {
            id: `sim-bar-${simCounter}`,
            type: 'new_purchased_bar',
            lengthMm: len,
            location: 'Por Comprar / Solicitar',
            used: true
          };
          const trialPlan = tryPackBar(trialBar, fillerSim, kerfMm, trimCutMm, minUsableOffcutMm, simCounter, useExactFill, rng);
          // Mismo desempate que en la Fase C: a igual eficiencia, preferir
          // la barra más grande (menos barras físicas por el mismo material).
          if (
            trialPlan &&
            trialPlan.cuts.length > 0 &&
            (!bestPlan ||
              trialPlan.efficiencyPercentage > bestPlan.efficiencyPercentage ||
              (trialPlan.efficiencyPercentage === bestPlan.efficiencyPercentage && trialPlan.sourceLengthMm > bestPlan.sourceLengthMm))
          ) {
            bestPlan = trialPlan;
          }
        }
        if (!bestPlan) break;
        fillerBarPlans.push(bestPlan);
        simCounter++;
        const packedIds = new Set(bestPlan.cuts.map((c) => c.pieceId));
        let i = fillerSim.length;
        while (i--) {
          const pieceKey = `${fillerSim[i].originalId}_${fillerSim[i].instanceIndex}`;
          if (packedIds.has(pieceKey)) fillerSim.splice(i, 1);
        }
      }

      const fillerBarsTotalMm = fillerBarPlans.reduce((s, p) => s + p.sourceLengthMm, 0);
      const proposedTotalMm = mainTotalMm + fillerBarsTotalMm;

      if (proposedTotalMm < originalTotalMm) {
        // Conviene: se reemplazan las barras solitarias originales por sus
        // tramos principales + los tramos cortos (de retazo o de las
        // barras de relleno recién simuladas, que se materializan tal cual).
        const idxToRemove = candidates.map((c) => c.planIdx).sort((a, b) => b - a);
        idxToRemove.forEach((idx) => barPlans.splice(idx, 1));

        candidates.forEach((c) => {
          barPlans.push({
            id: `bar-plan-splitopt-${barPlans.length + 1}`,
            barIndex: 0,
            sourceType: 'new_purchased_bar',
            sourceLengthMm: c.mainLengthMm,
            sourceLocation: 'Empalme por ahorro de material — tramo principal (barra estándar nueva)',
            cuts: [
              {
                pieceId: c.cut.pieceId,
                label: `${c.cut.label} (tramo principal)`,
                lengthMm: c.mainLengthMm,
                color: c.cut.color,
                cutIndex: 1,
                stopPositionMm: c.mainLengthMm
              }
            ],
            totalCutLengthMm: c.mainLengthMm,
            kerfTotalMm: 0,
            trimCutMm: 0,
            remainingMm: 0,
            isReusableOffcut: false,
            efficiencyPercentage: 100
          });

          if (c.offcut) {
            consumedOffcutIdsForSplice.add(c.offcut.id);
            const extraRemainingMm = Math.max(0, c.offcut.lengthMm - c.fillerNeededMm);
            barPlans.push({
              id: `bar-plan-splitopt-${barPlans.length + 1}`,
              barIndex: 0,
              sourceType: 'stock_offcut',
              sourceLengthMm: c.offcut.lengthMm,
              sourceOffcutId: c.offcut.id,
              sourceLocation: 'Empalme por ahorro de material — tramo adicional (retazo de bodega)',
              cuts: [
                {
                  pieceId: c.cut.pieceId,
                  label: `${c.cut.label} (tramo adicional empalme por ahorro, incl. ${effectiveSpliceLossMm}mm de saneo)`,
                  lengthMm: c.fillerNeededMm,
                  color: c.cut.color,
                  cutIndex: 1,
                  stopPositionMm: c.fillerNeededMm
                }
              ],
              totalCutLengthMm: c.fillerNeededMm,
              kerfTotalMm: 0,
              trimCutMm: 0,
              remainingMm: extraRemainingMm,
              isReusableOffcut: extraRemainingMm >= minUsableOffcutMm,
              efficiencyPercentage: Number(((c.fillerNeededMm / c.offcut.lengthMm) * 100).toFixed(2))
            });
          }
        });

        fillerBarPlans.forEach((p) => {
          barPlans.push({ ...p, id: `bar-plan-splitopt-${barPlans.length + 1}`, barIndex: 0 });
        });
      }
    }
  }

  // 5.7 Pasada de MEJORA: intentar eliminar barras completas.
  //
  // El anidado es barra por barra: se llena una, se cierra, se pasa a la
  // siguiente. Eso deja un patrón típico al final — unas pocas barras muy
  // vacías con las piezas que ya no combinaban con nada — mientras que
  // repartidas entre el espacio libre de las demás sí habrían cabido.
  //
  // Acá se toma la barra MÁS VACÍA, se sacan sus piezas y se intenta
  // meterlas en el espacio libre que quedó en las otras barras. Si TODAS
  // encuentran lugar, esa barra desaparece (una barra menos que comprar) y
  // se repite el intento con la siguiente más vacía. Si alguna pieza queda
  // sin lugar, se revierte todo y se corta la pasada.
  //
  // Solo se sacan barras nuevas normales: las de empalme (`oversized` /
  // `splitopt`) llevan tramos que son parte de una pieza más larga, no
  // piezas completas, y moverlos rompería el empalme.
  const isSpliceRelatedPlan = (p: CutBarPlan) =>
    p.id.startsWith('bar-plan-oversized-') || p.id.startsWith('bar-plan-splitopt-');

  const cutToPiece = (c: CutPieceDetail): FlatPiece => {
    const sep = c.pieceId.lastIndexOf('_');
    return {
      originalId: c.pieceId.slice(0, sep),
      label: c.label,
      lengthMm: c.lengthMm,
      color: c.color,
      instanceIndex: Number(c.pieceId.slice(sep + 1))
    };
  };

  const planToSource = (p: CutBarPlan): StockSourceOption => ({
    id: p.id,
    type: p.sourceType,
    lengthMm: p.sourceLengthMm,
    offcutId: p.sourceOffcutId,
    location: p.sourceLocation,
    used: true
  });

  const tryEliminateOneBar = (): boolean => {
    const victimCandidates = barPlans
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => p.sourceType === 'new_purchased_bar' && !isSpliceRelatedPlan(p))
      .sort((a, b) => b.p.remainingMm - a.p.remainingMm);
    if (victimCandidates.length < 2) return false;

    const victim = victimCandidates[0];
    let loose = victim.p.cuts.map(cutToPiece);
    if (loose.length === 0) return false;

    // Barras destino: cualquier otra que no sea de empalme, de la más
    // vacía a la más llena (donde más fácil entra algo).
    const targets = barPlans
      .map((p, idx) => ({ p, idx }))
      .filter(({ p, idx }) => idx !== victim.idx && !isSpliceRelatedPlan(p))
      .sort((a, b) => b.p.remainingMm - a.p.remainingMm);

    const rebuilt = new Map<number, CutBarPlan>();

    for (const target of targets) {
      if (loose.length === 0) break;
      const current = rebuilt.get(target.idx) || target.p;
      // Agregar una pieza a una barra que ya tiene cortes cuesta su largo
      // MÁS un kerf. `bestFillExact` razona sobre Σ(largo+kerf) ≤ cap+kerf,
      // así que para acotarlo al hueco real hay que pasarle `hueco - kerf`.
      const room = current.remainingMm - kerfMm;
      if (room <= 0) continue;

      const fill = bestFillExact(loose, room, kerfMm);
      if (!fill || fill.selected.length === 0) continue;

      const chosenKeys = new Set(fill.selected.map((p) => `${p.originalId}_${p.instanceIndex}`));
      const merged = [...current.cuts.map(cutToPiece), ...fill.selected];
      const newPlan = buildBarPlan(planToSource(current), merged, kerfMm, current.trimCutMm, minUsableOffcutMm, current.barIndex);
      if (!newPlan) continue;

      rebuilt.set(target.idx, newPlan);
      loose = loose.filter((p) => !chosenKeys.has(`${p.originalId}_${p.instanceIndex}`));
    }

    if (loose.length > 0) return false; // no cupo todo: no se toca nada

    rebuilt.forEach((plan, idx) => {
      barPlans[idx] = plan;
    });
    barPlans.splice(victim.idx, 1);
    return true;
  };

  if (useExactFill) {
    // Acotada por seguridad: cada intento fallido cuesta una pasada
    // completa sobre las barras, y en proyectos grandes no vale la pena
    // insistir indefinidamente.
    let guard = barPlans.length + 5;
    while (guard-- > 0 && tryEliminateOneBar()) {
      /* sigue mientras se puedan eliminar barras */
    }
    barPlans.forEach((p, idx) => {
      p.barIndex = idx + 1;
    });
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
  barIndex: number,
  useExactFill: boolean,
  rng: (() => number) | null
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
  // (Se probó además anclar de a PARES de largos distintos, no solo de a
  // uno, esperando que ayudara cuando muchas piezas medianas compiten por
  // pocas piezas chicas complementarias. En la práctica empeoró el
  // resultado total en al menos un perfil real: una mejora LOCAL en una
  // barra puede dejar peores piezas disponibles para las barras
  // siguientes — la trampa clásica de un heurístico greedy bar-por-bar.
  // Se revirtió; cerrar esa brecha de verdad requiere no comprometerse
  // bar-por-bar, sino optimizar el lote completo o con una pasada de
  // mejora posterior, no solo mejorar el ancla.)
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

  // Ancla en cada largo DISTINTO (no cada instancia — probar 50 anclas
  // idénticas de 6000mm no aporta nada más que la primera) para acotar el
  // costo cuando hay cientos de piezas del mismo largo.
  const fills: { selected: FlatPiece[]; used: number }[] = [fillGreedyFrom(0)];
  const triedLengths = new Set<number>([availablePieces[0]?.lengthMm]);
  for (let i = 1; i < availablePieces.length; i++) {
    const len = availablePieces[i].lengthMm;
    if (triedLengths.has(len)) continue;
    triedLengths.add(len);
    fills.push(fillGreedyFrom(i));
  }
  fills.sort((a, b) => b.used - a.used);

  // Deduplicar por CONTENIDO: anclas distintas suelen converger al mismo
  // conjunto de piezas (anclar en 5579 y anclar en 4912 terminan ambas en
  // {13448, 5579, 4912}). Sin deduplicar, "elegir al azar entre los 8
  // mejores" en la práctica devuelve siempre el mismo llenado y el
  // multi-arranque no explora nada.
  const distinctFills: { selected: FlatPiece[]; used: number }[] = [];
  const seenSignatures = new Set<string>();
  for (const f of fills) {
    const signature = f.selected
      .map((p) => p.lengthMm)
      .sort((a, b) => a - b)
      .join(',');
    if (seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);
    distinctFills.push(f);
  }

  // Sin semilla: siempre el mejor llenado (determinista). Con semilla: a
  // veces se toma uno de los siguientes mejores. Suena contraproducente,
  // pero llenar cada barra al máximo es una decisión LOCAL — a menudo
  // consume las piezas chicas que después harían falta para completar
  // otras barras. Aceptar de vez en cuando un llenado apenas peor abre
  // soluciones globales mejores; `multiNestingEngine` repite el anidado
  // con varias semillas y se queda con el mejor resultado del perfil.
  let bestFill = distinctFills[0];
  if (rng && distinctFills.length > 1) {
    if (rng() > 0.55) {
      const pool = Math.min(distinctFills.length, 6);
      bestFill = distinctFills[Math.floor(rng() * pool)];
    }
  }

  // Búsqueda EXACTA del mejor llenado posible de esta barra (knapsack
  // acotado). El heurístico de arriba ancla una pieza y rellena de mayor a
  // menor, así que nunca encuentra combinaciones "raras" que llenan casi
  // perfecto — ej. 4201+6154+6815+6815 = 23.985 de 24.000.
  //
  // No siempre conviene, y por eso es opcional: llenar CADA barra al máximo
  // es óptimo localmente pero puede dejar piezas "huérfanas" que después no
  // combinan con nada, empeorando el total del perfil. Quién gana depende
  // del mix de largos, así que `multiNestingEngine` corre el perfil con y
  // sin esta opción y se queda con el que compre menos material.
  if (useExactFill) {
    const exact = bestFillExact(availablePieces, usableCapacity, kerfMm);
    if (exact && exact.used > bestFill.used) bestFill = exact;
  }

  return buildBarPlan(source, bestFill.selected, kerfMm, trimCutMm, minUsableOffcutMm, barIndex);
}

/** Tope de trabajo del knapsack exacto por barra: largos distintos ×
 * capacidad. Por encima de esto se usa solo el heurístico, para que un
 * perfil con cientos de largos distintos no congele el cálculo. */
const EXACT_FILL_BUDGET = 6_000_000;

/**
 * Mejor llenado POSIBLE de una barra (knapsack acotado exacto), o null si
 * el problema es demasiado grande para resolverlo exacto en tiempo real.
 *
 * Truco de la sierra: el corte consume `kerfMm` entre piezas, así que una
 * barra con n piezas ocupa Σlargos + (n−1)·kerf. Sumarle el kerf a cada
 * pieza y también a la capacidad convierte eso en un knapsack clásico
 * (Σ(largo+kerf) ≤ capacidad+kerf), y maximizar esa suma es exactamente
 * minimizar el sobrante físico de la barra.
 */
function bestFillExact(
  availablePieces: FlatPiece[],
  usableCapacity: number,
  kerfMm: number
): { selected: FlatPiece[]; used: number } | null {
  const byLength = new Map<number, FlatPiece[]>();
  for (const p of availablePieces) {
    if (p.lengthMm > usableCapacity) continue;
    const arr = byLength.get(p.lengthMm);
    if (arr) arr.push(p);
    else byLength.set(p.lengthMm, [p]);
  }

  const lengths = Array.from(byLength.keys());
  if (lengths.length === 0) return null;

  const cap = usableCapacity + kerfMm;
  if (lengths.length * cap > EXACT_FILL_BUDGET) return null;

  // `layers[i]` = sumas alcanzables usando solo los primeros i largos.
  const layers: Uint8Array[] = [];
  let prev = new Uint8Array(cap + 1);
  prev[0] = 1;
  layers.push(prev);

  for (let i = 0; i < lengths.length; i++) {
    const w = lengths[i] + kerfMm;
    const maxCopies = byLength.get(lengths[i])!.length;
    const cur = new Uint8Array(cap + 1);
    // `copies[c]` = cuántas unidades de ESTE largo se usaron para llegar a
    // `c` — así se respeta el stock disponible de ese largo (knapsack
    // acotado, no ilimitado).
    const copies = new Int32Array(cap + 1).fill(-1);
    for (let c = 0; c <= cap; c++) {
      if (prev[c]) {
        cur[c] = 1;
        copies[c] = 0;
      } else if (c >= w && cur[c - w] === 1 && copies[c - w] >= 0 && copies[c - w] < maxCopies) {
        cur[c] = 1;
        copies[c] = copies[c - w] + 1;
      }
    }
    layers.push(cur);
    prev = cur;
  }

  let best = -1;
  for (let c = cap; c >= 1; c--) {
    if (prev[c]) {
      best = c;
      break;
    }
  }
  if (best <= 0) return null;

  const selected: FlatPiece[] = [];
  let c = best;
  for (let i = lengths.length - 1; i >= 0; i--) {
    const w = lengths[i] + kerfMm;
    const pool = byLength.get(lengths[i])!;
    let used = 0;
    while (layers[i][c] !== 1 && c >= w) {
      c -= w;
      used++;
      if (used > pool.length) return null; // inconsistencia: no forzar un plan inválido
    }
    for (let u = 0; u < used; u++) selected.push(pool[u]);
  }
  if (c !== 0 || selected.length === 0) return null;

  // Devolver `used` en la misma métrica que el heurístico: Σlargos +
  // (n−1)·kerf, es decir la suma "doblada" menos el kerf que se le agregó
  // de más a la capacidad.
  return { selected, used: best - kerfMm };
}

/**
 * Arma el `CutBarPlan` final (cortes con tope acumulado de sierra,
 * merma/retazo, eficiencia) a partir de un conjunto de piezas YA
 * seleccionado para una barra — compartido entre `tryPackBar` (que elige
 * las piezas vía ancla+relleno) y el Best-Fit-Decreasing de la Fase C
 * (que arma sus propios "bins" de piezas por otro método).
 */
function buildBarPlan(
  source: StockSourceOption,
  selectedPiecesIn: FlatPiece[],
  kerfMm: number,
  trimCutMm: number,
  minUsableOffcutMm: number,
  barIndex: number
): CutBarPlan | null {
  if (selectedPiecesIn.length === 0) return null;
  const barLength = source.lengthMm;

  // Reordenar de mayor a menor para que la secuencia de corte en pantalla
  // (y los topes de sierra acumulados) sigan un orden intuitivo para el
  // operador, sin importar en qué orden se hayan elegido las piezas.
  const selectedPieces = [...selectedPiecesIn].sort((a, b) => b.lengthMm - a.lengthMm);

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
