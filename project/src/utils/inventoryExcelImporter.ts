import * as XLSX from "xlsx";

export interface ParsedInventoryRow {
  name: string; // ej. "RHS100X3-A500-GrB"
  sectionType: string; // ej. "Rectangular Hollow Sections - Hot Rolled"
  grade: string; // ej. "A500-GrB"
  quantity: number;
  lengthMm: number;
  weightKg: number; // peso total de la fila (todas las piezas de esa fila)
  purchaseOrder?: string;
  trackingNumbers?: string;
}

export interface ExcelInventoryImportResult {
  rows: ParsedInventoryRow[];
  sheetUsed: string;
  sheetsAvailable: string[];
  totalParsed: number;
}

/** Normaliza encabezados para detección flexible: quita acentos, pasa a snake_case */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseNumericCell(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d.,-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Intenta parsear una hoja como planilla de registro de piezas/inventario
 * (formato con columnas como "Tipo de línea", "Cantidad", "Nombre", "Calidad",
 * "Longitud", "Peso (kg)", "Orden de compra", "Número de seguimiento", etc.
 * — típico de exportaciones de control de materiales con trazabilidad).
 */
function parseInventorySheet(sheet: XLSX.WorkSheet): ParsedInventoryRow[] {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rawRows.length === 0) return [];

  // Buscar la fila de encabezados (primeras 5 filas)
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const rowStr = row.map((c) => String(c).toLowerCase()).join(" ");
    if (rowStr.includes("cantidad") && rowStr.includes("nombre")) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) return [];

  const rawHeaders: string[] = (rawRows[headerRowIndex] || []).map((h: any) => String(h || "").trim());
  const headerMap: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    headerMap[normalizeHeader(h)] = idx;
  });

  const findCol = (aliases: string[]): number => {
    for (const alias of aliases) {
      const normAlias = normalizeHeader(alias);
      if (headerMap[normAlias] !== undefined) return headerMap[normAlias];
    }
    // fallback: substring match
    for (const alias of aliases) {
      const normAlias = normalizeHeader(alias);
      for (const [key, idx] of Object.entries(headerMap)) {
        if (key.includes(normAlias)) return idx;
      }
    }
    return -1;
  };

  const colLineType = findCol(["tipo de linea", "tipo_linea"]);
  const colSectionType = findCol(["tipo de seccion", "tipo_seccion"]);
  const colQty = findCol(["cantidad", "cant", "qty"]);
  const colName = findCol(["nombre", "descripcion", "perfil"]);
  const colGrade = findCol(["calidad", "grado", "grade"]);
  const colLength = findCol(["longitud", "largo"]);
  const colWeight = findCol(["peso (kg)", "peso_kg", "peso"]);
  const colPO = findCol(["orden de compra", "orden_compra", "po"]);
  const colTracking = findCol(["numero de seguimiento", "numero_seguimiento", "tracking"]);

  if (colQty === -1 || colName === -1) return [];

  const rows: ParsedInventoryRow[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row) || row.every((c) => String(c).trim() === "")) continue;

    const getVal = (col: number): string => (col === -1 || col >= row.length ? "" : String(row[col] ?? "").trim());

    // Si existe columna "Tipo de línea", solo tomar filas de tipo "Elemento" (ignora subtotales/encabezados de sección)
    const lineType = getVal(colLineType);
    if (colLineType !== -1 && lineType && !/elemento/i.test(lineType)) continue;

    const name = getVal(colName);
    if (!name) continue;

    const quantity = Math.max(1, Math.round(parseNumericCell(getVal(colQty)) || 1));
    const lengthMm = parseNumericCell(getVal(colLength));
    const weightKg = parseNumericCell(getVal(colWeight));
    const grade = getVal(colGrade) || "A36";
    const sectionType = getVal(colSectionType);
    const purchaseOrder = getVal(colPO) || undefined;
    const trackingNumbers = getVal(colTracking) || undefined;

    rows.push({
      name,
      sectionType,
      grade,
      quantity,
      lengthMm,
      weightKg,
      purchaseOrder,
      trackingNumbers
    });
  }

  return rows;
}

/**
 * Lee un archivo Excel de inventario/registro de piezas. Prueba todas las
 * hojas y usa la que entregue más filas válidas.
 */
export async function readInventoryRowsFromExcelFile(file: File): Promise<ExcelInventoryImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  let bestRows: ParsedInventoryRow[] = [];
  let bestSheet = "";

  for (const sheetName of workbook.SheetNames) {
    const rows = parseInventorySheet(workbook.Sheets[sheetName]);
    if (rows.length > bestRows.length) {
      bestRows = rows;
      bestSheet = sheetName;
    }
  }

  return {
    rows: bestRows,
    sheetUsed: bestSheet,
    sheetsAvailable: workbook.SheetNames,
    totalParsed: bestRows.length
  };
}

/**
 * Agrupa filas idénticas (mismo nombre + calidad + largo) sumando cantidad y
 * peso, para no saturar la lista del proyecto con cientos de líneas casi
 * idénticas cuando el archivo trae una fila por lote/trazabilidad.
 */
export function groupInventoryRows(rows: ParsedInventoryRow[]): ParsedInventoryRow[] {
  const map = new Map<string, ParsedInventoryRow>();

  for (const row of rows) {
    const key = `${row.name}__${row.grade}__${Math.round(row.lengthMm)}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += row.quantity;
      existing.weightKg += row.weightKg;
      if (row.purchaseOrder && existing.purchaseOrder && !existing.purchaseOrder.includes(row.purchaseOrder)) {
        existing.purchaseOrder += `, ${row.purchaseOrder}`;
      }
    } else {
      map.set(key, { ...row });
    }
  }

  return Array.from(map.values());
}
