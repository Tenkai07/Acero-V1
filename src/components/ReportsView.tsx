import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  RefreshCw,
  AlertTriangle,
  Package,
  Boxes,
  Upload,
  CheckCircle2,
  XCircle,
  BarChart3
} from "lucide-react";
import { authFetch } from "../utils/authToken";
import { SteelProject } from "../types";
import { MaterialStockItem, BOMProject } from "../inventario/types";
import { persistInventory } from "../inventario/utils/cloudSync";
import { exportProjectToPDF, exportProjectToExcel } from "../utils/exportUtils";
import {
  exportInventoryToPDF,
  exportInventoryToExcel,
  exportInventoryForSoftland,
  exportBomProjectToPDF,
  exportBomProjectToExcel,
  exportDeductionSheetToExcel,
  exportSoftlandCatalogComparison,
  exportProfitabilityToExcel,
  exportMonthlyReportToExcel
} from "../utils/reportsExport";
import { computeProjectProfitability, ProjectProfitability } from "../utils/profitabilityReport";
import { buildMonthlyReport, MonthlyReportRow } from "../utils/monthlyReport";
import { persistBomProject as persistBomProjectDirect } from "../inventario/utils/cloudSync";
import { parseSoftlandExcelFile, buildRowsFromMapping, ColumnMapping, SoftlandImportResult } from "../utils/softlandImporter";
import { buildDeductionSheet, applyDeductionToInventory, DeductionRow } from "../utils/softlandReconciliation";
import { parseSoftlandProductCatalog, SoftlandCatalogProduct } from "../utils/softlandCatalogImporter";
import { fetchSoftlandCatalog, persistSoftlandCatalog } from "../utils/softlandCatalogStorage";
import { generateSoftlandEntradaMasiva, SoftlandEntradaHeader, SoftlandEntradaLinea } from "../utils/softlandEntradaExport";
import { generateSoftlandSalidaMasiva, SoftlandSalidaLinea } from "../utils/softlandSalidaExport";
import { SoftlandMaterialsSection } from "./SoftlandMaterialsSection";

/**
 * Módulo de Reportes: centraliza la exportación de inventario de bodega,
 * proyectos de cubicación (BOM/nesting) y proyectos de presupuesto, en PDF y
 * Excel — incluyendo un formato pensado para importar en Softland ERP.
 */
const INPUT_CLS = "bg-slate-950 border border-slate-700 rounded-lg text-xs px-2 py-1.5 text-slate-200 w-full";

export function ReportsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<MaterialStockItem[]>([]);
  const [bomProjects, setBomProjects] = useState<BOMProject[]>([]);
  const [steelProjects, setSteelProjects] = useState<SteelProject[]>([]);

  // --- Conciliación con Softland (importar consumo) ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [softlandImport, setSoftlandImport] = useState<SoftlandImportResult | null>(null);
  const [manualMapping, setManualMapping] = useState<ColumnMapping | null>(null);
  const [deductionRows, setDeductionRows] = useState<DeductionRow[]>([]);
  const [applyingDeduction, setApplyingDeduction] = useState(false);
  const [deductionApplied, setDeductionApplied] = useState(false);
  const [softlandError, setSoftlandError] = useState<string | null>(null);

  // --- Catálogo de productos Softland ---
  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const [catalogProducts, setCatalogProducts] = useState<SoftlandCatalogProduct[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // --- Generador de Guía de Entrada a Bodega (Softland) ---
  const [entradaHeader, setEntradaHeader] = useState<SoftlandEntradaHeader>({
    codigoBodega: "01",
    folio: 0,
    fecha: new Date().toLocaleDateString("es-CL"),
    concepto: "01",
    descripcion: "",
    codigoProveedor: "",
    ordenCompraInterna: undefined
  });
  const [entradaLineas, setEntradaLineas] = useState<SoftlandEntradaLinea[]>([]);

  // --- Rentabilidad por Proyecto ---
  const [profitabilityRows, setProfitabilityRows] = useState<ProjectProfitability[]>([]);
  // --- Informe Mensual (Reales vs Teóricas) ---
  const [monthlyRows, setMonthlyRows] = useState<MonthlyReportRow[]>([]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, bomRes, projRes] = await Promise.all([
        authFetch("/api/inventory"),
        authFetch("/api/bom-projects"),
        authFetch("/api/projects")
      ]);
      const [invData, bomData, projData] = await Promise.all([invRes.json(), bomRes.json(), projRes.json()]);
      if (invData.success) setInventory(invData.inventory || []);
      if (bomData.success) setBomProjects(bomData.bomProjects || []);
      if (projData.success) setSteelProjects(projData.projects || []);
    } catch (e) {
      console.error("Error cargando datos de reportes", e);
      setError("No se pudo conectar al servidor. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    fetchSoftlandCatalog().then((cached) => {
      if (cached.length > 0) setCatalogProducts(cached);
    });
  }, []);

  const bajoMinimo = inventory.filter((m) => m.standardBarsCount < m.minStockBars);
  const totalValorizado = inventory.reduce((s, m) => {
    const barsValue = m.standardBarsCount * (m.standardBarLengthMm / 1000) * (m.costPerMeter || 0);
    const offcutsValue = m.offcuts.reduce((os, o) => os + (o.lengthMm / 1000) * (m.costPerMeter || 0), 0);
    return s + barsValue + offcutsValue;
  }, 0);

  useEffect(() => {
    if (bomProjects.length === 0) {
      setProfitabilityRows([]);
      setMonthlyRows([]);
      return;
    }
    setProfitabilityRows(bomProjects.map((p) => computeProjectProfitability(p, steelProjects, inventory)));
    setMonthlyRows(buildMonthlyReport(bomProjects, inventory));
  }, [bomProjects, steelProjects, inventory]);

  const handleLinkSteelProject = (bomProjectId: string, steelProjectId: string) => {
    const bomProject = bomProjects.find((p) => p.id === bomProjectId);
    if (!bomProject) return;
    const updated: BOMProject = { ...bomProject, linkedSteelProjectId: steelProjectId || undefined };
    setBomProjects((prev) => prev.map((p) => (p.id === bomProjectId ? updated : p)));
    persistBomProjectDirect(updated);
  };

  const handleGenerateSalidaForProject = (project: BOMProject) => {
    const lineas: SoftlandSalidaLinea[] = [];

    for (const g of project.groups) {
      const barsUsed = g.nestingResult?.stockStandardBarsUsed || 0;
      if (barsUsed <= 0 || !g.matchedMaterialId) continue;
      const material = inventory.find((m) => m.id === g.matchedMaterialId);
      if (!material) continue;
      lineas.push({ codigoProducto: material.code, descripcionProducto: material.name, cantidad: barsUsed });
    }
    for (const c of project.additionalConsumption || []) {
      lineas.push({ codigoProducto: c.materialCode, descripcionProducto: c.materialName, cantidad: c.quantity, partidaOTalla: c.colada });
    }

    if (lineas.length === 0) {
      alert("Este proyecto no tiene consumo registrado todavía (ni barras usadas en pre-anidado ni planchas/pernos registrados).");
      return;
    }

    const folio = prompt("N° de Folio de la Guía de Salida:");
    if (!folio) return;
    const concepto = prompt('Código de "Concepto de Salida" en Softland (confirma con tu administrador):', "01") || "01";
    const centroCosto = prompt("Código de Centro de Costo / Obra destino (opcional):") || "";

    generateSoftlandSalidaMasiva(
      {
        codigoBodega: "01",
        folio: Number(folio),
        fecha: new Date().toLocaleDateString("es-CL"),
        concepto,
        descripcion: project.name,
        centroCosto
      },
      lineas
    );
  };

  const handleSoftlandFile = async (file: File) => {
    setSoftlandError(null);
    setDeductionApplied(false);
    try {
      const result = await parseSoftlandExcelFile(file);
      setSoftlandImport(result);
      if (result.detectedMapping) {
        setManualMapping(result.detectedMapping);
        setDeductionRows(buildDeductionSheet(result.rows, inventory));
      } else {
        setManualMapping(null);
        setDeductionRows([]);
      }
    } catch (e) {
      console.error("Error leyendo Excel de Softland", e);
      setSoftlandError("No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.");
    }
  };

  const applyManualMapping = (mapping: ColumnMapping) => {
    if (!softlandImport) return;
    setManualMapping(mapping);
    const rows = buildRowsFromMapping(softlandImport.rawRows, mapping);
    setDeductionRows(buildDeductionSheet(rows, inventory));
  };

  const handleApplyDeduction = async () => {
    if (!confirm("Esto va a descontar del inventario de la app las cantidades reportadas por Softland. ¿Continuar?")) {
      return;
    }
    setApplyingDeduction(true);
    try {
      const updated = applyDeductionToInventory(deductionRows, inventory);
      setInventory(updated);
      persistInventory(updated);
      setDeductionApplied(true);
    } finally {
      setApplyingDeduction(false);
    }
  };

  const clearSoftlandImport = () => {
    setSoftlandImport(null);
    setManualMapping(null);
    setDeductionRows([]);
    setDeductionApplied(false);
    setSoftlandError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCatalogFile = async (file: File) => {
    setCatalogError(null);
    try {
      const result = await parseSoftlandProductCatalog(file);
      if (!result.isValidCatalog) {
        setCatalogError(
          'No reconocí este archivo como el "Informe de Productos Paramétrico" de Softland (no encontré las columnas "Código producto" / "Descripción producto"). Verifica que sea ese reporte.'
        );
        return;
      }
      setCatalogProducts(result.products);
      persistSoftlandCatalog(result.products);
    } catch (e) {
      console.error("Error leyendo catálogo Softland", e);
      setCatalogError("No se pudo leer el archivo. Verifica que sea un Excel válido.");
    }
  };

  const addLineaVacia = () => {
    setEntradaLineas((prev) => [...prev, { codigoProducto: "", descripcionProducto: "", cantidad: 1 }]);
  };

  const updateLinea = (idx: number, field: keyof SoftlandEntradaLinea, value: string | number) => {
    setEntradaLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const removeLinea = (idx: number) => {
    setEntradaLineas((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLineasDesdeCompras = (project: BOMProject) => {
    const nuevasLineas: SoftlandEntradaLinea[] = [];
    for (const g of project.groups) {
      const barsToBuy = g.stockComparison?.barsToBuy || 0;
      if (barsToBuy <= 0 || !g.matchedMaterialId) continue;
      const material = inventory.find((m) => m.id === g.matchedMaterialId);
      if (!material) continue;
      nuevasLineas.push({
        codigoProducto: material.code,
        descripcionProducto: `${material.name} ${material.dimensions} ${material.grade}`.trim(),
        cantidad: barsToBuy,
        precioUnitario: Math.round((material.standardBarLengthMm / 1000) * (material.costPerMeter || 0))
      });
    }
    if (nuevasLineas.length === 0) {
      alert("Ese proyecto no tiene barras pendientes por comprar con material identificado en bodega.");
      return;
    }
    setEntradaLineas((prev) => [...prev, ...nuevasLineas]);
  };

  const handleGenerateEntrada = () => {
    if (!entradaHeader.codigoBodega || !entradaHeader.folio || !entradaHeader.fecha || !entradaHeader.codigoProveedor) {
      alert("Completa al menos: Código Bodega, Folio, Fecha y Código de Proveedor.");
      return;
    }
    if (entradaLineas.length === 0 || entradaLineas.some((l) => !l.codigoProducto || !l.cantidad)) {
      alert("Agrega al menos una línea con código de producto y cantidad.");
      return;
    }
    generateSoftlandEntradaMasiva(entradaHeader, entradaLineas);

    if (!confirm("Excel generado. ¿También quieres sumar estas cantidades al inventario de la app (llegó la compra)?")) {
      return;
    }

    const sinMatch: string[] = [];
    const updatedInventory = inventory.map((m) => ({ ...m, plateBatches: m.plateBatches ? [...m.plateBatches] : undefined }));

    for (const linea of entradaLineas) {
      const material = updatedInventory.find((m) => m.code.trim().toUpperCase() === linea.codigoProducto.trim().toUpperCase());
      if (!material) {
        sinMatch.push(linea.codigoProducto);
        continue;
      }
      material.standardBarsCount = Number((material.standardBarsCount + linea.cantidad).toFixed(4));
      material.lastUpdated = new Date().toISOString();
      if (material.unitType === "plancha" && linea.partidaOTalla) {
        material.plateBatches = [
          ...(material.plateBatches || []),
          { id: `lote-${Date.now()}-${Math.floor(Math.random() * 10000)}`, colada: linea.partidaOTalla, cantidadPlanchas: linea.cantidad, fechaIngreso: new Date().toISOString() }
        ];
      }
    }

    setInventory(updatedInventory);
    persistInventory(updatedInventory);

    if (sinMatch.length > 0) {
      alert(
        `Inventario actualizado, pero estos códigos no existen en tu inventario y no se pudieron sumar automáticamente:\n${sinMatch.join(
          "\n"
        )}\n\nAgrégalos manualmente si corresponde.`
      );
    } else {
      alert("Inventario actualizado con las cantidades recién compradas.");
    }
    setEntradaLineas([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Cargando datos para reportes...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Reportes</h2>
          <p className="text-sm text-slate-400">Inventario de bodega, cubicación y presupuestos, listos para exportar.</p>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar datos
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* --- Inventario de Bodega --- */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Boxes className="w-5 h-5 text-sky-400" />
          <h3 className="font-semibold text-slate-100">Inventario de Bodega</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Materiales" value={inventory.length.toString()} />
          <StatCard label="Barras en stock" value={inventory.reduce((s, m) => s + m.standardBarsCount, 0).toString()} />
          <StatCard
            label="Valor total"
            value={`$${Math.round(totalValorizado).toLocaleString("es-CL")}`}
          />
          <StatCard
            label="Bajo stock mínimo"
            value={bajoMinimo.length.toString()}
            warn={bajoMinimo.length > 0}
          />
        </div>

        {inventory.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay materiales cargados aún. Ve a "Cubicación & Bodega → Inventario" para agregar tu stock.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ExportButton
              icon={FileText}
              label="Exportar PDF"
              onClick={() => exportInventoryToPDF(inventory)}
            />
            <ExportButton
              icon={FileSpreadsheet}
              label="Exportar Excel (detallado)"
              onClick={() => exportInventoryToExcel(inventory)}
            />
            <ExportButton
              icon={Download}
              label="Exportar para Softland (Excel)"
              onClick={() => exportInventoryForSoftland(inventory)}
              accent
            />
          </div>
        )}
        {inventory.length > 0 && (
          <p className="text-[11px] text-slate-500 mt-2">
            El archivo "para Softland" trae columnas genéricas listas para mapear en su importador (Softland
            on-premise no ofrece una API pública de fábrica), más una hoja de instrucciones.
          </p>
        )}
      </section>

      {/* --- Conciliación con Softland: importar consumo y generar descuento --- */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-5 h-5 text-fuchsia-400" />
          <h3 className="font-semibold text-slate-100">Importar consumo desde Softland</h3>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          Sube el Excel exportado desde Softland (despachos/consumo de bodega) para comparar contra tu
          inventario y ver qué falta por descontar.
        </p>

        {!softlandImport && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleSoftlandFile(e.target.files[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border border-fuchsia-800 bg-fuchsia-950/30 text-fuchsia-300 hover:bg-fuchsia-900/40 transition"
            >
              <Upload className="w-4 h-4" /> Seleccionar Excel de Softland
            </button>
          </div>
        )}

        {softlandError && (
          <div className="mt-3 bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {softlandError}
          </div>
        )}

        {softlandImport && !manualMapping && (
          <div className="mt-3 bg-amber-950/30 border border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              No pude adivinar con seguridad qué columna es el código y cuál es la cantidad. Elígelas manualmente:
            </p>
            <ManualMappingForm headers={softlandImport.headers} onConfirm={applyManualMapping} />
            <button onClick={clearSoftlandImport} className="text-xs text-slate-400 hover:text-slate-200 mt-3">
              Cancelar y elegir otro archivo
            </button>
          </div>
        )}

        {softlandImport && manualMapping && (
          <div className="mt-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <p className="text-xs text-slate-400">
                {deductionRows.length} filas leídas · {deductionRows.filter((r) => r.matched).length} coincidieron con
                el inventario · {deductionRows.filter((r) => r.alertaSinMatch).length} sin coincidencia
              </p>
              <button onClick={clearSoftlandImport} className="text-xs text-slate-400 hover:text-slate-200 underline">
                Subir otro archivo
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="text-left px-3 py-2">Código</th>
                    <th className="text-left px-3 py-2">Descripción</th>
                    <th className="text-right px-3 py-2">Cant. Softland</th>
                    <th className="text-right px-3 py-2">Equiv. (m)</th>
                    <th className="text-right px-3 py-2">Stock Actual (m)</th>
                    <th className="text-right px-3 py-2">Barras a Descontar</th>
                    <th className="text-right px-3 py-2">Stock Proyectado (m)</th>
                    <th className="text-center px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {deductionRows.map((r, idx) => (
                    <tr key={idx} className={r.alertaSinMatch ? "bg-red-950/20" : r.alertaStockNegativo ? "bg-amber-950/20" : ""}>
                      <td className="px-3 py-2 text-slate-300">{r.code}</td>
                      <td className="px-3 py-2 text-slate-400">{r.description}</td>
                      <td className="px-3 py-2 text-right text-slate-300">
                        {r.quantityReported} {r.unitReported}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{r.matched ? r.metersEquivalent : "-"}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{r.matched ? r.currentStockMeters : "-"}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{r.matched ? r.wholeBarsToDeduct : "-"}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.alertaStockNegativo ? "text-amber-400" : "text-slate-300"}`}>
                        {r.matched ? r.projectedStockMeters : "-"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.alertaSinMatch ? (
                          <span className="inline-flex items-center gap-1 text-red-400">
                            <XCircle className="w-3.5 h-3.5" /> Sin match
                          </span>
                        ) : r.alertaStockNegativo ? (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> Quedaría negativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <ExportButton
                icon={FileSpreadsheet}
                label="Descargar planilla de descuento"
                onClick={() => exportDeductionSheetToExcel(deductionRows)}
                accent
              />
              <button
                onClick={handleApplyDeduction}
                disabled={applyingDeduction || deductionApplied || deductionRows.every((r) => !r.matched)}
                className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-lg border border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                {deductionApplied ? "Descuento aplicado ✓" : applyingDeduction ? "Aplicando..." : "Aplicar descuento al inventario"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              El descuento es una aproximación por barras completas y retazos más grandes disponibles — no
              reemplaza el conteo físico de bodega. Verifica los casos marcados en amarillo o rojo antes de confiar
              en el resultado.
            </p>
          </div>
        )}
      </section>

      {/* --- Catálogo de Productos Softland --- */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-slate-100">Catálogo de Productos Softland</h3>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          Sube el "Informe de Productos Paramétrico" exportado desde Softland para comparar sus códigos contra tu
          inventario: qué coincide, qué código tuyo no existe en Softland (posible error de tipeo) y qué perfiles/planchas
          tiene Softland que aún no están en tu inventario.
        </p>

        {!catalogProducts && (
          <div>
            <input
              ref={catalogFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleCatalogFile(e.target.files[0])}
            />
            <button
              onClick={() => catalogFileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border border-cyan-800 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 transition"
            >
              <Upload className="w-4 h-4" /> Seleccionar catálogo Softland
            </button>
          </div>
        )}

        {catalogError && (
          <div className="mt-3 bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {catalogError}
          </div>
        )}

        {catalogProducts && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-slate-300">{catalogProducts.length} productos leídos del catálogo Softland.</p>
            <div className="flex gap-2">
              <ExportButton
                icon={FileSpreadsheet}
                label="Descargar comparación con inventario"
                onClick={() => exportSoftlandCatalogComparison(catalogProducts, inventory)}
                accent
              />
              <button
                onClick={() => {
                  setCatalogProducts(null);
                  setCatalogError(null);
                  if (catalogFileInputRef.current) catalogFileInputRef.current.value = "";
                }}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Subir otro archivo
              </button>
            </div>
          </div>
        )}
      </section>

      {/* --- Generar Guía de Entrada a Bodega (Softland) --- */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-5 h-5 text-lime-400" />
          <h3 className="font-semibold text-slate-100">Generar Guía de Entrada a Bodega (Softland)</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Arma la planilla de carga masiva para registrar en Softland el material que llegó a bodega — mismo layout
          de 31 columnas que ya usa la maestranza, lista para subir directo al importador.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <FormField label="Código Bodega *">
            <input
              className={INPUT_CLS}
              value={entradaHeader.codigoBodega}
              onChange={(e) => setEntradaHeader((h) => ({ ...h, codigoBodega: e.target.value }))}
            />
          </FormField>
          <FormField label="Folio *">
            <input
              type="number"
              className={INPUT_CLS}
              value={entradaHeader.folio || ""}
              onChange={(e) => setEntradaHeader((h) => ({ ...h, folio: Number(e.target.value) }))}
            />
          </FormField>
          <FormField label="Fecha *">
            <input
              className={INPUT_CLS}
              placeholder="dd/mm/aaaa"
              value={entradaHeader.fecha}
              onChange={(e) => setEntradaHeader((h) => ({ ...h, fecha: e.target.value }))}
            />
          </FormField>
          <FormField label="Concepto *">
            <input
              className={INPUT_CLS}
              value={entradaHeader.concepto}
              onChange={(e) => setEntradaHeader((h) => ({ ...h, concepto: e.target.value }))}
            />
          </FormField>
          <FormField label="Código Proveedor *">
            <input
              className={INPUT_CLS}
              value={entradaHeader.codigoProveedor}
              onChange={(e) => setEntradaHeader((h) => ({ ...h, codigoProveedor: e.target.value }))}
            />
          </FormField>
          <FormField label="Descripción / Referencia OC">
            <input
              className={INPUT_CLS}
              placeholder="OC - 5163 - PROVEEDOR"
              value={entradaHeader.descripcion}
              onChange={(e) => setEntradaHeader((h) => ({ ...h, descripcion: e.target.value }))}
            />
          </FormField>
          <FormField label="N° Orden de Compra (interna)">
            <input
              type="number"
              className={INPUT_CLS}
              value={entradaHeader.ordenCompraInterna || ""}
              onChange={(e) => setEntradaHeader((h) => ({ ...h, ordenCompraInterna: Number(e.target.value) || undefined }))}
            />
          </FormField>
        </div>

        {bomProjects.length > 0 && (
          <div className="mb-3">
            <select
              className={`${INPUT_CLS} w-full sm:w-auto`}
              defaultValue=""
              onChange={(e) => {
                const p = bomProjects.find((bp) => bp.id === e.target.value);
                if (p) addLineasDesdeCompras(p);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                + Agregar líneas desde compras pendientes de un proyecto...
              </option>
              {bomProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.totalBarsToBuy} barras a comprar)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-800 mb-3">
          <table className="w-full text-xs">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="text-left px-2 py-2">Código Producto *</th>
                <th className="text-left px-2 py-2">Descripción</th>
                <th className="text-right px-2 py-2">Cantidad *</th>
                <th className="text-right px-2 py-2">Precio Unit.</th>
                <th className="text-left px-2 py-2">Partida/Talla</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entradaLineas.map((linea, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1">
                    <input
                      className={INPUT_CLS}
                      value={linea.codigoProducto}
                      onChange={(e) => updateLinea(idx, "codigoProducto", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className={INPUT_CLS}
                      value={linea.descripcionProducto || ""}
                      onChange={(e) => updateLinea(idx, "descripcionProducto", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      className={`${INPUT_CLS} text-right`}
                      value={linea.cantidad}
                      onChange={(e) => updateLinea(idx, "cantidad", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      className={`${INPUT_CLS} text-right`}
                      value={linea.precioUnitario || ""}
                      onChange={(e) => updateLinea(idx, "precioUnitario", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className={INPUT_CLS}
                      value={linea.partidaOTalla || ""}
                      onChange={(e) => updateLinea(idx, "partidaOTalla", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button onClick={() => removeLinea(idx)} className="text-red-400 hover:text-red-300">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={addLineaVacia}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
          >
            + Agregar línea
          </button>
          <ExportButton icon={Download} label="Generar planilla Softland" onClick={handleGenerateEntrada} accent />
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Solo cubre "Guía de Entrada" (ingresos de stock). Para la Guía de Salida/consumo aún no tengo la plantilla
          real de tu Softland — mándamela cuando la tengas y agrego ese generador también.
        </p>
      </section>

      {/* --- Planchas, Pernos y Consumo por Proyecto --- */}
      <SoftlandMaterialsSection />

      {/* --- Proyectos de Cubicación (BOM / nesting) --- */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-slate-100">Proyectos de Cubicación (Pre-anidado / Compras)</h3>
        </div>

        {bomProjects.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay proyectos de cubicación guardados. Guárdalos desde "Cubicación & Bodega → Historial".
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {bomProjects.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-200">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.totalProfilesCount} perfiles · {p.totalPiecesCount} piezas · {p.totalWeightKg.toFixed(0)} kg ·{" "}
                    {p.totalBarsToBuy} barras a comprar
                  </p>
                  {steelProjects.length > 0 && (
                    <select
                      className={`${INPUT_CLS} mt-1.5 w-auto`}
                      value={p.linkedSteelProjectId || ""}
                      onChange={(e) => handleLinkSteelProject(p.id, e.target.value)}
                    >
                      <option value="">Vincular a presupuesto (para rentabilidad)...</option>
                      {steelProjects.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-2">
                  <ExportButton icon={FileText} label="PDF" small onClick={() => exportBomProjectToPDF(p)} />
                  <ExportButton icon={FileSpreadsheet} label="Excel" small onClick={() => exportBomProjectToExcel(p)} />
                  <ExportButton
                    icon={Download}
                    label="Guía Salida (exp.)"
                    small
                    onClick={() => handleGenerateSalidaForProject(p)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Rentabilidad por Proyecto --- */}
      {profitabilityRows.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-rose-400" />
            <h3 className="font-semibold text-slate-100">Rentabilidad por Proyecto</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Costo real de materiales (perfiles según barras necesarias + planchas/pernos consumidos) vs. lo
            presupuestado. Solo material — no incluye mano de obra ni otros costos.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-800 mb-3">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2">Proyecto</th>
                  <th className="text-left px-3 py-2">Presupuesto</th>
                  <th className="text-right px-3 py-2">Presupuestado</th>
                  <th className="text-right px-3 py-2">Costo Real Materiales</th>
                  <th className="text-right px-3 py-2">Diferencia</th>
                  <th className="text-right px-3 py-2">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {profitabilityRows.map((r) => (
                  <tr key={r.bomProjectId}>
                    <td className="px-3 py-2 text-slate-300">{r.bomProjectName}</td>
                    <td className="px-3 py-2 text-slate-500">{r.linkedSteelProjectName || "Sin vincular"}</td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {r.presupuestadoCLP !== null ? `$${r.presupuestadoCLP.toLocaleString("es-CL")}` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">${r.costoRealTotalCLP.toLocaleString("es-CL")}</td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        r.diferenciaCLP === null ? "text-slate-500" : r.diferenciaCLP >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {r.diferenciaCLP !== null ? `$${r.diferenciaCLP.toLocaleString("es-CL")}` : "-"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        r.margenPct === null ? "text-slate-500" : r.margenPct >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {r.margenPct !== null ? `${r.margenPct}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ExportButton
            icon={FileSpreadsheet}
            label="Descargar reporte de rentabilidad"
            onClick={() => exportProfitabilityToExcel(profitabilityRows)}
            accent
          />
          <p className="text-[11px] text-slate-500 mt-2">
            Vincula cada proyecto de cubicación a su presupuesto en la lista de arriba para ver el margen. Sin
            vincular, solo se muestra el costo real de materiales.
          </p>
        </section>
      )}

      {/* --- Informe Mensual: Reales vs Teóricas, nunca mezcladas --- */}
      {monthlyRows.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100">Informe Mensual</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Reales y teóricas se muestran una al lado de la otra para comparar, pero son totales{" "}
            <span className="text-slate-200 font-medium">completamente independientes</span> — una cubicación
            teórica no se suma jamás dentro del total real, ni al exportar.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-800 mb-3">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th rowSpan={2} className="text-left px-3 py-2 align-bottom">Mes</th>
                  <th colSpan={3} className="text-center px-3 py-1.5 text-emerald-400 border-b border-slate-800">
                    ✅ Reales
                  </th>
                  <th colSpan={3} className="text-center px-3 py-1.5 text-amber-400 border-b border-slate-800 border-l border-slate-700">
                    🧪 Teóricas
                  </th>
                </tr>
                <tr>
                  <th className="text-right px-3 py-1.5">Cubicaciones</th>
                  <th className="text-right px-3 py-1.5">Peso (kg)</th>
                  <th className="text-right px-3 py-1.5">Costo Materiales</th>
                  <th className="text-right px-3 py-1.5 border-l border-slate-700">Cubicaciones</th>
                  <th className="text-right px-3 py-1.5">Peso (kg)</th>
                  <th className="text-right px-3 py-1.5">Costo Materiales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {monthlyRows.map((r) => (
                  <tr key={r.month}>
                    <td className="px-3 py-2 text-slate-300 font-medium">{r.monthLabel}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{r.reales.count}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{r.reales.totalWeightKg.toFixed(0)}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-medium">
                      ${Math.round(r.reales.totalCostoMaterialesCLP).toLocaleString("es-CL")}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 border-l border-slate-800">{r.teoricas.count}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{r.teoricas.totalWeightKg.toFixed(0)}</td>
                    <td className="px-3 py-2 text-right text-amber-400 font-medium">
                      ${Math.round(r.teoricas.totalCostoMaterialesCLP).toLocaleString("es-CL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ExportButton
            icon={FileSpreadsheet}
            label="Descargar informe mensual (Excel, hojas separadas)"
            onClick={() => exportMonthlyReportToExcel(monthlyRows)}
            accent
          />
          <p className="text-[11px] text-slate-500 mt-2">
            El Excel trae "Reales" y "Teóricas" en hojas separadas — nunca en la misma tabla ni sumadas.
          </p>
        </section>
      )}

      {/* --- Proyectos de presupuesto/cálculo (Acero-V1) --- */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-slate-100">Proyectos & Presupuestos</h3>
        </div>

        {steelProjects.length === 0 ? (
          <p className="text-sm text-slate-500">No hay proyectos guardados en "Proyectos & Historial" todavía.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {steelProjects.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-200">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.items.length} ítems · {p.clientName || "Sin cliente"}</p>
                </div>
                <div className="flex gap-2">
                  <ExportButton icon={FileText} label="PDF" small onClick={() => exportProjectToPDF(p)} />
                  <ExportButton icon={FileSpreadsheet} label="Excel" small onClick={() => exportProjectToExcel(p)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-amber-700 bg-amber-950/30" : "border-slate-800 bg-slate-950/50"}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${warn ? "text-amber-400" : "text-slate-100"}`}>{value}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-[11px] text-slate-500 flex flex-col gap-1">
      {label}
      {children}
    </label>
  );
}

function ManualMappingForm({
  headers,
  onConfirm
}: {
  headers: string[];
  onConfirm: (mapping: ColumnMapping) => void;
}) {
  const [codeCol, setCodeCol] = useState(-1);
  const [quantityCol, setQuantityCol] = useState(-1);
  const [descriptionCol, setDescriptionCol] = useState(-1);
  const [unitCol, setUnitCol] = useState(-1);

  const selectClass = "bg-slate-950 border border-slate-700 rounded-lg text-xs px-2 py-1.5 text-slate-200 w-full";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-xs text-slate-400">
        Columna de Código *
        <select className={selectClass} value={codeCol} onChange={(e) => setCodeCol(Number(e.target.value))}>
          <option value={-1}>Selecciona...</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h || `Columna ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Columna de Cantidad *
        <select className={selectClass} value={quantityCol} onChange={(e) => setQuantityCol(Number(e.target.value))}>
          <option value={-1}>Selecciona...</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h || `Columna ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Columna de Descripción (opcional)
        <select className={selectClass} value={descriptionCol} onChange={(e) => setDescriptionCol(Number(e.target.value))}>
          <option value={-1}>Ninguna</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h || `Columna ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Columna de Unidad (opcional)
        <select className={selectClass} value={unitCol} onChange={(e) => setUnitCol(Number(e.target.value))}>
          <option value={-1}>Ninguna</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h || `Columna ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <button
          disabled={codeCol < 0 || quantityCol < 0}
          onClick={() => onConfirm({ codeCol, quantityCol, descriptionCol, unitCol })}
          className="text-sm px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar mapeo
        </button>
      </div>
    </div>
  );
}

function ExportButton({
  icon: Icon,
  label,
  onClick,
  accent,
  small
}: {
  icon: typeof FileText;
  label: string;
  onClick: () => void;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border transition ${
        small ? "text-xs px-2.5 py-1.5" : "text-sm px-3.5 py-2"
      } ${
        accent
          ? "border-sky-700 bg-sky-950/40 text-sky-300 hover:bg-sky-900/50"
          : "border-slate-700 text-slate-300 hover:bg-slate-800"
      }`}
    >
      <Icon className={small ? "w-3.5 h-3.5" : "w-4 h-4"} /> {label}
    </button>
  );
}
