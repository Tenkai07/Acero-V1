import {
  BOMProfileGroup,
  MaterialStockItem,
  OptimizationSettings,
  OptimizationResult,
  CuttingPieceRequest
} from '../types';
import { run1DNestingOptimization } from './nesting1D';
import { COLOR_PALETTE } from '../data/initialStock';
import { getReservedBarsCount, getReservedOffcuts } from './stockReservations';

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
 * Runs 1D Pre-Nesting and Warehouse Stock Analysis for an entire multi-profile BOM project
 */
export function runProjectPreNesting(
  groups: BOMProfileGroup[],
  inventory: MaterialStockItem[],
  settings: OptimizationSettings
): {
  updatedGroups: BOMProfileGroup[];
  consolidatedReport: ConsolidatedPurchaseReport;
} {
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

    const barLength = group.commercialBarLengthMm || matchedMat?.standardBarLengthMm || 6000;

    // 1. PURE THEORETICAL 1D NESTING (100% new bars, 0 stock)
    const pureTheoreticalMaterial: MaterialStockItem = {
      id: `pure-theo-${group.id}`,
      code: group.cleanProfileCode,
      name: group.profileName,
      category: 'otro',
      dimensions: group.cleanProfileCode,
      grade: group.pieces[0]?.grade || 'A36',
      theoreticalWeightPerMeter: derivedKgM,
      costPerMeter: matchedMat?.costPerMeter || derivedKgM * 1400,
      standardBarLengthMm: barLength,
      standardBarsCount: 0,
      offcuts: [],
      minStockBars: 0,
      location: 'Material Nuevo',
      lastUpdated: new Date().toISOString()
    };
    const pureTheoreticalNestingResult = run1DNestingOptimization(
      pureTheoreticalMaterial,
      pieceRequests,
      { ...settings, prioritizeOffcuts: false }
    );

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
          lastUpdated: new Date().toISOString()
        };

    const nestingRes = run1DNestingOptimization(effectiveMaterial, pieceRequests, settings);

    // Stock check
    const stockBarsAvail = effectiveMaterial.standardBarsCount;
    const stockOffcutsAvail = effectiveMaterial.offcuts.length;
    const barsNeededTotal = nestingRes.totalBarsUsed;
    const barsFromStock = nestingRes.stockStandardBarsUsed;
    const offcutsFromStock = nestingRes.stockOffcutsUsed;
    const barsToBuy = nestingRes.newBarsToBuy;

    const metersToBuy = (barsToBuy * effectiveMaterial.standardBarLengthMm) / 1000;
    const weightToBuyKg = Number((metersToBuy * effectiveMaterial.theoreticalWeightPerMeter).toFixed(2));
    const costToBuy = Math.round(metersToBuy * effectiveMaterial.costPerMeter);

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
        : `🛒 Debes comprar ${barsToBuy} barras de ${(effectiveMaterial.standardBarLengthMm / 1000).toFixed(0)}m (${metersToBuy.toFixed(2)} m)`) +
      reservedNote;

    const updatedGroup: BOMProfileGroup = {
      ...group,
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
    const groupTheoMeters = (groupTheoBars * barLength) / 1000;
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
