import * as XLSX from "xlsx";

export interface SoftlandConsumptionRow {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rawIndex: number;
}

export interface ColumnMapping {
  codeCol: number;
  quantityCol: number;
  descriptionCol: number; // -1 si no se detectó/seleccionó
  unitCol: number; // -1 si no se detectó/seleccionó
}

export interface SoftlandImportResult {
  headers: string[];
  rawRows: any[][];
  detectedMapping: ColumnMapping | null; // null si no se pudo adivinar con confianza
  rows: SoftlandConsumptionRow[]; // vacío si detectedMapping es null (falta mapear a mano)
}

function normalizeHeader(h: string): string {
  return (h || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .trim();
}

const CODE_HINTS = ["codigo", "cod articulo", "cod. articulo", "codigo articulo", "sku", "cod", "articulo"];
const QTY_HINTS = ["cantidad", "cant consumida", "cantidad consumida", "cant", "qty", "consumo", "unidades"];
const DESC_HINTS = ["descripcion", "detalle", "nombre articulo", "producto", "nombre"];
const UNIT_HINTS = ["unidad", "um", "unidad medida", "u.m", "u.m."];
const ALL_HINTS = [...CODE_HINTS, ...QTY_HINTS, ...DESC_HINTS, ...UNIT_HINTS];

function findColumn(headers: string[], hints: string[]): number {
  const normalized = headers.map(normalizeHeader);
  // 1) coincidencia exacta primero
  for (const hint of hints) {
    const idx = normalized.findIndex((h) => h === hint);
    if (idx >= 0) return idx;
  }
  // 2) coincidencia por substring
  for (const hint of hints) {
    const idx = normalized.findIndex((h) => h.includes(hint));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Los reportes exportados desde Softland (ej. "Informe de Productos
 * Paramétrico") suelen traer varias filas de título/filtros ANTES de la
 * fila real de encabezados (título del informe, "Ordenado por...", "Todos
 * los Productos", una fila en blanco, y recién ahí los encabezados). Asumir
 * que la fila 1 siempre es el encabezado rompe con archivos reales de
 * Softland. Por eso se escanean las primeras ~20 filas y se elige la que
 * más coincide con nombres de columna conocidos.
 */
function findHeaderRowIndex(rows: any[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).map((c) => normalizeHeader(String(c ?? "")));
    const nonEmptyCount = cells.filter((c) => c.length > 0).length;
    if (nonEmptyCount < 2) continue; // filas de título con una sola celda no son encabezado
    const score = cells.filter((c) => ALL_HINTS.some((hint) => c.includes(hint))).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore > 0 ? bestIdx : 0;
}

/**
 * Lee un Excel exportado desde Softland (reporte de consumo/despacho de
 * bodega) e intenta detectar automáticamente qué columna es el código de
 * artículo, la cantidad y (si existen) descripción/unidad. Como no conocemos
 * el layout exacto de cada instalación de Softland, si la detección no es
 * confiable se retorna detectedMapping=null para que la interfaz pida al
 * usuario mapear las columnas manualmente en vez de adivinar mal.
 */
export async function parseSoftlandExcelFile(file: File): Promise<SoftlandImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  if (allRows.length === 0) {
    return { headers: [], rawRows: [], detectedMapping: null, rows: [] };
  }

  const headerRowIdx = findHeaderRowIndex(allRows);
  const headers = (allRows[headerRowIdx] || []).map((h) => String(h ?? "").trim());
  const dataRows = allRows.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== "" && c !== null && c !== undefined));

  const codeCol = findColumn(headers, CODE_HINTS);
  const quantityCol = findColumn(headers, QTY_HINTS);
  const descriptionCol = findColumn(headers, DESC_HINTS);
  const unitCol = findColumn(headers, UNIT_HINTS);

  const detectedMapping = codeCol >= 0 && quantityCol >= 0 ? { codeCol, quantityCol, descriptionCol, unitCol } : null;

  return {
    headers,
    rawRows: dataRows,
    detectedMapping,
    rows: detectedMapping ? buildRowsFromMapping(dataRows, detectedMapping) : []
  };
}

/** Reconstruye las filas usando un mapeo de columnas (automático o elegido a mano por el usuario). */
export function buildRowsFromMapping(rawRows: any[][], mapping: ColumnMapping): SoftlandConsumptionRow[] {
  return rawRows
    .map((r, idx) => {
      const code = String(r[mapping.codeCol] ?? "").trim();
      const quantityRaw = r[mapping.quantityCol];
      const quantity = typeof quantityRaw === "number" ? quantityRaw : parseFloat(String(quantityRaw).replace(",", "."));
      return {
        code,
        description: mapping.descriptionCol >= 0 ? String(r[mapping.descriptionCol] ?? "").trim() : "",
        quantity: isNaN(quantity) ? 0 : quantity,
        unit: mapping.unitCol >= 0 ? String(r[mapping.unitCol] ?? "").trim() : "",
        rawIndex: idx
      };
    })
    .filter((r) => r.code.length > 0);
}
