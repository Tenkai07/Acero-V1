import { CuttingPieceRequest } from '../types';
import { COLOR_PALETTE } from '../data/initialStock';

/**
 * Parses unstructured or semi-structured text into CuttingPieceRequest items.
 * Handles formats like:
 * - "1450 x 4" or "4 x 1450"
 * - "4 de 1450 mm Columna C1"
 * - "Columna 1: 4 pzas de 1250mm"
 * - Excel tab-separated columns (Label \t Length \t Quantity)
 * - CSV lines (Label, Length, Quantity)
 */
export function parseCuttingListText(text: string): CuttingPieceRequest[] {
  if (!text || text.trim() === '') return [];

  const lines = text.split(/\r?\n/);
  const results: CuttingPieceRequest[] = [];
  let colorIndex = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Check for Tab or CSV separated data
    const parts = line.includes('\t')
      ? line.split('\t').map((s) => s.trim())
      : line.includes(';')
      ? line.split(';').map((s) => s.trim())
      : line.includes(',') && !line.includes('de')
      ? line.split(',').map((s) => s.trim())
      : null;

    if (parts && parts.length >= 2) {
      // Could be [Label, Length, Qty] or [Length, Qty, Label] or [Qty, Length]
      let label = 'Pieza';
      let length = 0;
      let qty = 1;

      // Extract numbers
      const num1 = parseFloat(parts[0].replace(/[^\d.]/g, ''));
      const num2 = parseFloat(parts[1].replace(/[^\d.]/g, ''));
      const num3 = parts[2] ? parseFloat(parts[2].replace(/[^\d.]/g, '')) : NaN;

      if (!isNaN(num1) && !isNaN(num2) && !isNaN(num3)) {
        // 3 numbers or mixed
        // Determine which is length (usually > 50) and which is qty (usually <= 100)
        if (num2 > 50) {
          label = parts[0];
          length = num2;
          qty = Math.max(1, Math.round(num3));
        } else {
          label = parts[2];
          length = num1;
          qty = Math.max(1, Math.round(num2));
        }
      } else if (!isNaN(num1) && !isNaN(num2)) {
        if (num1 > 100 && num2 <= 100) {
          length = num1;
          qty = Math.max(1, Math.round(num2));
          label = parts[2] || `Pza ${length}mm`;
        } else if (num2 > 100 && num1 <= 100) {
          qty = Math.max(1, Math.round(num1));
          length = num2;
          label = parts[2] || `Pza ${length}mm`;
        } else {
          length = Math.max(num1, num2);
          qty = Math.max(1, Math.round(Math.min(num1, num2)));
          label = parts[2] || `Pza ${length}mm`;
        }
      }

      if (length > 0) {
        results.push({
          id: `cut-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          label: label || `Pza ${length}mm`,
          lengthMm: length,
          quantity: qty,
          color: COLOR_PALETTE[colorIndex % COLOR_PALETTE.length]
        });
        colorIndex++;
        continue;
      }
    }

    // Natural Spanish regex patterns:
    // 1. "4 de 1500" or "4x1500" or "4 x 1500 mm" or "4 pzas 1500"
    // 2. "1500 x 4"
    // 3. "Columna C1: 4 de 1250mm"
    
    // Pattern with Label prefix e.g. "Viga V-1: 6 de 2400"
    let label = '';
    let remainingLine = line;

    if (line.includes(':')) {
      const splitColon = line.split(':');
      label = splitColon[0].trim();
      remainingLine = splitColon.slice(1).join(':').trim();
    } else if (line.includes('-') && isNaN(Number(line.split('-')[0].trim()))) {
      const splitDash = line.split('-');
      label = splitDash[0].trim();
      remainingLine = splitDash.slice(1).join('-').trim();
    }

    // Match "4 de 1250", "4 x 1250", "4*1250", "4 pzas 1250"
    const matchQtyFirst = remainingLine.match(
      /(\d+)\s*(?:pzas?|unid(?:ades)?|cant(?:idad)?|de|x|\*)\s*(\d+(?:[.,]\d+)?)\s*(?:mm|m|cm)?(?:\s+(.*))?/i
    );

    // Match "1250 x 4", "1250mm x 4"
    const matchLengthFirst = remainingLine.match(
      /(\d+(?:[.,]\d+)?)\s*(?:mm|m|cm)?\s*(?:x|\*|de|pzas?)\s*(\d+)(?:\s+(.*))?/i
    );

    if (matchQtyFirst) {
      let qty = parseInt(matchQtyFirst[1], 10);
      let len = parseFloat(matchQtyFirst[2].replace(',', '.'));
      let extraLabel = matchQtyFirst[3]?.trim();

      // If unit is in meters (e.g. 1.5m), convert to mm
      if (len < 30 && (remainingLine.includes('m') || len % 1 !== 0)) {
        len = Math.round(len * 1000);
      } else if (len < 100 && remainingLine.includes('cm')) {
        len = Math.round(len * 10);
      }

      if (len > 0 && qty > 0) {
        results.push({
          id: `cut-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          label: label || extraLabel || `Pza ${len}mm`,
          lengthMm: len,
          quantity: qty,
          color: COLOR_PALETTE[colorIndex % COLOR_PALETTE.length]
        });
        colorIndex++;
        continue;
      }
    } else if (matchLengthFirst) {
      let len = parseFloat(matchLengthFirst[1].replace(',', '.'));
      let qty = parseInt(matchLengthFirst[2], 10);
      let extraLabel = matchLengthFirst[3]?.trim();

      if (len < 30 && (remainingLine.includes('m') || len % 1 !== 0)) {
        len = Math.round(len * 1000);
      } else if (len < 100 && remainingLine.includes('cm')) {
        len = Math.round(len * 10);
      }

      if (len > 0 && qty > 0) {
        results.push({
          id: `cut-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          label: label || extraLabel || `Pza ${len}mm`,
          lengthMm: len,
          quantity: qty,
          color: COLOR_PALETTE[colorIndex % COLOR_PALETTE.length]
        });
        colorIndex++;
        continue;
      }
    } else {
      // Single number alone on line (assume 1 piece of that length)
      const singleNum = parseFloat(remainingLine.replace(/[^\d.]/g, ''));
      if (!isNaN(singleNum) && singleNum > 50) {
        results.push({
          id: `cut-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          label: label || `Pza ${singleNum}mm`,
          lengthMm: singleNum,
          quantity: 1,
          color: COLOR_PALETTE[colorIndex % COLOR_PALETTE.length]
        });
        colorIndex++;
      }
    }
  }

  return results;
}
