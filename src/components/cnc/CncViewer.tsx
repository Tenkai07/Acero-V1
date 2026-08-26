import React, { useState, useRef } from "react";
import {
  Upload,
  FileBox,
  Loader2,
  AlertCircle,
  Ruler,
  Box as BoxIcon,
  Layers,
  Info,
  PlusCircle,
  Save,
  Check
} from "lucide-react";
import { parseDstvFile, looksLikeDstv } from "../../utils/dstvParser";
import { parseDxfContent } from "../../utils/dxfParser";
import { normalizeDstvPiece, normalizeDxfPiece, CncNormalizedPiece } from "../../utils/cncGeometry";
import { Cnc2DDrawing } from "./Cnc2DDrawing";
import { Cnc3DView } from "./Cnc3DView";
import { SteelProjectItem, CalculationHistoryItem } from "../../types";

interface CncViewerProps {
  onAddToProject?: (item: Omit<SteelProjectItem, "id" | "createdAt">) => void;
  onSaveToHistory?: (item: Omit<CalculationHistoryItem, "id" | "timestamp">) => void;
  basePriceKgCLP?: number;
}

export const CncViewer: React.FC<CncViewerProps> = ({ onAddToProject, onSaveToHistory, basePriceKgCLP = 1420 }) => {
  const [piece, setPiece] = useState<CncNormalizedPiece | null>(null);
  const [activeFaceIdx, setActiveFaceIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plateThickness, setPlateThickness] = useState<number>(10);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsLoading(true);
    setFileName(file.name);
    try {
      const content = await file.text();
      const isDxf = file.name.toLowerCase().endsWith(".dxf");
      const isDstv = !isDxf && (looksLikeDstv(file.name, content) || /\.(nc1|nc|dstv)$/i.test(file.name));

      if (isDxf) {
        const dxfPiece = parseDxfContent(content);
        if (!dxfPiece.outerContour && dxfPiece.holes.length === 0) {
          setError("No se detectó geometría reconocible en el DXF (contorno o círculos). Verifica que el archivo tenga entidades LWPOLYLINE/LINE/CIRCLE en el espacio modelo.");
          setPiece(null);
          return;
        }
        const label = file.name.replace(/\.dxf$/i, "");
        setPiece(normalizeDxfPiece(dxfPiece, label, plateThickness, "A36"));
      } else if (isDstv) {
        const dstvPiece = parseDstvFile(content);
        if (dstvPiece.lengthMm === 0 && dstvPiece.holes.length === 0) {
          setError("No se pudo interpretar el archivo NC1/DSTV. Verifica que tenga los bloques ST/BO/AK estándar.");
          setPiece(null);
          return;
        }
        setPiece(normalizeDstvPiece(dstvPiece));
      } else {
        setError("Formato no reconocido. Sube un archivo .dxf (plancha) o .nc1/.nc/.dstv (perfil).");
        setPiece(null);
        return;
      }
      setActiveFaceIdx(0);
      setViewMode("2d");
    } catch (e) {
      console.error(e);
      setError("No se pudo leer el archivo. Verifica que no esté dañado o en un formato no soportado.");
      setPiece(null);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const activeFace = piece?.faces[activeFaceIdx] || piece?.faces[0];

  const estimatedWeightKg =
    piece?.kind === "profile"
      ? Number(((piece.weightPerMeterKg || 0) * (piece.lengthMm / 1000) * piece.quantity).toFixed(2))
      : piece
      ? Number(
          (
            ((piece.faces[0].contour.length > 2 ? shapeAreaCm2(piece.faces[0].contour) : (piece.lengthMm / 10) * (piece.widthMm / 10)) *
              (piece.thicknessMm / 10) *
              8.0) /
            1000
          ).toFixed(2)
        )
      : 0;

  const estimatedPriceCLP = Math.round(estimatedWeightKg * basePriceKgCLP);

  const handleAddToProject = () => {
    if (!piece || !onAddToProject) return;
    onAddToProject({
      type: piece.kind === "plate" ? "placa" : "perfil",
      description: `${piece.label} (importado de ${piece.source.toUpperCase()})`,
      profileName: piece.label,
      dimensions: `${piece.lengthMm.toLocaleString("es-CL")} x ${piece.widthMm.toLocaleString("es-CL")} mm${piece.kind === "plate" ? ` x ${piece.thicknessMm}mm` : ""}`,
      quantity: piece.quantity,
      unitWeightKg: Number((estimatedWeightKg / piece.quantity).toFixed(3)),
      totalWeightKg: estimatedWeightKg,
      unitPriceCLP: Math.round(estimatedPriceCLP / piece.quantity),
      totalPriceCLP: estimatedPriceCLP,
      notes: `Importado desde visor CNC (${fileName}) | ${piece.faces.reduce((s, f) => s + f.holes.length, 0)} perforaciones detectadas`
    });
    setFeedback("¡Pieza agregada al proyecto!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveHistory = () => {
    if (!piece || !onSaveToHistory) return;
    onSaveToHistory({
      category: piece.kind === "plate" ? "placa" : "perfil",
      title: `${piece.label} (CNC)`,
      summary: `${piece.quantity} pza(s) — ${estimatedWeightKg} kg ($${estimatedPriceCLP.toLocaleString("es-CL")} CLP)`,
      details: {
        source: piece.source,
        label: piece.label,
        lengthMm: piece.lengthMm,
        widthMm: piece.widthMm,
        thicknessMm: piece.thicknessMm,
        holesCount: piece.faces.reduce((s, f) => s + f.holes.length, 0)
      },
      weightKg: estimatedWeightKg,
      priceCLP: estimatedPriceCLP,
      tags: ["Visor CNC", piece.source.toUpperCase(), piece.label]
    });
    setFeedback("¡Guardado en el historial!");
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <FileBox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Visor de Archivos CNC</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Sube un DXF (plancha) o NC1/DSTV (perfil) y visualiza el plano acotado con sus perforaciones, más un modelo 3D interactivo.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      {!piece && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-10 text-center cursor-pointer transition-colors bg-slate-950/50"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".dxf,.nc1,.nc,.dstv"
              className="hidden"
              onChange={(e) => e.target.files && e.target.files[0] && handleFile(e.target.files[0])}
            />
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 text-sky-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm font-semibold">Leyendo archivo...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload className="w-8 h-8" />
                <span className="text-sm font-semibold">Haz clic para subir tu archivo CNC</span>
                <span className="text-xs text-slate-500">Formatos soportados: .dxf, .nc1, .nc, .dstv</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-300">Espesor de plancha (solo para DXF, en mm):</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={plateThickness}
              onChange={(e) => setPlateThickness(parseFloat(e.target.value) || 10)}
              className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Viewer */}
      {piece && activeFace && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Main viewer area */}
          <div className="lg:col-span-8 space-y-3">
            {/* Controls bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("2d")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    viewMode === "2d" ? "bg-sky-500 text-slate-950" : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                  }`}
                >
                  <Ruler className="w-3.5 h-3.5" />
                  Plano Acotado 2D
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("3d")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    viewMode === "3d" ? "bg-sky-500 text-slate-950" : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                  }`}
                >
                  <BoxIcon className="w-3.5 h-3.5" />
                  Modelo 3D
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setPiece(null); setError(null); setFileName(null); }}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Subir otro archivo
              </button>
            </div>

            {/* Face selector (DSTV profiles only) */}
            {piece.faces.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {piece.faces.map((f, idx) => (
                  <button
                    key={f.faceCode}
                    type="button"
                    onClick={() => setActiveFaceIdx(idx)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                      activeFaceIdx === idx
                        ? "bg-sky-500/15 border-sky-500 text-sky-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {f.faceLabel}
                    {f.holes.length > 0 && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 rounded-full">{f.holes.length}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Viewer canvas */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden" style={{ height: "480px" }}>
              {viewMode === "2d" ? <Cnc2DDrawing face={activeFace} /> : <Cnc3DView piece={piece} />}
            </div>

            {viewMode === "3d" && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Arrastra para rotar, rueda del mouse para acercar/alejar.
                {piece.kind === "profile" && " Los agujeros se marcan con anillos naranjos en su posición real; la sección es una aproximación según el tipo de perfil."}
              </p>
            )}
            {viewMode === "3d" && piece.kind === "profile" && piece.profileFamily === "unknown" && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                No se pudo identificar con certeza el tipo de perfil ("{piece.profileType || "?"}"). Se muestra una barra maciza con las dimensiones reales como aproximación; las cotas y agujeros en 2D sí son exactos.
              </p>
            )}
          </div>

          {/* Sidebar: piece info */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-4 space-y-3">
              <div className="border-b border-slate-800 pb-2">
                <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider block">
                  {piece.kind === "plate" ? "Plancha / Placa" : "Perfil"} — {piece.source.toUpperCase()}
                </span>
                <h3 className="text-base font-bold text-white leading-tight mt-0.5">{piece.label}</h3>
                {piece.profileType && <p className="text-xs text-slate-400 mt-0.5">Tipo: {piece.profileType}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Largo</span>
                  <span className="text-white font-mono font-bold">{piece.lengthMm.toLocaleString("es-CL")} mm</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">{piece.kind === "plate" ? "Ancho" : "Alto (h)"}</span>
                  <span className="text-white font-mono font-bold">{piece.widthMm.toLocaleString("es-CL")} mm</span>
                </div>
                {piece.kind === "plate" ? (
                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 col-span-2">
                    <span className="text-slate-400 block text-[10px]">Espesor</span>
                    <span className="text-white font-mono font-bold">{piece.thicknessMm} mm</span>
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Esp. Alma (tw)</span>
                      <span className="text-white font-mono font-bold">{piece.webThicknessMm || "-"} mm</span>
                    </div>
                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Esp. Ala (tf)</span>
                      <span className="text-white font-mono font-bold">{piece.flangeThicknessMm || "-"} mm</span>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-sky-500/20 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Cantidad:</span>
                  <span className="text-white font-mono font-bold">{piece.quantity}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Perforaciones:</span>
                  <span className="text-amber-400 font-mono font-bold">{piece.faces.reduce((s, f) => s + f.holes.length, 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-800">
                  <span className="text-sky-300 text-xs font-bold">Peso estimado:</span>
                  <span className="text-white font-mono font-black">{estimatedWeightKg} kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-300 text-xs font-bold">Precio estimado:</span>
                  <span className="text-emerald-400 font-mono font-black">${estimatedPriceCLP.toLocaleString("es-CL")}</span>
                </div>
              </div>

              {/* Hole table */}
              {activeFace.holes.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Perforaciones en {activeFace.faceLabel}:
                  </span>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800">
                    <table className="w-full text-[11px] font-mono">
                      <thead className="bg-slate-950 text-slate-500 sticky top-0">
                        <tr>
                          <th className="p-1.5 text-left">#</th>
                          <th className="p-1.5 text-right">X</th>
                          <th className="p-1.5 text-right">Y</th>
                          <th className="p-1.5 text-right">⌀</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {activeFace.holes.map((h, idx) => (
                          <tr key={idx} className="text-slate-300">
                            <td className="p-1.5 text-slate-500">{idx + 1}</td>
                            <td className="p-1.5 text-right">{h.x.toFixed(0)}</td>
                            <td className="p-1.5 text-right">{h.y.toFixed(0)}</td>
                            <td className="p-1.5 text-right text-amber-400">{h.diameterMm}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(onAddToProject || onSaveToHistory) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {onAddToProject && (
                    <button
                      type="button"
                      onClick={handleAddToProject}
                      className="px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Agregar a Proyecto
                    </button>
                  )}
                  {onSaveToHistory && (
                    <button
                      type="button"
                      onClick={handleSaveHistory}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar Historial
                    </button>
                  )}
                </div>
              )}

              {feedback && (
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  {feedback}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function shapeAreaCm2(points: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area / 2) / 100; // mm² -> cm²
}
