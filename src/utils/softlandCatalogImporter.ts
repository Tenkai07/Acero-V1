import * as XLSX from "xlsx";

export interface SoftlandCatalogProduct {
  code: string;
  description: string;
  groupCode: string;
  groupName: string;
  subgroupCode: string;
  subgroupName: string;
}

function normalizeHeader(h: string): string {
  return (h || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Detecta y parsea el "Informe de Productos Paramétrico" de Softland: el
 * catálogo maestro completo (código, descripción, grupo, subgrupo). Este
 * reporte trae varias filas de título ("Informe de Productos Paramétrico",
 * "Ordenado por Código", "Todos los Productos", etc.) antes de la fila real
 * de encabezados, y una fila en blanco después. Se detecta por el nombre
 * de columna "Código producto" + "Descripción producto".
 */
export async function parseSoftlandProductCatalog(file: File): Promise<{
  isValidCatalog: boolean;
  products: SoftlandCatalogProduct[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(allRows.length, 20); i++) {
    const cells = (allRows[i] || []).map((c) => normalizeHeader(String(c ?? "")));
    if (cells.some((c) => c.includes("codigo producto")) && cells.some((c) => c.includes("descripcion producto"))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { isValidCatalog: false, products: [] };
  }

  const headers = (allRows[headerRowIdx] || []).map((h) => normalizeHeader(String(h ?? "")));
  const codeCol = headers.findIndex((h) => h.includes("codigo producto"));
  const descCol = headers.findIndex((h) => h.includes("descripcion producto"));
  const groupCodeCol = headers.findIndex((h) => h === "codigo grupo");
  const groupNameCol = headers.findIndex((h) => h.includes("descripcion grupo"));
  const subgroupCodeCol = headers.findIndex((h) => h.includes("codigo sub-grupo") || h.includes("codigo subgrupo"));
  const subgroupNameCol = headers.findIndex((h) => h.includes("descripcion sub-grupo") || h.includes("descripcion subgrupo"));

  const products: SoftlandCatalogProduct[] = allRows
    .slice(headerRowIdx + 1)
    .filter((r) => r[codeCol] !== undefined && String(r[codeCol]).trim() !== "")
    .map((r) => ({
      code: String(r[codeCol] ?? "").trim(),
      description: String(r[descCol] ?? "").trim(),
      groupCode: groupCodeCol >= 0 ? String(r[groupCodeCol] ?? "").trim() : "",
      groupName: groupNameCol >= 0 ? String(r[groupNameCol] ?? "").trim() : "",
      subgroupCode: subgroupCodeCol >= 0 ? String(r[subgroupCodeCol] ?? "").trim() : "",
      subgroupName: subgroupNameCol >= 0 ? String(r[subgroupNameCol] ?? "").trim() : ""
    }));

  return { isValidCatalog: true, products };
}
