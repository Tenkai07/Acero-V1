import { MaterialStockItem, OffcutItem, OptimizationSettings, OversizedPieceComparison, OversizedPieceOption } from '../types';

/**
 * Evalúa las alternativas para una pieza que NO cabe en una barra de
 * standardBarLengthMm: comprar una barra comercial más grande que la cubra
 * entera, o empalmarla (barra estándar completa + un tramo corto adicional
 * que compensa el largo faltante MÁS la pérdida de saneamiento de la
 * soldadura del empalme).
 *
 * Simplificación deliberada: el segmento principal del empalme se trata
 * como una barra íntegra sin trimCutMm propio (el usuario describió la
 * pérdida del empalme como solo los 90mm de saneamiento en la unión, no un
 * saneo adicional al de la barra completa) — si en la práctica también hay
 * que descontar trimCutMm ahí, ajustar `spliceFacingLossMm` para compensarlo.
 *
 * Devuelve null si la pieza cabe en una barra estándar (no es "oversized"),
 * o si es tan larga que ni la barra alternativa más grande ni un empalme de
 * un solo tramo adicional alcanzan (habría que dividirla en 2+ empalmes,
 * caso que cubre `spliceCalculator.ts` en el módulo de "Ajustar Medidas &
 * Empalmes" en vez de esta comparación de compra).
 */
export function evaluateOversizedPieceOptions(
  pieceLengthMm: number,
  quantity: number,
  material: MaterialStockItem,
  settings: OptimizationSettings,
  availableOffcuts: OffcutItem[]
): OversizedPieceComparison | null {
  const trimCutMm = settings.trimCutMm;
  const spliceFacingLossMm = settings.spliceFacingLossMm ?? 90;
  const standardLength = material.standardBarLengthMm;

  const fitsStandardBar = pieceLengthMm + trimCutMm <= standardLength;
  if (fitsStandardBar) return null;

  // Un empalme de un solo tramo adicional solo cubre hasta ~2x el largo
  // estándar (menos la pérdida de saneamiento). Piezas más largas requieren
  // múltiples empalmes: eso lo resuelve spliceCalculator.ts, no esta función.
  const maxSingleSpliceReach = standardLength * 2 - spliceFacingLossMm;
  if (pieceLengthMm > maxSingleSpliceReach && !(material.alternateBarLengthsMm || []).some((l) => pieceLengthMm + trimCutMm <= l)) {
    return null;
  }

  const options: OversizedPieceOption[] = [];

  // --- Opción A: comprar una barra comercial más grande que la cubra entera ---
  const fittingAlternates = (material.alternateBarLengthsMm || [])
    .filter((len) => len > standardLength && pieceLengthMm + trimCutMm <= len)
    .sort((a, b) => a - b);

  if (fittingAlternates.length > 0) {
    const bigLen = fittingAlternates[0]; // la más chica que alcance, para no sobrecomprar
    const wasteMm = bigLen - trimCutMm - pieceLengthMm;
    options.push({
      type: 'bigger_bar',
      label: `Comprar 1 barra de ${(bigLen / 1000).toLocaleString('es-CL')}m (cabe entera, sin empalme)`,
      barLengthUsedMm: bigLen,
      totalMaterialConsumedMm: bigLen,
      wasteMm,
      wastePercentage: Number(((wasteMm / bigLen) * 100).toFixed(2)),
      newBarsRequired: 1
    });
  }

  // --- Opción B: empalme — barra estándar completa + tramo corto adicional ---
  if (pieceLengthMm <= maxSingleSpliceReach) {
    const extraNeededMm = pieceLengthMm - standardLength + spliceFacingLossMm;
    const matchingOffcut = [...availableOffcuts]
      .filter((o) => o.lengthMm >= extraNeededMm)
      .sort((a, b) => a.lengthMm - b.lengthMm)[0];

    const usesOffcut = !!matchingOffcut;
    const extraSegmentSourceLengthMm = usesOffcut ? matchingOffcut.lengthMm : standardLength;
    const physicalTotalMm = standardLength + extraSegmentSourceLengthMm;
    const wasteMm = physicalTotalMm - pieceLengthMm; // incluye los 90mm de saneamiento + sobrante del tramo corto

    options.push({
      type: 'splice',
      label: usesOffcut
        ? `Empalmar: 1 barra de ${(standardLength / 1000).toLocaleString('es-CL')}m + retazo existente de ${matchingOffcut!.lengthMm}mm`
        : `Empalmar: 1 barra de ${(standardLength / 1000).toLocaleString('es-CL')}m + 1 barra adicional (se corta un tramo de ${Math.ceil(extraNeededMm)}mm)`,
      barLengthUsedMm: standardLength,
      extraSegmentLengthMm: extraNeededMm,
      extraSegmentSource: usesOffcut ? 'offcut' : 'new_bar',
      extraSegmentOffcutId: usesOffcut ? matchingOffcut!.id : undefined,
      totalMaterialConsumedMm: physicalTotalMm,
      wasteMm,
      wastePercentage: Number(((wasteMm / physicalTotalMm) * 100).toFixed(2)),
      newBarsRequired: usesOffcut ? 1 : 2
    });
  }

  if (options.length === 0) return null;

  const recommended = options.reduce((best, o) => (o.wasteMm < best.wasteMm ? o : best), options[0]);

  return {
    pieceLengthMm,
    quantity,
    options,
    recommendedType: recommended.type
  };
}
