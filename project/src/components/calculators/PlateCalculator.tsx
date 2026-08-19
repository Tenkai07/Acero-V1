import React, { useState } from "react";
import { 
  Square, 
  Layers, 
  PlusCircle, 
  Save, 
  Info, 
  Check, 
  Maximize2 
} from "lucide-react";
import { 
  STANDARD_SHEET_SIZES, 
  CHILEAN_COMMERCIAL_THICKNESSES 
} from "../../data/chileanSteelData";
import { calculatePlateWeight } from "../../utils/steelCalculations";
import { SteelProject } from "../../types";

interface PlateCalculatorProps {
  onAddToProject: (item: {
    type: "placa";
    description: string;
    dimensions: string;
    quantity: number;
    unitWeightKg: number;
    totalWeightKg: number;
    unitPriceCLP: number;
    totalPriceCLP: number;
    notes?: string;
  }) => void;
  onSaveToHistory: (data: {
    category: "placa";
    title: string;
    summary: string;
    details: Record<string, any>;
    weightKg: number;
    priceCLP: number;
    tags: string[];
  }) => void;
  activeProject?: SteelProject;
}

export const PlateCalculator: React.FC<PlateCalculatorProps> = ({
  onAddToProject,
  onSaveToHistory,
  activeProject
}) => {
  const [plateType, setPlateType] = useState<"lisa" | "diamantada" | "inoxidable" | "galvanizada">("lisa");
  const [selectedPreset, setSelectedPreset] = useState<string>("1500 x 3000 mm (1.5 x 3 m Estándar)");
  
  const [lengthMm, setLengthMm] = useState<number>(3000);
  const [widthMm, setWidthMm] = useState<number>(1500);
  const [thicknessMm, setThicknessMm] = useState<number>(6.0); // Default to standard 6 mm
  const [density, setDensity] = useState<number>(8.0); // Exact 8.0 density as explicitly requested
  const [quantity, setQuantity] = useState<number>(1);
  const [pricePerKgCLP, setPricePerKgCLP] = useState<number>(1380);
  
  const [thicknessCategory, setThicknessCategory] = useState<"todas" | "delgadas" | "estructurales" | "gruesas">("todas");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Calculation results with density (8.0 kg/dm3 default)
  const result = calculatePlateWeight(lengthMm, widthMm, thicknessMm, density, quantity);
  const unitPrice = Math.round(result.unitWeightKg * pricePerKgCLP);
  const totalPrice = Math.round(result.totalWeightKg * pricePerKgCLP);

  const handlePresetChange = (label: string) => {
    setSelectedPreset(label);
    const preset = STANDARD_SHEET_SIZES.find((s) => s.label === label);
    if (preset && preset.width > 0) {
      setWidthMm(preset.width);
      setLengthMm(preset.length);
    }
  };

  const handleThicknessSelect = (mm: number) => {
    setThicknessMm(mm);
  };

  const filteredThicknesses = CHILEAN_COMMERCIAL_THICKNESSES.filter((t) => {
    if (thicknessCategory === "delgadas") return t.mm <= 5.0;
    if (thicknessCategory === "estructurales") return t.mm >= 6.0 && t.mm <= 22.0;
    if (thicknessCategory === "gruesas") return t.mm >= 25.0;
    return true;
  });

  const handleAddToProject = () => {
    const typeLabel = 
      plateType === "lisa" ? "Plancha Negra Lisa A36/A270ES" :
      plateType === "diamantada" ? "Plancha Diamantada / Antideslizante" :
      plateType === "inoxidable" ? "Plancha Acero Inoxidable 304" : "Plancha Galvanizada";

    const title = customTitle.trim() || `${typeLabel} e=${thicknessMm}mm`;

    onAddToProject({
      type: "placa",
      description: title,
      dimensions: `${lengthMm} x ${widthMm} x ${thicknessMm} mm (d=${density} kg/dm³)`,
      quantity,
      unitWeightKg: result.unitWeightKg,
      totalWeightKg: result.totalWeightKg,
      unitPriceCLP: unitPrice,
      totalPriceCLP: totalPrice,
      notes: `Área: ${result.totalAreaM2} m² | Densidad: ${density} kg/dm³`
    });

    setFeedbackMsg("¡Placa agregada a la cubicación del proyecto!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSaveHistory = () => {
    const typeLabel = 
      plateType === "lisa" ? "Plancha Lisa" :
      plateType === "diamantada" ? "Plancha Diamantada" :
      plateType === "inoxidable" ? "Plancha Inox 304" : "Plancha Galvanizada";

    onSaveToHistory({
      category: "placa",
      title: customTitle.trim() || `${typeLabel} ${lengthMm}x${widthMm}x${thicknessMm}mm`,
      summary: `${quantity} pza(s) de ${lengthMm}x${widthMm}x${thicknessMm} mm = ${result.totalWeightKg} kg ($${totalPrice.toLocaleString("es-CL")} CLP)`,
      details: {
        plateType,
        lengthMm,
        widthMm,
        thicknessMm,
        density,
        quantity,
        unitWeightKg: result.unitWeightKg,
        totalWeightKg: result.totalWeightKg,
        areaM2: result.areaM2,
        totalAreaM2: result.totalAreaM2,
        pricePerKgCLP,
        totalPriceCLP: totalPrice
      },
      weightKg: result.totalWeightKg,
      priceCLP: totalPrice,
      tags: ["Placa", `${thicknessMm}mm`, `d=${density}`, plateType]
    });

    setFeedbackMsg("¡Cálculo guardado en el historial!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const currentThicknessInfo = CHILEAN_COMMERCIAL_THICKNESSES.find((t) => t.mm === thicknessMm);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800/95 dark:bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Square className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">Calculadora de Planchas & Placas de Acero</h2>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Cálculo exacto en milímetros con medidas comerciales en Chile y densidad técnica <strong>{density} kg/dm³</strong>.
            </p>
          </div>

          {/* Density Selector */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Densidad acero:</span>
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setDensity(8.0)}
                className={`px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
                  density === 8.0 
                    ? "bg-sky-500 text-slate-950 shadow-sm" 
                    : "text-slate-300 hover:text-white"
                }`}
              >
                8.0 (Solicitada)
              </button>
              <button
                type="button"
                onClick={() => setDensity(7.85)}
                className={`px-2.5 py-1.5 rounded font-bold transition-all cursor-pointer ${
                  density === 7.85 
                    ? "bg-sky-500 text-slate-950 shadow-sm" 
                    : "text-slate-300 hover:text-white"
                }`}
              >
                7.85 (Teórica)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Inputs & Controls */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* 1. Plate Type Selector */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              1. Tipo de Plancha de Acero
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "lisa", label: "Negra Lisa (A36 / A270ES)", price: 1380 },
                { id: "diamantada", label: "Diamantada Antideslizante", price: 1650 },
                { id: "galvanizada", label: "Galvanizada G90 / Zincalum", price: 1850 },
                { id: "inoxidable", label: "Inoxidable AISI 304", price: 6800 },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setPlateType(t.id as any);
                    setPricePerKgCLP(t.price);
                  }}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium border text-left transition-all cursor-pointer ${
                    plateType === t.id
                      ? "bg-sky-500 text-slate-950 border-sky-400 font-bold shadow"
                      : "bg-slate-950/60 text-slate-300 border-slate-700 hover:bg-slate-700/50"
                  }`}
                >
                  <div className="truncate font-semibold">{t.label}</div>
                  <div className={`text-[10px] mt-0.5 ${plateType === t.id ? "text-slate-950 font-bold" : "text-sky-400"}`}>
                    Ref: ${t.price.toLocaleString("es-CL")}/kg
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Format Presets & Custom Dimensions */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                2. Medidas Estándar en Chile (Largo x Ancho)
              </label>
              <span className="text-[11px] text-sky-400 font-medium">
                {STANDARD_SHEET_SIZES.length - 1} formatos comerciales
              </span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STANDARD_SHEET_SIZES.filter(s => s.width > 0).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetChange(preset.label)}
                  className={`p-2.5 rounded-lg text-xs border text-left transition-all cursor-pointer ${
                    selectedPreset === preset.label
                      ? "bg-slate-700 text-sky-300 border-sky-500 font-bold shadow-sm"
                      : "bg-slate-950/60 text-slate-300 border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>{preset.label.split("(")[0]}</span>
                    {preset.length === 12000 && (
                      <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1 py-0.2 rounded border border-sky-500/40">
                        12x2.44m
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>

            {/* Custom Inputs with Quick Value Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-700/60">
              
              {/* Length */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Largo (L) en milímetros (mm)
                  </label>
                  <span className="text-[11px] text-sky-400 font-mono font-bold">
                    {(lengthMm / 1000).toFixed(2)} m
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={lengthMm || ""}
                    onChange={(e) => {
                      setLengthMm(parseFloat(e.target.value) || 0);
                      setSelectedPreset("Personalizada...");
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                    placeholder="Ej. 12000"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">mm</span>
                </div>
                
                {/* Quick Length buttons */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[12000, 6000, 3000, 2440, 2400, 2000, 1500, 1000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setLengthMm(v);
                        setSelectedPreset("Personalizada...");
                      }}
                      className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                        lengthMm === v
                          ? "bg-sky-500 text-slate-950 font-bold border-sky-400"
                          : "bg-slate-950 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      {v}mm
                    </button>
                  ))}
                </div>
              </div>

              {/* Width */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Ancho (A) en milímetros (mm)
                  </label>
                  <span className="text-[11px] text-sky-400 font-mono font-bold">
                    {(widthMm / 1000).toFixed(2)} m
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={widthMm || ""}
                    onChange={(e) => {
                      setWidthMm(parseFloat(e.target.value) || 0);
                      setSelectedPreset("Personalizada...");
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                    placeholder="Ej. 2440"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">mm</span>
                </div>
                
                {/* Quick Width buttons */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[2440, 2000, 1500, 1220, 1200, 1000, 500, 300].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setWidthMm(v);
                        setSelectedPreset("Personalizada...");
                      }}
                      className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                        widthMm === v
                          ? "bg-sky-500 text-slate-950 font-bold border-sky-400"
                          : "bg-slate-950 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      {v}mm
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* 3. Espesor SOLO EN MILÍMETROS (mm) */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  3. Espesor Estrictamente en Milímetros (mm)
                </label>
                <span className="text-[11px] text-slate-400">
                  Espesores comerciales en Chile (ej. 6 mm estándar, 8 mm, 10 mm, 12 mm, etc.)
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-sky-500/40">
                <span className="text-xs text-slate-400 font-medium">Espesor activo:</span>
                <span className="text-base font-black text-sky-400 font-mono">
                  {thicknessMm} mm
                </span>
              </div>
            </div>

            {/* Thickness Input in mm */}
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={thicknessMm || ""}
                onChange={(e) => setThicknessMm(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                placeholder="Ej. 6 (6 mm estándar chileno)"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-sky-400 font-mono">mm</span>
            </div>

            {/* Filter Categories for Thicknesses */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
              {[
                { id: "todas", label: "Todos los Espesores" },
                { id: "delgadas", label: "Delgadas (0.5 a 5 mm)" },
                { id: "estructurales", label: "Estructurales (6 a 22 mm)" },
                { id: "gruesas", label: "Gruesas / Minería (25 a 100 mm)" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setThicknessCategory(cat.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    thicknessCategory === cat.id
                      ? "bg-sky-500 text-slate-950 font-bold"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Metric Thickness Quick Selection Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-950/60 rounded-lg border border-slate-800">
              {filteredThicknesses.map((t) => {
                const isSelected = Math.abs(thicknessMm - t.mm) < 0.01;
                return (
                  <button
                    key={t.mm}
                    type="button"
                    title={t.typicalUse}
                    onClick={() => handleThicknessSelect(t.mm)}
                    className={`p-2 rounded text-center border text-xs font-mono transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? "bg-sky-500 text-slate-950 font-black border-sky-300 shadow-md scale-105"
                        : "bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-700/80 hover:border-slate-600"
                    }`}
                  >
                    <span className="font-bold text-xs">{t.mm} mm</span>
                  </button>
                );
              })}
            </div>

            {/* Current Selected Thickness Info */}
            {currentThicknessInfo && (
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span>
                  <strong>Uso típico en Chile ({currentThicknessInfo.mm} mm):</strong> {currentThicknessInfo.typicalUse}
                </span>
              </div>
            )}
          </div>

          {/* 4. Cantidad, Precio y Notas */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Cantidad de Planchas
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 bg-slate-950 hover:bg-slate-700 text-white rounded-l-lg border border-slate-700 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-950 border-y border-slate-700 text-center py-2 text-white font-mono text-sm focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 bg-slate-950 hover:bg-slate-700 text-white rounded-r-lg border border-slate-700 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Precio por Kilo ($ CLP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    value={pricePerKgCLP}
                    onChange={(e) => setPricePerKgCLP(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Nombre / Ubicación de Ítem
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ej. Placa Base Pilar Eje 1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Visual Diagram & Output Card */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Main Calculation Summary Card */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-sky-500/40 rounded-2xl p-5 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <span className="text-xs uppercase font-bold text-sky-400 tracking-wider">
                Resultado de Cálculo
              </span>
              <span className="text-xs text-slate-300 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800 font-mono font-bold">
                d = {density} kg/dm³
              </span>
            </div>

            {/* Big Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">
                  Peso Unitario (1 pza)
                </span>
                <span className="text-2xl font-black text-sky-400 font-mono">
                  {result.unitWeightKg.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-400 font-bold ml-1">kg</span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-sky-500/30">
                <span className="text-[11px] text-sky-300 block font-medium">
                  Peso Total ({quantity} pza{quantity > 1 ? "s" : ""})
                </span>
                <span className="text-2xl font-black text-white font-mono">
                  {result.totalWeightKg.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-sky-400 font-bold ml-1">kg</span>
              </div>
            </div>

            {/* Technical Detail Rows */}
            <div className="space-y-2 text-xs text-slate-300 pt-1">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Dimensiones de la pieza:</span>
                <span className="font-mono font-semibold text-white">
                  {lengthMm} x {widthMm} x {thicknessMm} mm
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Área unitaria / Total:</span>
                <span className="font-mono font-semibold text-white">
                  {result.areaM2} m² / {result.totalAreaM2} m²
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Volumen unitario:</span>
                <span className="font-mono font-semibold text-white">
                  {result.volumeDm3} dm³ (litros)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Fórmula de cálculo:</span>
                <span className="font-mono text-[11px] text-sky-300">
                  (L mm x A mm x e mm x {density}) / 1.000.000
                </span>
              </div>
              <div className="flex justify-between py-2 bg-slate-950/60 px-3 rounded-lg font-bold">
                <span className="text-sky-300">Presupuesto Estimado ({quantity} pza):</span>
                <span className="font-mono text-emerald-400 text-sm">
                  ${totalPrice.toLocaleString("es-CL")} CLP
                </span>
              </div>
            </div>

            {/* Visual Dynamic CAD Diagram */}
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                Representación Visual Proporcional
              </span>
              
              <div className="relative w-full h-32 flex items-center justify-center p-2">
                <div 
                  className="bg-gradient-to-br from-sky-500/20 to-blue-600/30 border-2 border-sky-400 rounded flex flex-col items-center justify-center relative shadow-inner transition-all duration-300"
                  style={{
                    width: `${Math.min(220, Math.max(70, (lengthMm / (lengthMm > 6000 ? 12000 : 3000)) * 180))}px`,
                    height: `${Math.min(100, Math.max(40, (widthMm / (widthMm > 1500 ? 2440 : 1500)) * 80))}px`,
                  }}
                >
                  {/* Texture if diamantada */}
                  {plateType === "diamantada" && (
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:8px_8px]" />
                  )}
                  
                  <span className="text-[11px] font-mono font-bold text-sky-300 z-10 text-center px-1">
                    {lengthMm} x {widthMm} mm
                  </span>
                  <span className="text-[10px] font-mono text-slate-300 z-10">
                    Espesor: {thicknessMm} mm
                  </span>

                  {/* Dimension Annotations */}
                  <span className="absolute -top-4 text-[9px] font-mono text-slate-400">
                    L = {lengthMm} mm
                  </span>
                  <span className="absolute -left-12 text-[9px] font-mono text-slate-400 rotate-[-90deg]">
                    A = {widthMm} mm
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddToProject}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Agregar a Cubicación</span>
              </button>

              <button
                type="button"
                onClick={handleSaveHistory}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4 text-sky-400" />
                <span>Guardar Historial</span>
              </button>
            </div>

            {feedbackMsg && (
              <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold text-center animate-fade-in flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {feedbackMsg}
              </div>
            )}

          </div>

          {/* Quick Technical Tip for Chilean Fabricators */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <Info className="w-4 h-4 text-sky-400" />
              <span>Normativa y Estándar de Planchas en Chile:</span>
            </div>
            <p>
              • Formatos grandes como <strong>12000 x 2440 mm</strong> (12 x 2.44 m) y <strong>1500 x 6000 mm</strong> son suministrados directamente para fabricación de estanques, puentes y naves industriales.
            </p>
            <p>
              • En Chile se comercializan espesores nominales métricos como <strong>6 mm, 8 mm, 10 mm, 12 mm, 16 mm, 20 mm y 25 mm</strong> (en lugar de fracciones imperiales como 6.35 mm o 12.7 mm).
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
