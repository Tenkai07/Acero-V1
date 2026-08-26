import { BOMPieceItem } from '../types';

export interface SpliceResult {
  originalLengthMm: number;
  maxSegmentMm: number;
  overlapMm: number;
  segmentsCount: number;
  segments: {
    lengthMm: number;
    isLast: boolean;
    label: string;
  }[];
  totalConsumedMaterialMm: number;
}

/**
 * Calculates segments for a long steel piece requiring splices (empalmes / traslapos)
 * @param totalLengthMm Length of the long piece in mm (e.g. 26115 mm)
 * @param maxSegmentMm Commercial standard bar length or transport limit (e.g. 6000 mm)
 * @param overlapMm Splice overlap allowance (e.g. 0 mm for butt-weld, 150 mm for sleeve/splice joint)
 */
export function calculateSplices(
  totalLengthMm: number,
  maxSegmentMm: number = 6000,
  overlapMm: number = 0
): SpliceResult {
  if (totalLengthMm <= maxSegmentMm) {
    return {
      originalLengthMm: totalLengthMm,
      maxSegmentMm,
      overlapMm,
      segmentsCount: 1,
      segments: [{ lengthMm: totalLengthMm, isLast: true, label: `Tramo 1 (Total)` }],
      totalConsumedMaterialMm: totalLengthMm
    };
  }

  // Effective length covered by full segments = maxSegmentMm - overlapMm
  const effectiveSegment = maxSegmentMm - overlapMm;
  const segments: { lengthMm: number; isLast: boolean; label: string }[] = [];

  let remainingLengthToCover = totalLengthMm;
  let segIndex = 1;

  while (remainingLengthToCover > 0) {
    if (remainingLengthToCover <= maxSegmentMm) {
      segments.push({
        lengthMm: Math.round(remainingLengthToCover),
        isLast: true,
        label: `Tramo ${segIndex} (Final)`
      });
      break;
    } else {
      segments.push({
        lengthMm: maxSegmentMm,
        isLast: false,
        label: `Tramo ${segIndex} (Empalme)`
      });
      remainingLengthToCover -= effectiveSegment;
      segIndex++;
    }
  }

  const totalConsumed = segments.reduce((s, seg) => s + seg.lengthMm, 0);

  return {
    originalLengthMm: totalLengthMm,
    maxSegmentMm,
    overlapMm,
    segmentsCount: segments.length,
    segments,
    totalConsumedMaterialMm: totalConsumed
  };
}

/**
 * Applies splices to a BOMPieceItem, returning an array of segmented pieces
 */
export function applySpliceToPiece(
  piece: BOMPieceItem,
  maxSegmentMm: number = 6000,
  overlapMm: number = 0
): BOMPieceItem[] {
  if (piece.lengthMm <= maxSegmentMm) {
    return [piece];
  }

  const spliceRes = calculateSplices(piece.lengthMm, maxSegmentMm, overlapMm);
  const result: BOMPieceItem[] = [];

  spliceRes.segments.forEach((seg, idx) => {
    result.push({
      id: `${piece.id}-seg-${idx + 1}`,
      itemNumber: `${piece.itemNumber} (T${idx + 1}/${spliceRes.segmentsCount})`,
      grade: piece.grade,
      lengthMm: seg.lengthMm,
      quantity: piece.quantity, // Every parent piece produces this segment
      weightKg: piece.weightKg ? (piece.weightKg * seg.lengthMm) / piece.lengthMm : 0,
      areaM2: piece.areaM2 ? (piece.areaM2 * seg.lengthMm) / piece.lengthMm : 0,
      originalLengthMm: piece.lengthMm,
      isSpliced: true
    });
  });

  return result;
}
