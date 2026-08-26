import { CutBarPlan, CuttingPieceRequest, MaterialStockItem, OptimizationResult, OptimizationSettings } from '../types';
import { run1DNestingOptimization } from './nesting1D';
import { getSpliceFacingLossMm } from './commercialLengths';

/**
 * Estrategia "tira empalmada": en vez de cortar cada barra comercial por
 * separado, primero se SUELDAN dos barras del mismo largo comercial
 * (ej. 12m + 12m = tira de 24m) y recién después se corta la tira completa
 * como si fuera una sola barra larga. Es exactamente lo que hace el
 * usuario a mano cuando en su herramienta declara materia prima de
 * "24000mm" siendo que la fábrica solo vende de 12m.
 *
 * Por qué importa: dos piezas de 8m NO caben en una barra de 12m (16m >
 * 12m), así que cortando barra por barra cada una desperdicia ~4m. En una
 * tira de 24m caben TRES piezas de 8m casi exactas. La única pieza que
 * queda "sobre" la soldadura lleva el empalme; las demás salen enteras.
 *
 * Reglas de negocio que se respetan:
 *  - Cada tira tiene UNA sola unión, y por la geometría del corte
 *    secuencial como máximo UNA pieza puede quedar sobre ella — así que
 *    ninguna pieza termina con dos empalmes.
 *  - Se compra siempre del mismo largo comercial único (el usuario cotiza
 *    a un solo largo): una tira de 24m son 2 barras de 12m compradas.
 *  - La soldadura consume el saneamiento propio del perfil
 *    (`getSpliceFacingLossMm`: 90mm en ángulos, 5mm en el resto).
 */
export function runSplicedStripNesting(
  material: MaterialStockItem,
  pieceRequests: CuttingPieceRequest[],
  settings: OptimizationSettings,
  singleBarLengthMm: number
): OptimizationResult | null {
  const stripLengthMm = singleBarLengthMm * 2;
  const spliceFacingLossMm = getSpliceFacingLossMm(material.code, material.category, settings.spliceFacingLossMm ?? 5);

  // La tira se modela como UNA barra de 2L: así `totalRawMaterialLengthMm`
  // (que suma `sourceLengthMm`) cuenta el material realmente comprado
  // (2 barras de L). La pérdida por saneamiento de la unión se carga al
  // `trimCutMm` de la corrida: reduce la capacidad útil exactamente en lo
  // que corresponde, sin ensuciar el conteo de material comprado.
  //
  // `allowMultipleStandardLengths: false` es deliberado: la tira YA
  // contiene el único empalme permitido por pieza, así que la lógica de
  // empalme de `nesting1D` (que agregaría otro) debe quedar apagada acá.
  // Una pieza que ni siquiera cabe en la tira necesitaría 2+ empalmes y
  // se reporta como pendiente, que es lo correcto.
  const stripMaterial: MaterialStockItem = {
    ...material,
    standardBarLengthMm: stripLengthMm,
    alternateBarLengthsMm: undefined,
    // La tira se arma con barras nuevas — el stock de bodega está a largo
    // simple y se evalúa en la estrategia normal, no acá.
    standardBarsCount: 0,
    offcuts: []
  };
  const stripSettings: OptimizationSettings = {
    ...settings,
    trimCutMm: settings.trimCutMm + spliceFacingLossMm,
    allowMultipleStandardLengths: false,
    prioritizeOffcuts: false
  };

  const result = run1DNestingOptimization(stripMaterial, pieceRequests, stripSettings, [stripLengthMm]);
  if (result.barPlans.length === 0) return null;

  // Posición de la soldadura dentro de la tira. Aproximada a `L` a
  // propósito: el saneamiento se cargó al frente (ver arriba) en vez de
  // en la unión, así que la unión real cae unos milímetros más allá. Solo
  // se usa para SABER QUÉ PIEZA lleva el empalme (etiqueta y conteo), no
  // para calcular material, así que el desfase no afecta las cantidades.
  const jointPositionMm = singleBarLengthMm;

  let splicedStripsCount = 0;
  const relabeledPlans: CutBarPlan[] = result.barPlans.map((plan) => {
    const cuts = plan.cuts.map((cut) => {
      const startMm = cut.stopPositionMm - cut.lengthMm;
      const crossesJoint = startMm < jointPositionMm && cut.stopPositionMm > jointPositionMm;
      if (!crossesJoint) return cut;
      return {
        ...cut,
        label: `${cut.label} (empalmada sobre la unión de la tira, incl. ${spliceFacingLossMm}mm de saneo)`
      };
    });

    const hasJointPiece = cuts.some((c) => c.label.includes('empalmada sobre la unión'));
    if (hasJointPiece) splicedStripsCount++;

    return {
      ...plan,
      cuts,
      sourceLocation: `Tira empalmada: 2 barras de ${(singleBarLengthMm / 1000).toLocaleString('es-CL')}m soldadas (${(stripLengthMm / 1000).toLocaleString('es-CL')}m)`
    };
  });

  // Una tira son DOS barras compradas: los conteos de barras se expresan
  // en barras reales (que es lo que se cotiza y se recibe), aunque el plan
  // de corte se ejecute sobre la tira completa.
  const realBarsCount = result.barPlans.length * 2;

  return {
    ...result,
    barPlans: relabeledPlans,
    totalBarsUsed: realBarsCount,
    newBarsToBuy: realBarsCount,
    stockStandardBarsUsed: 0,
    stockOffcutsUsed: 0,
    splicedStripsCount
  };
}
