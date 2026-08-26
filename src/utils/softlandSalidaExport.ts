import * as XLSX from "xlsx";

/**
 * ADVERTENCIA: SIN VERIFICAR CONTRA UN ARCHIVO REAL DE SOFTLAND.
 *
 * A diferencia de la Guía de Entrada (que sí se construyó a partir de una
 * plantilla real que compartió el usuario), esta Guía de Salida se armó por
 * SIMETRÍA con esa plantilla (mismo layout de columnas, cambiando "Entrada"
 * por "Salida" y "Proveedor" por "Centro de Costo / Orden de Trabajo
 * destino"). Es una base razonable para probar, pero puede no calzar
 * exactamente con el importador real de egresos de Softland. Súbela primero
 * a un ambiente de prueba, o compárala con la plantilla real de "Guía de
 * Salida" de Softland si tu administrador puede exportarla.
 */

export interface SoftlandSalidaHeader {
  codigoBodega: string;
  folio: number;
  fecha: string; // dd/mm/aaaa
  concepto: string; // "Concepto de Salida a Bodega" — código interno de Softland, confirmar con el administrador
  descripcion?: string;
  centroCosto?: string;
  ordenTrabajo?: string;
  ordenProduccion?: string;
}

export interface SoftlandSalidaLinea {
  codigoProducto: string;
  descripcionProducto?: string;
  cantidad: number; // perfiles/pernos: unidades enteras. planchas: fracción de plancha (ej. 0.3)
  partidaOTalla?: string; // colada, si aplica (planchas)
}

const SALIDA_HEADERS = [
  "Código Bodega",
  "Número de Folio Guía de Salida",
  "Fecha de generación Guía de Salida",
  "Concepto de Salida a Bodega",
  "Descripción",
  "Código Centro de Costo Destino",
  "Código de Bodega Destino (Traspaso entre Bodegas)",
  "Número Orden de Trabajo (Interna)",
  "Número Orden de Producción (Interna)",
  "Número Orden de Compra (Interna)",
  "Total Final",
  "Código de Producto",
  "Descripción del Producto",
  "Cantidad Egresada",
  "Partida o Talla",
  "Pieza o Color",
  "Cuenta de Consumo"
];

export function generateSoftlandSalidaMasiva(header: SoftlandSalidaHeader, lineas: SoftlandSalidaLinea[]) {
  const rows = lineas.map((linea) => [
    header.codigoBodega,
    header.folio,
    header.fecha,
    header.concepto,
    header.descripcion || "",
    header.centroCosto || "",
    "",
    header.ordenTrabajo || "",
    header.ordenProduccion || "",
    "",
    "",
    linea.codigoProducto,
    linea.descripcionProducto || "",
    linea.cantidad,
    linea.partidaOTalla || "",
    "",
    ""
  ]);

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([SALIDA_HEADERS, ...rows]);
  ws["!cols"] = SALIDA_HEADERS.map((h) => ({ wch: Math.min(35, Math.max(12, Math.round(h.length * 0.7))) }));
  XLSX.utils.book_append_sheet(workbook, ws, "Hoja2");

  const notaSheet = XLSX.utils.aoa_to_sheet([
    ["ARCHIVO EXPERIMENTAL - CONFIRMAR ANTES DE USAR EN PRODUCCION"],
    [""],
    ["Este layout se construyo por simetria con la Guia de Entrada real que se compartio, no a partir de una"],
    ["plantilla real de Guia de Salida de Softland. Antes de usarlo:"],
    ["1. Pide a tu administrador de Softland la plantilla real de carga masiva de Guia de Salida/Egreso."],
    ["2. Comparala columna por columna contra la hoja 'Hoja2' de este archivo."],
    ["3. Corrige nombres de columna o el orden si difieren, antes de subir datos reales."],
    [""],
    ["Recuerda: los retazos/despuntes NO deben incluirse aqui - Softland no los conoce como unidad de stock."]
  ]);
  notaSheet["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, notaSheet, "LEER PRIMERO");

  XLSX.writeFile(workbook, `Softland_Guia_Salida_EXPERIMENTAL_Folio${header.folio || "SF"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
