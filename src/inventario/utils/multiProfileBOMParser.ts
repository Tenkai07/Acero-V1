import { BOMPieceItem, BOMProfileGroup, MaterialStockItem } from '../types';

/**
 * Normalizes number strings from Excel/Tekla that might contain:
 * - Spaces: "2 936" -> 2936
 * - Decimal commas: "185,56" -> 185.56
 * - Formatted text: "2.936,00" or "2,936.00"
 */
export function cleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  
  let str = String(val).trim();
  // Remove thousand-separator spaces (e.g. "2 936" -> "2936")
  str = str.replace(/\s+/g, '');
  
  // If comma is decimal (e.g. "195,56")
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else if (str.includes('.') && str.includes(',')) {
    // If e.g. "1.234,56" or "1,234.56"
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }

  // Remove any remaining non-digit non-dot non-minus characters
  str = str.replace(/[^\d.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Extracts clean profile name (e.g. "Perfil : C250X50X4" -> "C250X50X4")
 */
export function cleanProfileName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^perfil\s*[:=\-]?\s*/i, '').trim();
  name = name.replace(/^profile\s*[:=\-]?\s*/i, '').trim();
  return name || raw.trim();
}

/**
 * Finds best matching material from inventory stock
 */
export function findMatchingInventoryMaterial(
  profileName: string,
  inventory: MaterialStockItem[]
): MaterialStockItem | undefined {
  const clean = cleanProfileName(profileName).toLowerCase().replace(/[\s\-_x*]/g, '');
  
  return inventory.find((mat) => {
    const matCode = mat.code.toLowerCase().replace(/[\s\-_x*]/g, '');
    const matName = mat.name.toLowerCase().replace(/[\s\-_x*]/g, '');
    const matDim = mat.dimensions.toLowerCase().replace(/[\s\-_x*]/g, '');

    return (
      matCode.includes(clean) ||
      clean.includes(matCode) ||
      matName.includes(clean) ||
      clean.includes(matDim) ||
      matDim.includes(clean)
    );
  });
}

// ---------------------------------------------------------------------------
// Formato "Lista Avanzada de Materiales" (ABM/AMCS): una hoja MAESTRA con
// TODOS los tipos de perfil de un proyecto juntos, agrupados en bloques
// separados por una fila "SUBTOTAL", con columnas fijas y conocidas
// ("Tipo Perfil | Grado | Cant. | Largo [mm] | Peso Unit. [kg] | Peso Total
// [kg]"). Es un formato distinto del "pegar desde Tekla/AutoCAD" (que usa
// filas "Perfil : XYZ" como separador) y del "una hoja de Excel por perfil"
// (ej. exportado desde STRUMIS) — este parser reconoce específicamente el
// formato ABM/AMCS a partir de su fila de encabezado, sin depender de
// heurísticas de posición de columna que fallan si el layout cambia.
// ---------------------------------------------------------------------------
interface AbmColumnMap {
  profileType: number;
  grade: number;
  qty: number;
  length: number;
  weightUnit: number;
  weightTotal: number;
}

function detectAbmHeaderRow(rows: any[][]): { rowIndex: number; columns: AbmColumnMap } | null {
  const maxScan = Math.min(rows.length, 40);
  for (let r = 0; r < maxScan; r++) {
    const row = (rows[r] || []).map((c) => String(c ?? '').trim().toLowerCase());
    const profileIdx = row.findIndex((c) => /^tipo\s*perfil$|^perfil$/.test(c));
    const qtyIdx = row.findIndex((c) => /^cant\.?$|^cantidad$/.test(c));
    const lengthIdx = row.findIndex((c) => /^largo/.test(c));
    if (profileIdx >= 0 && qtyIdx >= 0 && lengthIdx >= 0) {
      const gradeIdx = row.findIndex((c) => /^grado$|^calidad$/.test(c));
      const weightUnitIdx = row.findIndex((c) => /peso\s*unit/.test(c));
      const weightTotalIdx = row.findIndex((c) => /peso\s*total/.test(c));
      return {
        rowIndex: r,
        columns: { profileType: profileIdx, grade: gradeIdx, qty: qtyIdx, length: lengthIdx, weightUnit: weightUnitIdx, weightTotal: weightTotalIdx }
      };
    }
  }
  return null;
}

/**
 * Parsea la hoja maestra de un listado ABM/AMCS (recibida como matriz de
 * filas/columnas cruda, ej. desde `XLSX.utils.sheet_to_json(sheet, {header:1})`).
 * Devuelve [] si la hoja no tiene el encabezado esperado (no es este formato).
 */
export function parseAbmMasterSheet(rows: any[][], inventory: MaterialStockItem[] = []): BOMProfileGroup[] {
  const header = detectAbmHeaderRow(rows);
  if (!header) return [];
  const { rowIndex, columns } = header;

  const groups: BOMProfileGroup[] = [];
  let currentKey = '';
  let currentPieces: BOMPieceItem[] = [];
  let pieceCounter = 0;

  const flush = () => {
    if (currentPieces.length === 0) return;
    const cleanCode = cleanProfileName(currentKey);
    const matchedMat = findMatchingInventoryMaterial(cleanCode, inventory);
    const totalQty = currentPieces.reduce((s, p) => s + p.quantity, 0);
    const totalLen = currentPieces.reduce((s, p) => s + p.lengthMm * p.quantity, 0);
    const totalW = currentPieces.reduce((s, p) => s + p.weightKg, 0);

    groups.push({
      id: `grp-${Date.now()}-${groups.length + 1}`,
      profileName: currentKey,
      cleanProfileCode: cleanCode,
      matchedMaterialId: matchedMat?.id,
      commercialBarLengthMm: matchedMat?.standardBarLengthMm || 6000,
      pieces: [...currentPieces],
      totalPiecesCount: totalQty,
      totalLengthMm: totalLen,
      totalWeightKg: totalW,
      totalAreaM2: 0
    });
    currentPieces = [];
  };

  for (let r = rowIndex + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const isSubtotalRow = row.some((c) => String(c ?? '').trim().toUpperCase() === 'SUBTOTAL');
    if (isSubtotalRow) continue; // marca de cierre de bloque, no es una pieza

    const isBlankRow = row.every((c) => String(c ?? '').trim() === '');
    if (isBlankRow) continue;

    const profileRaw = String(row[columns.profileType] ?? '').trim();
    if (!profileRaw) continue;

    if (profileRaw !== currentKey) {
      flush();
      currentKey = profileRaw;
    }

    const length = cleanNumber(row[columns.length]);
    if (length <= 0) continue;

    const qty = Math.max(1, Math.round(cleanNumber(row[columns.qty])) || 1);
    const weightUnit = columns.weightUnit >= 0 ? cleanNumber(row[columns.weightUnit]) : 0;
    const weightTotal = columns.weightTotal >= 0 ? cleanNumber(row[columns.weightTotal]) : weightUnit * qty;
    const grade = (columns.grade >= 0 ? String(row[columns.grade] ?? '').trim() : '') || 'A36';

    pieceCounter++;
    currentPieces.push({
      id: `pc-${Date.now()}-${pieceCounter}-${Math.random().toString(36).substring(2, 6)}`,
      itemNumber: `${cleanProfileName(profileRaw)}-${pieceCounter}`,
      grade,
      lengthMm: length,
      quantity: qty,
      weightKg: weightTotal,
      areaM2: 0
    });
  }
  flush();

  return groups;
}

/**
 * Parses raw BOM text from Excel (Copy-Paste), CSV, TSV or Tekla exports
 */
export function parseMultiProfileBOM(
  rawText: string,
  inventory: MaterialStockItem[] = []
): BOMProfileGroup[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const groups: BOMProfileGroup[] = [];
  let currentPiecesBuffer: BOMPieceItem[] = [];
  let currentPendingProfileName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is a header row (e.g. "Cantidad  Nombre  Calidad  Longitud / mm...")
    if (
      /cantidad/i.test(line) &&
      (/longitud/i.test(line) || /nombre/i.test(line) || /peso/i.test(line))
    ) {
      continue;
    }

    // Split by tabs or semicolons or commas
    const parts = line.includes('\t')
      ? line.split('\t').map((s) => s.trim())
      : line.includes(';')
      ? line.split(';').map((s) => s.trim())
      : line.split(',').map((s) => s.trim());

    // Check if line is a Profile Group Header / Summary row (e.g. "Perfil : C250X50X4  9 Lim01  A36  18 577  195.56  12.6")
    const hasPerfilKeyword = parts.some((p) => /perfil\s*[:=\-]/i.test(p));
    
    if (hasPerfilKeyword) {
      // Find which part has the "Perfil : XYZ"
      const profilePart = parts.find((p) => /perfil\s*[:=\-]/i.test(p)) || parts[0];
      const rawProfileName = profilePart;
      const cleanCode = cleanProfileName(rawProfileName);
      const matchedMat = findMatchingInventoryMaterial(cleanCode, inventory);

      // In Tekla/Excel formats, the summary row "Perfil : XYZ" often appears AFTER the piece list
      if (currentPiecesBuffer.length > 0) {
        const totalQty = currentPiecesBuffer.reduce((s, p) => s + p.quantity, 0);
        const totalLen = currentPiecesBuffer.reduce((s, p) => s + p.lengthMm * p.quantity, 0);
        const totalW = currentPiecesBuffer.reduce((s, p) => s + p.weightKg, 0);
        const totalA = currentPiecesBuffer.reduce((s, p) => s + p.areaM2, 0);

        groups.push({
          id: `grp-${Date.now()}-${groups.length + 1}`,
          profileName: rawProfileName,
          cleanProfileCode: cleanCode,
          matchedMaterialId: matchedMat?.id,
          commercialBarLengthMm: matchedMat?.standardBarLengthMm || 6000,
          pieces: [...currentPiecesBuffer],
          totalPiecesCount: totalQty,
          totalLengthMm: totalLen,
          totalWeightKg: totalW,
          totalAreaM2: totalA
        });

        currentPiecesBuffer = [];
        currentPendingProfileName = '';
      } else {
        // If "Perfil : XYZ" appears BEFORE the piece list
        currentPendingProfileName = rawProfileName;
      }
      continue;
    }

    // Normal piece row parsing
    // Expected structure: [Cantidad, Nombre, Calidad, Longitud, Peso, Área]
    // Or [Nombre, Cantidad, Longitud...]
    if (parts.length >= 3) {
      let qty = 1;
      let label = 'Pieza';
      let grade = 'A36';
      let length = 0;
      let weight = 0;
      let area = 0;

      // Detect column positions
      // Typically: Col 0 = Cantidad (number), Col 1 = Nombre (string), Col 2 = Calidad, Col 3 = Longitud (mm), Col 4 = Peso, Col 5 = Area
      const val0 = cleanNumber(parts[0]);
      const val1 = cleanNumber(parts[1]);
      const val3 = parts[3] ? cleanNumber(parts[3]) : 0;

      if (!isNaN(val0) && val0 > 0 && val0 <= 500 && parts[1] && isNaN(Number(parts[1]))) {
        // Col 0 is Quantity (e.g. 1, 2, 4, 12, 20)
        qty = Math.round(val0);
        label = parts[1] || 'Pieza';
        grade = parts[2] || 'A36';
        length = val3 || cleanNumber(parts[2]);
        weight = parts[4] ? cleanNumber(parts[4]) : 0;
        area = parts[5] ? cleanNumber(parts[5]) : 0;
      } else if (val1 > 50) {
        // Col 0 = Label, Col 1 = Length, Col 2 = Quantity
        label = parts[0];
        length = val1;
        qty = Math.max(1, Math.round(cleanNumber(parts[2])));
        grade = parts[3] || 'A36';
      } else {
        // Generic fallback search for length (usually largest number > 50)
        const numbers = parts.map((p) => cleanNumber(p)).filter((n) => n > 0);
        if (numbers.length >= 2) {
          const maxNum = Math.max(...numbers);
          const minNum = Math.min(...numbers);
          length = maxNum;
          qty = Math.max(1, Math.round(minNum));
          label = parts.find((p) => isNaN(Number(p.replace(/[^\w]/g, '')))) || 'Pieza';
        }
      }

      if (length > 0) {
        currentPiecesBuffer.push({
          id: `pc-${Date.now()}-${currentPiecesBuffer.length + 1}-${Math.random().toString(36).substring(2, 6)}`,
          itemNumber: label,
          grade: grade || 'A36',
          lengthMm: length,
          quantity: qty,
          weightKg: weight,
          areaM2: area
        });
      }
    }
  }

  // If there's any remaining pieces in buffer (e.g. for header-first format)
  if (currentPiecesBuffer.length > 0) {
    const profName = currentPendingProfileName || 'Perfil Estructural General';
    const cleanCode = cleanProfileName(profName);
    const matchedMat = findMatchingInventoryMaterial(cleanCode, inventory);

    const totalQty = currentPiecesBuffer.reduce((s, p) => s + p.quantity, 0);
    const totalLen = currentPiecesBuffer.reduce((s, p) => s + p.lengthMm * p.quantity, 0);
    const totalW = currentPiecesBuffer.reduce((s, p) => s + p.weightKg, 0);
    const totalA = currentPiecesBuffer.reduce((s, p) => s + p.areaM2, 0);

    groups.push({
      id: `grp-${Date.now()}-${groups.length + 1}`,
      profileName: profName,
      cleanProfileCode: cleanCode,
      matchedMaterialId: matchedMat?.id,
      commercialBarLengthMm: matchedMat?.standardBarLengthMm || 6000,
      pieces: [...currentPiecesBuffer],
      totalPiecesCount: totalQty,
      totalLengthMm: totalLen,
      totalWeightKg: totalW,
      totalAreaM2: totalA
    });
  }

  return groups;
}
