import { MaterialStockItem, CuttingPieceRequest, OptimizationSettings, RealtimeStockCheck } from '../types';
import { run1DNestingOptimization } from './nesting1D';

export function verifyStockRealtime(
  material: MaterialStockItem | null | undefined,
  pieces: CuttingPieceRequest[],
  settings: OptimizationSettings
): RealtimeStockCheck {
  if (!material || pieces.length === 0) {
    return {
      status: 'available',
      totalLinearMetersNeeded: 0,
      totalLinearMetersAvailableInStock: material
        ? ((material.standardBarsCount * material.standardBarLengthMm) +
            material.offcuts.reduce((sum, o) => sum + o.lengthMm, 0)) / 1000
        : 0,
      standardBarsAvailable: material?.standardBarsCount || 0,
      standardBarsNeededEstimated: 0,
      offcutsAvailableCount: material?.offcuts.length || 0,
      offcutsAvailableMeters: material
        ? material.offcuts.reduce((sum, o) => sum + o.lengthMm, 0) / 1000
        : 0,
      canFulfillWithCurrentStock: true,
      shortageMeters: 0,
      shortageBars: 0,
      message: 'Ingresa las medidas y cantidades para verificar el stock al instante.'
    };
  }

  // Calculate net length needed
  const totalNetPiecesLengthMm = pieces.reduce(
    (sum, p) => sum + (p.lengthMm > 0 && p.quantity > 0 ? p.lengthMm * p.quantity : 0),
    0
  );

  if (totalNetPiecesLengthMm === 0) {
    return {
      status: 'available',
      totalLinearMetersNeeded: 0,
      totalLinearMetersAvailableInStock:
        ((material.standardBarsCount * material.standardBarLengthMm) +
          material.offcuts.reduce((sum, o) => sum + o.lengthMm, 0)) / 1000,
      standardBarsAvailable: material.standardBarsCount,
      standardBarsNeededEstimated: 0,
      offcutsAvailableCount: material.offcuts.length,
      offcutsAvailableMeters: material.offcuts.reduce((sum, o) => sum + o.lengthMm, 0) / 1000,
      canFulfillWithCurrentStock: true,
      shortageMeters: 0,
      shortageBars: 0,
      message: 'Agrega piezas para comprobar el stock disponible.'
    };
  }

  // Run virtual optimization to test actual cut feasibility
  const result = run1DNestingOptimization(material, pieces, settings);

  const totalLinearMetersNeeded = Number((result.totalRawMaterialLengthMm / 1000).toFixed(2));
  const offcutsLengthTotalMm = material.offcuts.reduce((sum, o) => sum + o.lengthMm, 0);
  const totalAvailableLengthMm =
    material.standardBarsCount * material.standardBarLengthMm + offcutsLengthTotalMm;
  const totalLinearMetersAvailableInStock = Number((totalAvailableLengthMm / 1000).toFixed(2));

  const standardBarsAvailable = material.standardBarsCount;
  const offcutsAvailableCount = material.offcuts.length;
  const offcutsAvailableMeters = Number((offcutsLengthTotalMm / 1000).toFixed(2));

  const standardBarsNeeded = result.stockStandardBarsUsed + result.newBarsToBuy;
  const newBarsToBuy = result.newBarsToBuy;
  const missingPiecesCount = result.missingPieces.length;

  const canFulfill = newBarsToBuy === 0 && missingPiecesCount === 0;

  if (canFulfill) {
    const barsLeft = standardBarsAvailable - result.stockStandardBarsUsed;
    const offcutsLeft = offcutsAvailableCount - result.stockOffcutsUsed;

    return {
      status: 'available',
      totalLinearMetersNeeded,
      totalLinearMetersAvailableInStock,
      standardBarsAvailable,
      standardBarsNeededEstimated: result.stockStandardBarsUsed,
      offcutsAvailableCount,
      offcutsAvailableMeters,
      canFulfillWithCurrentStock: true,
      shortageMeters: 0,
      shortageBars: 0,
      message: `¡Stock 100% Disponible! Usarás ${result.stockStandardBarsUsed} barra(s) estándar y ${result.stockOffcutsUsed} retazo(s). Quedarán ${barsLeft} barras y ${offcutsLeft} retazos en bodega.`
    };
  }

  if (standardBarsAvailable === 0 && offcutsAvailableCount === 0) {
    const shortageMeters = totalLinearMetersNeeded;
    const shortageBars = Math.ceil(result.totalRawMaterialLengthMm / material.standardBarLengthMm);
    return {
      status: 'out_of_stock',
      totalLinearMetersNeeded,
      totalLinearMetersAvailableInStock: 0,
      standardBarsAvailable: 0,
      standardBarsNeededEstimated: shortageBars,
      offcutsAvailableCount: 0,
      offcutsAvailableMeters: 0,
      canFulfillWithCurrentStock: false,
      shortageMeters,
      shortageBars,
      message: `Sin stock en maestranza. Requieres comprar ${shortageBars} barra(s) de ${material.standardBarLengthMm / 1000}m (${shortageMeters}m totales).`
    };
  }

  // Partial stock
  const shortageMeters = Number(((newBarsToBuy * material.standardBarLengthMm) / 1000).toFixed(2));
  return {
    status: 'partial',
    totalLinearMetersNeeded,
    totalLinearMetersAvailableInStock,
    standardBarsAvailable,
    standardBarsNeededEstimated: standardBarsNeeded,
    offcutsAvailableCount,
    offcutsAvailableMeters,
    canFulfillWithCurrentStock: false,
    shortageMeters,
    shortageBars: newBarsToBuy,
    message: `Stock parcial: Tienes ${standardBarsAvailable} barras y ${offcutsAvailableCount} retazos, pero te faltan ${newBarsToBuy} barra(s) (${shortageMeters}m) para completar la cubicación.`
  };
}
