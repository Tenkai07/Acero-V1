import * as XLSX from "xlsx";

export interface ParsedBOMPiece {
  itemNumber: string;
  grade: string;
  lengthMm: number;
  quantity: number;
  weightKg: number;
  areaM2: number;
}

export interface ParsedBOMGroup {
  profileName: string;
  cleanProfileCode: string;
  pieces: ParsedBOMPiece[];
  totalPiecesCount: number;
  totalLengthMm: number;
  totalWeightKg: number;
  totalAreaM2: number;
}

/**
 * Normaliza números que vienen de Excel/Tekla con espacios, comas decimales, etc.
 * "2 936" -> 2936, "195,56" -> 195.56, "1.234,56" -> 1234.56
 */
export function cleanNumber(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;

  let str = String(val).trim();
  str = str.replace(/\s+/g, "");

  if (str.includes(",") && !str.includes(".")) {
    str = str.replace(",", ".");
  } else if (str.includes(".") && str.includes(",")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  }

  str = str.replace(/[^\d.-]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/** Extrae el nombre limpio del perfil: "Perfil : C250X50X4" -> "C250X50X4" */
export function cleanProfileName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^perfil\s*[:=\-]?\s*/i, "").trim();
  name = name.replace(/^profile\s*[:=\-]?\s*/i, "").trim();
  return name || raw.trim();
}

/**
 * Parsea texto tabulado/CSV (proveniente de una hoja de Excel tipo listado
 * de perfiles Tekla/AutoCAD Structural Detailing) en grupos por perfil.
 */
export function parseMultiProfileBOM(rawText: string): ParsedBOMGroup[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const groups: ParsedBOMGroup[] = [];
  let currentPiecesBuffer: ParsedBOMPiece[] = [];
  let currentPendingProfileName = "";

  const pushGroup = (rawProfileName: string, pieces: ParsedBOMPiece[]) => {
    const cleanCode = cleanProfileName(rawProfileName);
    const totalQty = pieces.reduce((s, p) => s + p.quantity, 0);
    const totalLen = pieces.reduce((s, p) => s + p.lengthMm * p.quantity, 0);
    const totalW = pieces.reduce((s, p) => s + p.weightKg, 0);
    const totalA = pieces.reduce((s, p) => s + p.areaM2, 0);

    groups.push({
      profileName: rawProfileName,
      cleanProfileCode: cleanCode,
      pieces: [...pieces],
      totalPiecesCount: totalQty,
      totalLengthMm: totalLen,
      totalWeightKg: totalW,
      totalAreaM2: totalA
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/cantidad/i.test(line) && (/longitud/i.test(line) || /nombre/i.test(line) || /peso/i.test(line))) {
      continue;
    }

    const parts = line.includes("\t")
      ? line.split("\t").map((s) => s.trim())
      : line.includes(";")
      ? line.split(";").map((s) => s.trim())
      : line.split(",").map((s) => s.trim());

    const hasPerfilKeyword = parts.some((p) => /perfil\s*[:=\-]/i.test(p));

    if (hasPerfilKeyword) {
      const profilePart = parts.find((p) => /perfil\s*[:=\-]/i.test(p)) || parts[0];

      if (currentPiecesBuffer.length > 0) {
        pushGroup(profilePart, currentPiecesBuffer);
        currentPiecesBuffer = [];
        currentPendingProfileName = "";
      } else {
        currentPendingProfileName = profilePart;
      }
      continue;
    }

    if (parts.length >= 3) {
      let qty = 1;
      let label = "Pieza";
      let grade = "A36";
      let length = 0;
      let weight = 0;
      let area = 0;

      const val0 = cleanNumber(parts[0]);
      const val1 = cleanNumber(parts[1]);
      const val3 = parts[3] ? cleanNumber(parts[3]) : 0;

      if (!isNaN(val0) && val0 > 0 && val0 <= 500 && parts[1] && isNaN(Number(parts[1]))) {
        qty = Math.round(val0);
        label = parts[1] || "Pieza";
        grade = parts[2] || "A36";
        length = val3 || cleanNumber(parts[2]);
        weight = parts[4] ? cleanNumber(parts[4]) : 0;
        area = parts[5] ? cleanNumber(parts[5]) : 0;
      } else if (val1 > 50) {
        label = parts[0];
        length = val1;
        qty = Math.max(1, Math.round(cleanNumber(parts[2])));
        grade = parts[3] || "A36";
      } else {
        const numbers = parts.map((p) => cleanNumber(p)).filter((n) => n > 0);
        if (numbers.length >= 2) {
          const maxNum = Math.max(...numbers);
          const minNum = Math.min(...numbers);
          length = maxNum;
          qty = Math.max(1, Math.round(minNum));
          label = parts.find((p) => isNaN(Number(p.replace(/[^\w]/g, "")))) || "Pieza";
        }
      }

      if (length > 0) {
        currentPiecesBuffer.push({
          itemNumber: label,
          grade: grade || "A36",
          lengthMm: length,
          quantity: qty,
          weightKg: weight,
          areaM2: area
        });
      }
    }
  }

  if (currentPiecesBuffer.length > 0) {
    pushGroup(currentPendingProfileName || "Perfil Estructural General", currentPiecesBuffer);
  }

  // Filtro de ruido: si al final del documento queda un grupo "genérico"
  // (sin encabezado "Perfil :" real) y sin ningún peso, casi siempre es
  // basura de parseo (pie de página, totales, columnas sueltas) y no una
  // pieza real — se descarta.
  return groups.filter(
    (g) => !(g.profileName === "Perfil Estructural General" && g.totalWeightKg === 0)
  );
}

export interface ExcelBOMImportResult {
  groups: ParsedBOMGroup[];
  sheetUsed: string;
  sheetsAvailable: string[];
}

/**
 * Lee un archivo .xlsx/.xls de listado de perfiles. El archivo puede tener
 * varias hojas (resumen, hoja de detalle, una hoja por perfil, etc.) — se
 * prueba cada hoja con el parser y se usa la que entregue más resultados.
 */
export async function readBOMFromExcelFile(file: File): Promise<ExcelBOMImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  let bestGroups: ParsedBOMGroup[] = [];
  let bestSheet = "";
  let bestScore = -1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csvText = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
    const groups = parseMultiProfileBOM(csvText);
    const totalWeight = groups.reduce((s, g) => s + g.totalWeightKg, 0);

    // A "real" multi-profile BOM sheet has several distinct profile groups
    // with actual weight data. A single noisy group with zero weight (e.g. a
    // "Resumen"/summary sheet) is very likely a false positive, so it's
    // ranked far below any sheet with multiple genuine groups.
    const score = groups.length * 1000 + (totalWeight > 0 ? 500 : 0);

    if (score > bestScore) {
      bestGroups = groups;
      bestSheet = sheetName;
      bestScore = score;
    }
  }

  return {
    groups: bestGroups,
    sheetUsed: bestSheet,
    sheetsAvailable: workbook.SheetNames
  };
}
