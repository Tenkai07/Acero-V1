import React, { useState, useRef } from "react";
import { X, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, ListChecks, Layers } from "lucide-react";
import { SteelProjectItem } from "../../types";
import { readBOMFromExcelFile } from "../../utils/bomExcelImporter";
import { readInventoryRowsFromExcelFile, groupInventoryRows } from "../../utils/inventoryExcelImporter";

type ImportFormat = "listado_perfiles" | "inventario";

interface ImportCubicacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  basePriceKgCLP: number;
  onImportItems: (items: Omit<SteelProjectItem, "id" | "createdAt">[]) => void;
}

export const ImportCubicacionModal: React.FC<ImportCubicacionModalProps> = ({
  isOpen,
  onClose,
  basePriceKgCLP,
  onImportItems
}) => {
  const [format, setFormat] = useState<ImportFormat>("listado_perfiles");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sheetInfo, setSheetInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setError(null);
    setSuccessMsg(null);
    setSheetInfo(null);
  };

  const handleFile = async (file: File) => {
    reset();
    if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) {
      setError("Por favor sube un archivo Excel (.xlsx o .xls).");
      return;
    }

    setIsProcessing(true);
    try {
      if (format === "listado_perfiles") {
        const result = await readBOMFromExcelFile(file);
        if (result.groups.length === 0) {
          setError(
            `No se detectaron perfiles en ninguna de las ${result.sheetsAvailable.length} hojas del archivo. Verifica que tenga columnas como "Cantidad", "Nombre", "Calidad" y "Longitud", o filas de tipo "Perfil : NOMBRE".`
          );
          return;
        }

        const items: Omit<SteelProjectItem, "id" | "createdAt">[] = result.groups.map((g) => {
          const unitWeightKg = g.totalPiecesCount > 0 ? Number((g.totalWeightKg / g.totalPiecesCount).toFixed(3)) : 0;
          const totalPriceCLP = Math.round(g.totalWeightKg * basePriceKgCLP);
          const gradesUsed = Array.from(new Set(g.pieces.map((p) => p.grade))).join(", ");
          return {
            type: "perfil",
            description: g.cleanProfileCode,
            profileName: g.cleanProfileCode,
            dimensions: `${g.pieces.length} cortes distintos | ${(g.totalLengthMm / 1000).toFixed(1)} m lineales`,
            quantity: g.totalPiecesCount,
            unitWeightKg,
            totalWeightKg: Number(g.totalWeightKg.toFixed(2)),
            unitPriceCLP: Math.round(unitWeightKg * basePriceKgCLP),
            totalPriceCLP,
            notes: `Importado desde cubicación Excel | Calidad(es): ${gradesUsed || "A36"} | Hoja: ${result.sheetUsed}`
          };
        });

        onImportItems(items);
        setSheetInfo(`Hoja usada: "${result.sheetUsed}" de ${result.sheetsAvailable.length} hojas en el archivo.`);
        setSuccessMsg(
          `¡Se importaron ${items.length} perfiles (${result.groups.reduce((s, g) => s + g.totalPiecesCount, 0)} piezas en total)!`
        );
      } else {
        const result = await readInventoryRowsFromExcelFile(file);
        if (result.rows.length === 0) {
          setError(
            `No se detectaron filas válidas en ninguna de las ${result.sheetsAvailable.length} hojas del archivo. Verifica que tenga columnas como "Cantidad", "Nombre", "Calidad" y "Longitud".`
          );
          return;
        }

        const grouped = groupInventoryRows(result.rows);

        const items: Omit<SteelProjectItem, "id" | "createdAt">[] = grouped.map((row) => {
          const unitWeightKg = row.quantity > 0 ? Number((row.weightKg / row.quantity).toFixed(3)) : 0;
          const totalPriceCLP = Math.round(row.weightKg * basePriceKgCLP);
          return {
            type: "perfil",
            description: row.name,
            profileName: row.name,
            dimensions: row.lengthMm ? `${row.lengthMm.toLocaleString("es-CL")} mm` : row.sectionType || "-",
            quantity: row.quantity,
            unitWeightKg,
            totalWeightKg: Number(row.weightKg.toFixed(2)),
            unitPriceCLP: Math.round(unitWeightKg * basePriceKgCLP),
            totalPriceCLP,
            notes: `Importado desde inventario Excel | Calidad: ${row.grade}${row.purchaseOrder ? ` | OC: ${row.purchaseOrder}` : ""} | Hoja: ${result.sheetUsed}`
          };
        });

        onImportItems(items);
        setSheetInfo(`Hoja usada: "${result.sheetUsed}" de ${result.sheetsAvailable.length} hojas en el archivo.`);
        setSuccessMsg(
          `¡Se importaron ${items.length} líneas (agrupadas desde ${result.totalParsed} filas originales)!`
        );
      }
    } catch (e) {
      console.error(e);
      setError("No se pudo leer el archivo. Verifica que sea un Excel válido y no esté dañado.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-sky-500/40 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-white">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-sky-400" />
            Importar Cubicación desde Excel
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Format Selector */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              1. Elige el formato de tu archivo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => { setFormat("listado_perfiles"); reset(); }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  format === "listado_perfiles"
                    ? "bg-sky-500/10 border-sky-500 ring-1 ring-sky-500/40"
                    : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <Layers className={`w-4 h-4 mb-1.5 ${format === "listado_perfiles" ? "text-sky-400" : "text-slate-500"}`} />
                <div className="text-xs font-bold text-white">Listado de Perfiles</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Cubicación agrupada por perfil (tipo Tekla / AutoCAD), con cantidad, largo y peso por pieza.
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setFormat("inventario"); reset(); }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  format === "inventario"
                    ? "bg-sky-500/10 border-sky-500 ring-1 ring-sky-500/40"
                    : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <ListChecks className={`w-4 h-4 mb-1.5 ${format === "inventario" ? "text-sky-400" : "text-slate-500"}`} />
                <div className="text-xs font-bold text-white">Registro de Inventario</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Planilla con una fila por lote/pieza: Cantidad, Nombre, Calidad, Longitud, Peso, OC, trazabilidad.
                </div>
              </button>
            </div>
          </div>

          {/* Upload Zone */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              2. Sube el archivo
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files && e.target.files[0] && handleFile(e.target.files[0])}
              />
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2 text-sky-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-semibold">Leyendo archivo...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Upload className="w-6 h-6" />
                  <span className="text-xs font-semibold">Haz clic para elegir tu archivo .xlsx</span>
                  <span className="text-[10px] text-slate-500">Se revisan todas las hojas automáticamente</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-900/60 rounded-lg px-3 py-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg} Las líneas se agregaron a la cubicación del proyecto activo.</span>
              </div>
              {sheetInfo && <p className="text-[11px] text-slate-500 px-1">{sheetInfo}</p>}
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Ver cubicación del proyecto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
