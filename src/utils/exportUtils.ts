import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { SteelProject, HistoryCalculationItem } from "../types";

/**
 * Exporta un proyecto completo o resumen de cubicación a PDF profesional
 */
export function exportProjectToPDF(project: SteelProject) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const totalWeight = project.items.reduce((sum, item) => sum + (item.totalWeightKg || 0), 0);
  const totalPrice = project.items.reduce((sum, item) => sum + (item.totalPriceCLP || 0), 0);
  const totalPieces = project.items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 210, 36, "F");

  // Title & Brand
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ACEROS CHILE - INFORME TÉCNICO DE CUBICACIÓN", 14, 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("Cálculos Estructurales, Despiece de Perfiles y Cubicaciones en Norma Chilena", 14, 23);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-CL")} | Sincronizado en Nube`, 14, 29);

  // Project Info Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 42, 182, 30, 3, 3, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Proyecto: ${project.name}`, 18, 50);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Cliente: ${project.clientName || "Particular / Maestranza"}`, 18, 57);
  doc.text(`Ubicación: ${project.location || "Chile"}`, 18, 63);
  doc.text(`Calidad Base: ${project.steelGradeDefault || "A270ES / A36 (NCh 203)"}`, 110, 57);
  doc.text(`Estado: ${project.status.toUpperCase()}`, 110, 63);

  // Metrics Bar
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 76, 182, 16, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Total Piezas: ${totalPieces}`, 20, 86);
  doc.text(`Peso Total: ${totalWeight.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`, 75, 86);
  doc.text(`Total Estimado: $${totalPrice.toLocaleString("es-CL")} CLP`, 135, 86);

  // Items Table
  const tableRows = project.items.map((item, index) => [
    (index + 1).toString(),
    item.description || item.profileName || "Ítem de Acero",
    item.dimensions || "-",
    item.quantity.toString(),
    `${(item.unitWeightKg || 0).toFixed(2)} kg`,
    `${(item.totalWeightKg || 0).toFixed(2)} kg`,
    `$${(item.unitPriceCLP || 0).toLocaleString("es-CL")}`,
    `$${(item.totalPriceCLP || 0).toLocaleString("es-CL")}`
  ]);

  autoTable(doc, {
    startY: 96,
    head: [["#", "Descripción / Perfil", "Dimensiones (mm)", "Cant.", "P. Unit.", "P. Total", "Precio Unit.", "Total CLP"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center"
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 42 },
      2: { cellWidth: 36 },
      3: { halign: "center", cellWidth: 14 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 20, fontStyle: "bold" },
      6: { halign: "right", cellWidth: 20 },
      7: { halign: "right", cellWidth: 20, fontStyle: "bold" }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Footer & Notes
  const finalY = (doc as any).lastAutoTable?.finalY || 160;
  
  if (project.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Notas y Observaciones de Fabricación / Terreno:", 14, finalY + 10);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const splitNotes = doc.splitTextToSize(project.notes, 182);
    doc.text(splitNotes, 14, finalY + 16);
  }

  // Legal & Engineering Disclaimer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Generado automáticamente con Aceros Chile. Densidad nominal de cálculo: 8.0 kg/dm³ para planchas / 7.85 kg/dm³ para perfiles laminados. Conforme a criterios NCh 203 / NCh 204.",
    14,
    285
  );

  const cleanName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Cubicacion_Aceros_${cleanName}.pdf`);
}

/**
 * Exporta el proyecto o lista de cálculo a Excel (.xlsx)
 */
export function exportProjectToExcel(project: SteelProject) {
  const data = project.items.map((item, index) => ({
    "N°": index + 1,
    "Tipo": item.type.toUpperCase(),
    "Descripción": item.description || item.profileName,
    "Dimensiones": item.dimensions,
    "Cantidad": item.quantity,
    "Largo (m)": item.lengthM || 0,
    "Peso Unitario (kg)": Number((item.unitWeightKg || 0).toFixed(2)),
    "Peso Total (kg)": Number((item.totalWeightKg || 0).toFixed(2)),
    "Precio Unitario (CLP)": item.unitPriceCLP || 0,
    "Precio Total (CLP)": item.totalPriceCLP || 0,
    "Notas": item.notes || ""
  }));

  const totalWeight = project.items.reduce((sum, item) => sum + (item.totalWeightKg || 0), 0);
  const totalPrice = project.items.reduce((sum, item) => sum + (item.totalPriceCLP || 0), 0);

  // Add Summary Row
  data.push({
    "N°": 0,
    "Tipo": "TOTALES",
    "Descripción": `Proyecto: ${project.name} (${project.items.length} partidas)`,
    "Dimensiones": `Cliente: ${project.clientName || "-"}`,
    "Cantidad": project.items.reduce((s, i) => s + i.quantity, 0),
    "Largo (m)": 0,
    "Peso Unitario (kg)": 0,
    "Peso Total (kg)": Number(totalWeight.toFixed(2)),
    "Precio Unitario (CLP)": 0,
    "Precio Total (CLP)": totalPrice,
    "Notas": "Cálculo exportado desde Aceros Chile"
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cubicación Aceros");

  // Format column widths
  worksheet["!cols"] = [
    { wch: 6 },  // N
    { wch: 12 }, // Tipo
    { wch: 32 }, // Desc
    { wch: 25 }, // Dim
    { wch: 10 }, // Cant
    { wch: 10 }, // Largo
    { wch: 18 }, // Peso Unit
    { wch: 18 }, // Peso Total
    { wch: 20 }, // Precio Unit
    { wch: 20 }, // Precio Total
    { wch: 30 }  // Notas
  ];

  const cleanName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  XLSX.writeFile(workbook, `Cubicacion_Aceros_${cleanName}.xlsx`);
}

/**
 * Exporta el historial general a Excel
 */
export function exportHistoryToExcel(history: HistoryCalculationItem[]) {
  const data = history.map((item, idx) => ({
    "N°": idx + 1,
    "Fecha": new Date(item.timestamp).toLocaleString("es-CL"),
    "Categoría": item.category.toUpperCase(),
    "Título": item.title,
    "Resumen de Cálculo": item.summary,
    "Peso (kg)": item.weightKg || 0,
    "Precio Est. (CLP)": item.priceCLP || 0,
    "Etiquetas": item.tags.join(", ")
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Historial Cálculos");

  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 20 },
    { wch: 14 },
    { wch: 30 },
    { wch: 45 },
    { wch: 14 },
    { wch: 18 },
    { wch: 25 }
  ];

  XLSX.writeFile(workbook, `Historial_Calculos_Aceros_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
