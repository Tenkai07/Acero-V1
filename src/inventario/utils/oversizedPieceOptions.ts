import { MaterialStockItem, OffcutItem, OptimizationSettings, OversizedPieceComparison, OversizedPieceOption } from '../types';
import { getSpliceFacingLossMm } from './commercialLengths';

/**
 * Evalúa las alternativas de material para una pieza: comprar la barra
 * comercial real que la cubra entera, o empalmarla — probando TODOS los
 * largos comerciales reales (estándar + alternativos, ej. 6m y 12m) como
 * posible "tramo principal" del empalme. Se compara SIEMPRE por material
 * total consumido, incluso cuando la pieza cabe entera en una barra real
 * más grande: una pieza de 6.504mm cabe en una barra de 12m, pero deja
 * 5.496mm de desperdicio — empalmar 6m + un tramo corto de ~500mm
 * desperdicia mucho menos material total, aunque técnicamente "no haría
 * falta" empalmar. El usuario confirmó explícitamente priorizar el ahorro
 * de material por sobre evitar el trabajo de empalmar.
 *
 * Simplificación deliberada: el tramo principal del empalme se trata como
 * una barra íntegra sin trimCutMm propio (el usuario describió la pérdida
 * del empalme como solo el saneamiento en la unión, no un saneo adicional
 * al de la barra completa).
 *
 * Devuelve null si la pieza es tan larga que ni la barra más grande
 * disponible ni un empalme de UN solo tramo adicional alcanzan (dos largos
 * reales combinados es el máximo que cubre una pieza con un solo empalme —
 * cada pieza fabricada admite máximo uno; más que eso necesita dividirse en
 * 2+ empalmes, caso que cubre `spliceCalculator.ts` en "Ajustar Medidas &
 * Empalmes", no esta función).
 */
export function evaluateOversizedPieceOptions(
  pieceLengthMm: number,
  quantity: number,
  material: MaterialStockItem,
  settings: OptimizationSettings,
  availableOffcuts: OffcutItem[]
): OversizedPieceComparison | null {
  const trimCutMm = settings.trimCutMm;
  // El saneamiento de la máquina al preparar un empalme NO es un número
  // único: en un ángulo la máquina sanea la tira completa (~90mm por
  // pieza), pero en un tubular RHS/SHS u otro perfil es solo ~5mm por
  // corte. `settings.spliceFacingLossMm`, si el usuario lo definió
  // explícitamente, se usa como el valor para "el resto de los perfiles"
  // (no ángulos) en vez del default de 5mm — los ángulos siempre son 90mm.
  const spliceFacingLossMm = getSpliceFacingLossMm(material.code, material.category, settings.spliceFacingLossMm ?? 5);

  // Todos los largos comerciales REALES disponibles para este material
  // (estándar + alternativos), ordenados ascendente. Cualquiera de ellos
  // puede ser tanto "la barra que cubre entera" como "el tramo principal
  // de un empalme".
  const realLengths = Array.from(
    new Set([material.standardBarLengthMm, ...(material.alternateBarLengthsMm || [])])
  ).sort((a, b) => a - b);
  const largestRealLength = realLengths[realLengths.length - 1];
  const smallestRealLength = realLengths[0];

  // Un empalme de un solo tramo adicional cubre como máximo "el largo real
  // más grande, dos veces" (ej. 12m + 12m). Piezas más largas que eso
  // necesitan 2+ empalmes en la misma pieza — no está permitido (cada
  // pieza fabricada admite máximo uno) y se resuelve aparte.
  const maxSingleSpliceReach = largestRealLength * 2 - spliceFacingLossMm;
  if (pieceLengthMm > maxSingleSpliceReach) return null;

  const options: OversizedPieceOption[] = [];

  // --- Opción A: comprar la barra comercial real MÁS CHICA que la cubra entera ---
  // (puede ser la única opción viable, o competir contra un empalme más
  // barato en material total — el llamador decide comparando ambas)
  const fittingReal = realLengths.filter((len) => pieceLengthMm + trimCutMm <= len).sort((a, b) => a - b)[0];
  if (fittingReal) {
    const wasteMm = fittingReal - trimCutMm - pieceLengthMm;
    options.push({
      type: 'bigger_bar',
      label: `Comprar 1 barra de ${(fittingReal / 1000).toLocaleString('es-CL')}m (cabe entera, sin empalme)`,
      barLengthUsedMm: fittingReal,
      totalMaterialConsumedMm: fittingReal,
      wasteMm,
      wastePercentage: Number(((wasteMm / fittingReal) * 100).toFixed(2)),
      newBarsRequired: 1
    });
  }

  // --- Opción B: empalme — se prueba CADA largo real como tramo principal ---
  // (6m+algo, 12m+algo, etc.) y se toma la combinación de menor desperdicio,
  // no solo la que usa el estándar como tramo principal.
  let bestSplice: OversizedPieceOption | null = null;
  for (const mainLength of realLengths) {
    if (pieceLengthMm + trimCutMm <= mainLength) continue; // esa pieza ni siquiera necesita empalme con este largo
    const extraNeededMm = pieceLengthMm - mainLength + spliceFacingLossMm;
    if (extraNeededMm <= 0) continue;
    if (extraNeededMm > largestRealLength) continue; // el tramo corto tampoco alcanza ni con la barra más grande

    const matchingOffcut = [...availableOffcuts]
      .filter((o) => o.lengthMm >= extraNeededMm)
      .sort((a, b) => a.lengthMm - b.lengthMm)[0];

    const usesOffcut = !!matchingOffcut;
    // Si hace falta barra nueva para el tramo corto, se usa la MENOR barra
    // real que alcance (para no comprar de más solo para un tramo chico).
    const smallestFittingReal = realLengths.find((len) => len >= extraNeededMm) || largestRealLength;
    const extraSegmentSourceLengthMm = usesOffcut ? matchingOffcut.lengthMm : smallestFittingReal;
    const physicalTotalMm = mainLength + extraSegmentSourceLengthMm;
    const wasteMm = physicalTotalMm - pieceLengthMm;

    const candidate: OversizedPieceOption = {
      type: 'splice',
      label: usesOffcut
        ? `Empalmar: 1 barra de ${(mainLength / 1000).toLocaleString('es-CL')}m + retazo existente de ${matchingOffcut!.lengthMm}mm`
        : `Empalmar: 1 barra de ${(mainLength / 1000).toLocaleString('es-CL')}m + 1 barra de ${(extraSegmentSourceLengthMm / 1000).toLocaleString('es-CL')}m (se corta un tramo de ${Math.ceil(extraNeededMm)}mm)`,
      barLengthUsedMm: mainLength,
      extraSegmentLengthMm: extraNeededMm,
      extraSegmentSource: usesOffcut ? 'offcut' : 'new_bar',
      extraSegmentOffcutId: usesOffcut ? matchingOffcut!.id : undefined,
      totalMaterialConsumedMm: physicalTotalMm,
      wasteMm,
      wastePercentage: Number(((wasteMm / physicalTotalMm) * 100).toFixed(2)),
      newBarsRequired: usesOffcut ? 1 : 2
    };

    // A igual desperdicio (empate frecuente: usar 6m+algo-de-12m o
    // 12m+algo-de-6m suele dar el mismo total físico), se prefiere el
    // tramo principal MÁS GRANDE — deja un tramo adicional MÁS CHICO, que
    // es mucho más fácil de combinar con los tramos adicionales de OTRAS
    // piezas empalmadas (ej. varios tramos de ~600mm caben juntos en una
    // sola barra de relleno; varios de ~6600mm casi nunca caben juntos).
    // Sin esto, el desempate quedaba a merced del orden de iteración y
    // terminaba prefiriendo el tramo principal más chico —justo el peor
    // caso para poder agrupar empalmes entre sí.
    if (
      !bestSplice ||
      candidate.wasteMm < bestSplice.wasteMm ||
      (candidate.wasteMm === bestSplice.wasteMm && candidate.barLengthUsedMm > bestSplice.barLengthUsedMm)
    ) {
      bestSplice = candidate;
    }
  }
  if (bestSplice) options.push(bestSplice);

  if (options.length === 0) return null;

  const recommended = options.reduce((best, o) => (o.wasteMm < best.wasteMm ? o : best), options[0]);

  return {
    pieceLengthMm,
    quantity,
    options,
    recommendedType: recommended.type
  };
}
