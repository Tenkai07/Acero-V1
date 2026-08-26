import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { MaterialStockItem, BOMProject } from "../inventario/types";
import { DeductionRow } from "./softlandReconciliation";
import { SoftlandCatalogProduct } from "./softlandCatalogImporter";
import { ProjectProfitability } from "./profitabilityReport";
import { MonthlyReportRow, MonthlyBucket } from "./monthlyReport";

function fmtCLP(n: number): string {
  return `$${Math.round(n || 0).toLocaleString("es-CL")}`;
}

function materialValorized(m: MaterialStockItem): number {
  const barLenM = (m.standardBarLengthMm || 0) / 1000;
  const barsValue = m.standardBarsCount * barLenM * (m.costPerMeter || 0);
  const offcutsValue = m.offcuts.reduce((s, o) => s + (o.lengthMm / 1000) * (m.costPerMeter || 0), 0);
  return barsValue + offcutsValue;
}

// ---------------------------------------------------------------------------
// Reporte de Inventario de Bodega — PDF
// ---------------------------------------------------------------------------
export function exportInventoryToPDF(inventory: MaterialStockItem[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const totalValorizado = inventory.reduce((s, m) => s + materialValorized(m), 0);
  const totalBarras = inventory.reduce((s, m) => s + m.standardBarsCount, 0);
  const totalRetazos = inventory.reduce((s, m) => s + m.offcuts.length, 0);
  const bajoMinimo = inventory.filter((m) => m.standardBarsCount < m.minStockBars);

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 297, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("REPORTE DE INVENTARIO DE BODEGA", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`Generado: ${new Date().toLocaleString("es-CL")} | ${inventory.length} materiales en bodega`, 14, 22);

  doc.setFillColor(241, 245, 249);
  doc.rect(14, 36, 269, 16, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Materiales: ${inventory.length}`, 20, 46);
  doc.text(`Barras en stock: ${totalBarras}`, 80, 46);
  doc.text(`Retazos: ${totalRetazos}`, 140, 46);
  doc.text(`Valor total bodega: ${fmtCLP(totalValorizado)}`, 190, 46);
  if (bajoMinimo.length > 0) {
    doc.setTextColor(185, 28, 28);
    doc.text(`⚠ ${bajoMinimo.length} bajo stock mínimo`, 250, 46);
  }

  const rows = inventory.map((m) => [
    m.code,
    m.name,
    m.dimensions,
    m.grade,
    m.standardBarsCount < m.minStockBars ? `${m.standardBarsCount} ⚠` : `${m.standardBarsCount}`,
    m.offcuts.length.toString(),
    `${(m.offcuts.reduce((s, o) => s + o.lengthMm, 0) / 1000).toFixed(1)} m`,
    fmtCLP(m.costPerMeter),
    fmtCLP(materialValorized(m)),
    m.location || "-"
  ]);

  autoTable(doc, {
    startY: 58,
    head: [["Código", "Nombre", "Dimensiones", "Calidad", "Barras", "Retazos", "Largo Retazos", "$/m", "Valorizado", "Ubicación"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8.5, halign: "center" },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: {
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right", fontStyle: "bold" }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Valorización estimada según costo por metro cargado en bodega. Generado automáticamente desde el módulo de Cubicación y Bodega.",
    14,
    (doc as any).internal.pageSize.getHeight() - 8
  );

  doc.save(`Reporte_Inventario_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ---------------------------------------------------------------------------
// Reporte de Inventario de Bodega — Excel (uso interno, detallado)
// ---------------------------------------------------------------------------
export function exportInventoryToExcel(inventory: MaterialStockItem[]) {
  const materialesData = inventory.map((m) => ({
    "Código": m.code,
    "Nombre": m.name,
    "Categoría": m.category,
    "Dimensiones": m.dimensions,
    "Calidad": m.grade,
    "Peso Teórico (kg/m)": m.theoreticalWeightPerMeter,
    "Costo por Metro (CLP)": m.costPerMeter,
    "Largo Barra Estándar (mm)": m.standardBarLengthMm,
    "Barras en Stock": m.standardBarsCount,
    "Stock Mínimo": m.minStockBars,
    "Bajo Mínimo": m.standardBarsCount < m.minStockBars ? "SÍ" : "NO",
    "Cantidad de Retazos": m.offcuts.length,
    "Largo Total Retazos (m)": Number((m.offcuts.reduce((s, o) => s + o.lengthMm, 0) / 1000).toFixed(2)),
    "Valorizado Total (CLP)": Math.round(materialValorized(m)),
    "Ubicación": m.location,
    "Última Actualización": m.lastUpdated
  }));

  const offcutsData = inventory.flatMap((m) =>
    m.offcuts.map((o) => ({
      "Material": m.code,
      "Nombre Material": m.name,
      "Tag Retazo": o.tag || "-",
      "Largo (mm)": o.lengthMm,
      "Ubicación": o.location || m.location,
      "Notas": o.notes || "",
      "Creado": o.createdAt
    }))
  );

  const workbook = XLSX.utils.book_new();
  const wsMateriales = XLSX.utils.json_to_sheet(materialesData);
  wsMateriales["!cols"] = [
    { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(workbook, wsMateriales, "Inventario");

  const wsOffcuts = XLSX.utils.json_to_sheet(offcutsData);
  wsOffcuts["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 30 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, wsOffcuts, "Retazos");

  XLSX.writeFile(workbook, `Inventario_Bodega_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------------------------------------------------------------------------
// Exportación para Softland ERP (on-premise)
// ---------------------------------------------------------------------------
// Softland on-premise no tiene una API pública nativa: la vía habitual para
// llevar datos hacia allá es exportar a Excel/CSV y usar el importador propio
// de Softland (normalmente en Inventario > Utilitarios > Importar), donde tú
// mapeas manualmente estas columnas contra los campos de tu maestro de
// artículos/bodegas. Por eso este archivo usa encabezados genéricos y
// explícitos en vez de asumir el layout exacto de tu instalación — verifica
// una vez con tu administrador de Softland cómo se llaman los campos exactos
// en tu maestro de artículos y, si difieren, renombra el encabezado de esta
// planilla para que el importador los reconozca (no hace falta tocar el
// código, solo el nombre de columna).
export function exportInventoryForSoftland(inventory: MaterialStockItem[]) {
  const rows = inventory.map((m) => ({
    "Código Artículo": m.code,
    "Descripción": `${m.name} ${m.dimensions} ${m.grade}`.trim(),
    "Bodega": m.location || "BODEGA PRINCIPAL",
    "Unidad de Medida": "BARRA",
    "Cantidad Stock": m.standardBarsCount,
    "Costo Unitario": Math.round((m.standardBarLengthMm / 1000) * (m.costPerMeter || 0)),
    "Costo Total": Math.round(m.standardBarsCount * (m.standardBarLengthMm / 1000) * (m.costPerMeter || 0)),
    "Stock Mínimo": m.minStockBars,
    "Observación": m.offcuts.length > 0 ? `+${m.offcuts.length} retazo(s), ${(m.offcuts.reduce((s, o) => s + o.lengthMm, 0) / 1000).toFixed(1)}m` : ""
  }));

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 16 }, { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(workbook, ws, "Importar Softland");

  const notaSheet = XLSX.utils.aoa_to_sheet([
    ["Cómo usar esta planilla con Softland ERP (on-premise)"],
    [""],
    ["1. Softland no tiene API pública nativa; la vía estándar es importar Excel/CSV desde su propio módulo de utilitarios."],
    ["2. Abre en Softland: Inventario > Utilitarios > Importar (el nombre exacto puede variar según tu versión)."],
    ["3. En el asistente de importación, mapea cada columna de la hoja 'Importar Softland' contra el campo correspondiente de tu maestro de artículos."],
    ["4. Si tu maestro usa nombres de columna distintos, renombra el encabezado en la hoja 'Importar Softland' antes de subirla (no requiere tocar la app)."],
    ["5. Se recomienda probar primero con 2-3 filas antes de importar el listado completo, para confirmar el mapeo."],
    [""],
    ["Generado automáticamente desde el módulo de Cubicación y Bodega de Acero-V1."]
  ]);
  notaSheet["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, notaSheet, "Instrucciones");

  XLSX.writeFile(workbook, `Softland_Import_Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------------------------------------------------------------------------
// Reporte de Proyecto de Cubicación (BOM/nesting) — PDF
// ---------------------------------------------------------------------------
export function exportBomProjectToPDF(project: BOMProject) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("INFORME DE CUBICACIÓN Y PRE-ANIDADO", 14, 15);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`Proyecto: ${project.name} | OT: ${project.workOrder || "-"} | Fecha: ${project.date}`, 14, 23);
  doc.text(`Cliente: ${project.client || "-"} | Estado: ${(project.status || "guardado").toUpperCase()}`, 14, 29);

  doc.setFillColor(241, 245, 249);
  doc.rect(14, 40, 182, 20, "F");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Perfiles: ${project.totalProfilesCount}`, 18, 48);
  doc.text(`Piezas: ${project.totalPiecesCount}`, 65, 48);
  doc.text(`Peso Total: ${project.totalWeightKg.toFixed(1)} kg`, 105, 48);
  doc.text(`Barras Necesarias: ${project.totalBarsTheoretical}`, 18, 56);
  doc.text(`Barras por Comprar: ${project.totalBarsToBuy}`, 105, 56);

  const rows = project.groups.map((g, idx) => [
    (idx + 1).toString(),
    g.profileName,
    g.matchedMaterialId ? "Sí" : "No",
    (g.pieces || []).reduce((s: number, p: any) => s + (p.quantity || 0), 0).toString(),
    g.nestingResult ? g.nestingResult.stockStandardBarsUsed.toString() : "-",
    g.stockComparison ? g.stockComparison.barsToBuy.toString() : "-"
  ]);

  autoTable(doc, {
    startY: 66,
    head: [["#", "Perfil", "Match Bodega", "Piezas", "Barras Usadas", "Barras a Comprar"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, halign: "center" },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    columnStyles: { 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" } },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  if (project.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Notas:", 14, finalY + 10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(project.notes, 182), 14, finalY + 16);
  }

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Generado desde el módulo de Cubicación y Bodega.", 14, 285);

  const cleanName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Cubicacion_${cleanName}.pdf`);
}

// ---------------------------------------------------------------------------
// Reporte de Proyecto de Cubicación — Excel
// ---------------------------------------------------------------------------
export function exportBomProjectToExcel(project: BOMProject) {
  const groupsData = project.groups.map((g, idx) => ({
    "N°": idx + 1,
    "Perfil": g.profileName,
    "Código Limpio": g.cleanProfileCode,
    "Material Bodega Asociado": g.matchedMaterialId || "SIN MATCH",
    "Piezas Solicitadas": (g.pieces || []).reduce((s: number, p: any) => s + (p.quantity || 0), 0),
    "Barras Usadas (Bodega)": g.nestingResult?.stockStandardBarsUsed || 0,
    "Barras a Comprar": g.stockComparison?.barsToBuy || 0,
    "Retazos Generados": g.nestingResult?.generatedOffcuts?.length || 0
  }));

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(groupsData);
  ws["!cols"] = [{ wch: 6 }, { wch: 26 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, ws, "Cubicación");

  const cleanName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  XLSX.writeFile(workbook, `Cubicacion_${cleanName}.xlsx`);
}

// ---------------------------------------------------------------------------
// Planilla de Descuento (conciliación de consumo Softland vs. inventario)
// ---------------------------------------------------------------------------
export function exportDeductionSheetToExcel(rows: DeductionRow[]) {
  const sinMatch = rows.filter((r) => r.alertaSinMatch);
  const conMatch = rows.filter((r) => !r.alertaSinMatch);

  const data = conMatch.map((r) => ({
    "Código": r.code,
    "Descripción": r.description,
    "Cantidad Reportada (Softland)": r.quantityReported,
    "Unidad": r.unitReported,
    "Equivalente (m)": r.metersEquivalent,
    "Stock Actual (m)": r.currentStockMeters,
    "Barras a Descontar (aprox.)": r.wholeBarsToDeduct,
    "Stock Proyectado (m)": r.projectedStockMeters,
    "Alerta": r.alertaStockNegativo ? "STOCK QUEDARÍA NEGATIVO — revisar" : ""
  }));

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 14 },
    { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(workbook, ws, "Planilla de Descuento");

  if (sinMatch.length > 0) {
    const wsSinMatch = XLSX.utils.json_to_sheet(
      sinMatch.map((r) => ({
        "Código (Softland)": r.code,
        "Descripción": r.description,
        "Cantidad": r.quantityReported,
        "Unidad": r.unitReported,
        "Motivo": "No se encontró este código en el inventario de la app — revisar/crear el material o corregir el código"
      }))
    );
    wsSinMatch["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(workbook, wsSinMatch, "Sin Coincidencia");
  }

  XLSX.writeFile(workbook, `Planilla_Descuento_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------------------------------------------------------------------------
// Comparación catálogo Softland vs. inventario de la app
// ---------------------------------------------------------------------------
export function exportSoftlandCatalogComparison(catalog: SoftlandCatalogProduct[], inventory: MaterialStockItem[]) {
  const catalogCodes = new Set(catalog.map((p) => p.code.trim().toUpperCase()));
  const inventoryCodes = new Set(inventory.map((m) => m.code.trim().toUpperCase()));

  const enAmbos = inventory.filter((m) => catalogCodes.has(m.code.trim().toUpperCase()));
  const soloEnApp = inventory.filter((m) => !catalogCodes.has(m.code.trim().toUpperCase()));
  const soloEnSoftland = catalog.filter(
    (p) => !inventoryCodes.has(p.code.trim().toUpperCase()) && /perfil|plancha/i.test(p.groupName)
  );

  const workbook = XLSX.utils.book_new();

  const wsAmbos = XLSX.utils.json_to_sheet(
    enAmbos.map((m) => ({ "Código": m.code, "Nombre en App": m.name, "Dimensiones": m.dimensions }))
  );
  XLSX.utils.book_append_sheet(workbook, wsAmbos, "Coinciden");

  const wsSoloApp = XLSX.utils.json_to_sheet(
    soloEnApp.map((m) => ({
      "Código": m.code,
      "Nombre en App": m.name,
      "Motivo": "No se encontró este código en el catálogo de Softland — revisar si está bien escrito o es un material nuevo por dar de alta"
    }))
  );
  XLSX.utils.book_append_sheet(workbook, wsSoloApp, "Solo en la App");

  const wsSoloSoftland = XLSX.utils.json_to_sheet(
    soloEnSoftland.slice(0, 2000).map((p) => ({
      "Código (Softland)": p.code,
      "Descripción": p.description,
      "Grupo": p.groupName,
      "Subgrupo": p.subgroupName
    }))
  );
  XLSX.utils.book_append_sheet(workbook, wsSoloSoftland, "Solo en Softland (Perfiles-Planchas)");

  XLSX.writeFile(workbook, `Comparacion_Catalogo_Softland_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------------------------------------------------------------------------
// Rentabilidad por Proyecto (presupuesto vs. costo real de materiales)
// ---------------------------------------------------------------------------
export function exportProfitabilityToExcel(rows: ProjectProfitability[]) {
  const data = rows.map((r) => ({
    "Proyecto de Cubicación": r.bomProjectName,
    "Presupuesto Vinculado": r.linkedSteelProjectName || "Sin vincular",
    "Presupuestado (CLP)": r.presupuestadoCLP ?? "",
    "Costo Real Perfiles (CLP)": r.costoPerfilesCLP,
    "Costo Real Planchas/Pernos (CLP)": r.costoPlanchasPernosCLP,
    "Costo Real Total (CLP)": r.costoRealTotalCLP,
    "Diferencia (CLP)": r.diferenciaCLP ?? "",
    "Margen (%)": r.margenPct ?? "",
    "Materiales sin costo válido": r.itemsSinCosto.join(", ")
  }));

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 24 },
    { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 40 }
  ];
  XLSX.utils.book_append_sheet(workbook, ws, "Rentabilidad");

  XLSX.writeFile(workbook, `Rentabilidad_Proyectos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------------------------------------------------------------------------
// Informe Mensual — Reales y Teóricas en hojas SEPARADAS (nunca mezcladas)
// ---------------------------------------------------------------------------
function bucketToRow(monthLabel: string, b: MonthlyBucket) {
  return {
    "Mes": monthLabel,
    "N° Cubicaciones": b.count,
    "Peso Total (kg)": Number(b.totalWeightKg.toFixed(1)),
    "Costo Materiales (CLP)": Math.round(b.totalCostoMaterialesCLP),
    "Barras Compradas": b.totalBarsToBuy,
    "Planchas Consumidas (equiv.)": Number(b.totalPlanchasConsumidas.toFixed(2)),
    "Pernos Consumidos (unid.)": b.totalPernosConsumidos
  };
}

export function exportMonthlyReportToExcel(rows: MonthlyReportRow[]) {
  const workbook = XLSX.utils.book_new();

  const wsReales = XLSX.utils.json_to_sheet(rows.map((r) => bucketToRow(r.monthLabel, r.reales)));
  wsReales["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, wsReales, "Reales");

  const wsTeoricas = XLSX.utils.json_to_sheet(rows.map((r) => bucketToRow(r.monthLabel, r.teoricas)));
  wsTeoricas["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, wsTeoricas, "Teóricas");

  const notaSheet = XLSX.utils.aoa_to_sheet([
    ["Las hojas 'Reales' y 'Teóricas' son totales completamente independientes."],
    ["Una cubicación teórica es una cotización/estimación que puede no concretarse nunca;"],
    ["por eso nunca se suma junto a las cubicaciones reales en el mismo total."]
  ]);
  notaSheet["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, notaSheet, "Leer primero");

  XLSX.writeFile(workbook, `Informe_Mensual_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
