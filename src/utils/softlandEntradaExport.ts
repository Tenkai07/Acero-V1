import * as XLSX from "xlsx";

export interface SoftlandEntradaHeader {
  codigoBodega: string; // ej. "01"
  folio: number;
  fecha: string; // dd/mm/aaaa
  concepto: string; // ej. "01"
  descripcion?: string; // ej. "OC - 5163 - PROVEEDOR"
  codigoProveedor: string;
  centroCosto?: string;
  numeroGuiaDespachoExterna?: number;
  fechaGuiaDespachoExterna?: string;
  ordenCompraInterna?: number;
}

export interface SoftlandEntradaLinea {
  codigoProducto: string;
  descripcionProducto?: string;
  cantidad: number;
  precioUnitario?: number;
  fechaCompra?: string; // dd/mm/aaaa
  partidaOTalla?: string; // n° de colada/lote — clave para trazabilidad de acero
}

// Encabezados EXACTOS de la plantilla de carga masiva "Guía de Entrada a
// Bodega" de Softland (31 columnas, tomados literalmente de la plantilla
// que ya usa la maestranza), para que el archivo generado se pueda subir
// directo al importador sin tener que renombrar nada.
const ENTRADA_HEADERS = [
  "Código Bodega",
  "Número de Folio Guía de Entrada",
  "Fecha de generación Guía de Entrada",
  "Concepto de Entrada a Bodega",
  "Descripción",
  "Código de Proveedor",
  "Código Centro de Costo",
  "Código de Bodega Origen (Traspaso entre Bodegas)",
  "Número Guía de Despacho Asociada (Externa)",
  "Fecha Guía de Despacho Asociada (Externa)",
  "Número de Factura/N. de Crédito Asociada (Externa)",
  "SubTipo de Factura Asociada (Externa)",
  "Fecha de Factura/N. de Crédito Asociada (Externa)",
  "Número Orden de Trabajo (Interna)",
  "Número Orden de Producción (Interna)",
  "Número Orden de Compra (Interna)",
  "Número Factura Asociada (Interna)",
  "Número Nota de Crédito Asociada (Interna)",
  "Código Centro de Costo para Contabilizar",
  "Total Final",
  "Código de Producto",
  "Descripción del Producto",
  "Cantidad Ingresada",
  "Precio Unitario",
  "Fecha de Compra",
  "Partida o Talla",
  "Pieza o Color",
  "Fecha de Vencimiento",
  "Serie",
  "Cuenta de Consumo",
  "Tipo de Factura"
];

/**
 * Genera la planilla de "Guía de Entrada a Bodega" lista para cargar de
 * forma masiva en Softland (Inventario > Utilitarios > Carga Masiva), con
 * una fila por línea de producto/partida. Sigue exactamente el layout de
 * 31 columnas que ya usa la maestranza — si Softland exige un campo
 * adicional que aquí no se llena, se deja en blanco tal como en la
 * plantilla original.
 */
export function generateSoftlandEntradaMasiva(header: SoftlandEntradaHeader, lineas: SoftlandEntradaLinea[]) {
  const rows = lineas.map((linea) => [
    header.codigoBodega,
    header.folio,
    header.fecha,
    header.concepto,
    header.descripcion || "",
    header.codigoProveedor,
    header.centroCosto || "",
    "",
    header.numeroGuiaDespachoExterna || "",
    header.fechaGuiaDespachoExterna || "",
    "",
    "",
    "",
    "",
    "",
    header.ordenCompraInterna || "",
    "",
    "",
    "",
    "",
    linea.codigoProducto,
    linea.descripcionProducto || "",
    linea.cantidad,
    linea.precioUnitario || "",
    linea.fechaCompra || header.fecha,
    linea.partidaOTalla || "",
    "",
    "",
    "",
    "",
    ""
  ]);

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([ENTRADA_HEADERS, ...rows]);
  ws["!cols"] = ENTRADA_HEADERS.map((h) => ({ wch: Math.min(35, Math.max(12, Math.round(h.length * 0.7))) }));
  XLSX.utils.book_append_sheet(workbook, ws, "Hoja2");

  XLSX.writeFile(workbook, `Softland_Guia_Entrada_Folio${header.folio || "SF"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
