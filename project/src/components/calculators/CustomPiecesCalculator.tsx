import React, { useState } from "react";
import { 
  Box, 
  Layers, 
  PlusCircle, 
  Save, 
  Trash2, 
  Info, 
  Check, 
  FileSpreadsheet, 
  Scissors, 
  Compass, 
  Package, 
  Sliders
} from "lucide-react";
import { 
  calculateCustomPiece, 
  ENGINEERING_MATERIALS, 
  CustomPieceResult 
} from "../../utils/steelCalculations";
import { SteelProject } from "../../types";

interface CustomPiecesCalculatorProps {
  onAddToProject: (item: {
    type: "personalizado" | "placa" | "perfil" | "plegado";
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
    category: "perfil" | "placa" | "plegado" | "conversion";
    title: string;
    summary: string;
    details: Record<string, any>;
    weightKg: number;
    priceCLP: number;
    tags: string[];
  }) => void;
  activeProject?: SteelProject;
}

export interface PartListItem {
  id: string;
  name: string;
  dimensionsSummary: string;
  materialName: string;
  density: number;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
  unitPriceCLP: number;
  totalPriceCLP: number;
}

export const CustomPiecesCalculator: React.FC<CustomPiecesCalculatorProps> = ({
  onAddToProject,
  onSaveToHistory
}) => {
  // Dimensions State (Rectangular Block / Plate Cut: L x W x H)
  const [lengthMm, setLengthMm] = useState<number>(300);
  const [widthMm, setWidthMm] = useState<number>(150);
  const [heightMm, setHeightMm] = useState<number>(40);

  // Material & Density
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("carbon-steel-std");
  const [customDensity, setCustomDensity] = useState<number>(8.00);
  const [pricePerKgCLP, setPricePerKgCLP] = useState<number>(1450);
  const [quantity, setQuantity] = useState<number>(1);
  const [customTitle, setCustomTitle] = useState<string>("");

  // Subtractions / Machining Pockets (Vaciados y Barrenos)
  const [enableMachining, setEnableMachining] = useState<boolean>(false);
  const [boreQty, setBoreQty] = useState<number>(0);
  const [boreDiameterMm, setBoreDiameterMm] = useState<number>(20);
  const [boreDepthMm, setBoreDepthMm] = useState<number>(40);
  
  const [pocketQty, setPocketQty] = useState<number>(0);
  const [pocketLengthMm, setPocketLengthMm] = useState<number>(50);
  const [pocketWidthMm, setPocketWidthMm] = useState<number>(30);
  const [pocketDepthMm, setPocketDepthMm] = useState<number>(15);

  // Multi-piece List / Assembly
  const [partsList, setPartsList] = useState<PartListItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"single" | "list">("single");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [hoveredDimension, setHoveredDimension] = useState<string | null>(null);

  // Material selection logic
  const selectedMaterial = ENGINEERING_MATERIALS.find((m) => m.id === selectedMaterialId);
  const currentDensity = selectedMaterialId === "custom" ? customDensity : (selectedMaterial?.densityGcm3 || 8.00);

  // Construct subtractions array if enabled
  const subtractions = [];
  if (enableMachining) {
    if (boreQty > 0 && boreDiameterMm > 0 && boreDepthMm > 0) {
      subtractions.push({
        type: "barreno-cilindrico" as const,
        diameterMm: boreDiameterMm,
        depthMm: boreDepthMm,
        qty: boreQty
      });
    }
    if (pocketQty > 0 && pocketLengthMm > 0 && pocketWidthMm > 0 && pocketDepthMm > 0) {
      subtractions.push({
        type: "cajera-rectangular" as const,
        lengthMm: pocketLengthMm,
        widthMm: pocketWidthMm,
        depthMm: pocketDepthMm,
        qty: pocketQty
      });
    }
  }

  // Calculate Single Piece Result
  const result: CustomPieceResult = calculateCustomPiece({
    shape: "bloque-prisma",
    dimensions: {
      lengthMm,
      widthMm,
      heightMm
    },
    densityGcm3: currentDensity,
    quantity,
    subtractions
  });

  const unitPriceCLP = Math.round(result.unitWeightKg * pricePerKgCLP);
  const totalPriceCLP = Math.round(result.totalWeightKg * pricePerKgCLP);

  // Quick Presets for Fast Maestranza Tasks
  const applyPreset = (preset: { title: string; l: number; w: number; h: number }) => {
    setLengthMm(preset.l);
    setWidthMm(preset.w);
    setHeightMm(preset.h);
    setCustomTitle(preset.title);
  };

  const getDimensionsSummaryString = (): string => `${lengthMm}x${widthMm}x${heightMm} mm`;

  // Add to Parts Assembly List
  const handleAddToList = () => {
    const itemTitle = customTitle.trim() || result.shapeName;
    const newItem: PartListItem = {
      id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: itemTitle,
      dimensionsSummary: getDimensionsSummaryString(),
      materialName: selectedMaterial?.name || `Personalizado (${currentDensity} g/cm³)`,
      density: currentDensity,
      quantity,
      unitWeightKg: result.unitWeightKg,
      totalWeightKg: result.totalWeightKg,
      unitPriceCLP,
      totalPriceCLP
    };

    setPartsList([...partsList, newItem]);
    setFeedbackMsg(`¡Pieza "${itemTitle}" añadida a la lista de despiece!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleRemoveFromList = (id: string) => {
    setPartsList(partsList.filter((p) => p.id !== id));
  };

  const handleClearList = () => {
    if (window.confirm("¿Deseas vaciar toda la lista de despiece?")) {
      setPartsList([]);
    }
  };

  // Add Single item to Active Project
  const handleAddToProject = () => {
    const title = customTitle.trim() || result.shapeName;
    const matDesc = selectedMaterial?.name || `Material (${currentDensity} g/cm³)`;

    onAddToProject({
      type: "personalizado",
      description: `${title} [${matDesc}]`,
      dimensions: getDimensionsSummaryString(),
      quantity,
      unitWeightKg: result.unitWeightKg,
      totalWeightKg: result.totalWeightKg,
      unitPriceCLP,
      totalPriceCLP,
      notes: `Volumen: ${result.volumeCm3} cm³ (${result.volumeDm3} dm³) | Densidad: ${currentDensity} g/cm³${result.machinedScrapKg ? ` | Merma: ${result.machinedScrapKg} kg (${result.scrapPercentage}%)` : ""}`
    });

    setFeedbackMsg("¡Pieza agregada a la cubicación del proyecto!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Add Entire Multi-Piece List to Project
  const handleAddAllListToProject = () => {
    if (partsList.length === 0) return;

    partsList.forEach((item) => {
      onAddToProject({
        type: "personalizado",
        description: `${item.name} [${item.materialName}]`,
        dimensions: item.dimensionsSummary,
        quantity: item.quantity,
        unitWeightKg: item.unitWeightKg,
        totalWeightKg: item.totalWeightKg,
        unitPriceCLP: item.unitPriceCLP,
        totalPriceCLP: item.totalPriceCLP,
        notes: `Pieza despiece conjunto | Densidad: ${item.density} g/cm³`
      });
    });

    setFeedbackMsg(`¡Se agregaron ${partsList.length} piezas al proyecto!`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Save to calculation history
  const handleSaveToHistory = () => {
    const title = customTitle.trim() || result.shapeName;
    const matDesc = selectedMaterial?.name || `Densidad ${currentDensity} g/cm³`;

    onSaveToHistory({
      category: "conversion",
      title: `${title}`,
      summary: `${quantity} pza(s) ${getDimensionsSummaryString()} (${matDesc}) = ${result.totalWeightKg} kg ($${totalPriceCLP.toLocaleString("es-CL")} CLP)`,
      details: {
        shape: "bloque-prisma",
        dimensions: getDimensionsSummaryString(),
        material: matDesc,
        density: currentDensity,
        quantity,
        unitWeightKg: result.unitWeightKg,
        totalWeightKg: result.totalWeightKg,
        volumeCm3: result.volumeCm3,
        rawStockWeightKg: result.rawStockWeightKg,
        machinedScrapKg: result.machinedScrapKg,
        scrapPercentage: result.scrapPercentage,
        pricePerKgCLP,
        totalPriceCLP
      },
      weightKg: result.totalWeightKg,
      priceCLP: totalPriceCLP,
      tags: ["Corte Rectangular", "Placa / Bloque", `${currentDensity} g/cm³`]
    });

    setFeedbackMsg("¡Cálculo guardado en el historial!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Total list calculations
  const listTotalPieces = partsList.reduce((acc, item) => acc + item.quantity, 0);
  const listTotalWeightKg = Number(partsList.reduce((acc, item) => acc + item.totalWeightKg, 0).toFixed(2));
  const listTotalPriceCLP = Math.round(partsList.reduce((acc, item) => acc + item.totalPriceCLP, 0));

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Introduction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Piezas a Medida — Cortes Rectangulares
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-400/30">
                  Placa / Bloque
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingresa largo, ancho y espesor de cualquier corte cuadrado o rectangular de placa y obtén su peso, volumen y costo al instante.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher: Single Piece vs Parts List */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab("single")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "single"
                ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Calculador de Pieza
          </button>
          <button
            onClick={() => setActiveSubTab("list")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer relative ${
              activeSubTab === "list"
                ? "bg-sky-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Lista de Despiece
            {partsList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                {partsList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            {feedbackMsg}
          </span>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-400 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Main Single Piece Calculator */}
      {activeSubTab === "single" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left / Center Column: Dimension Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Quick Presets */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>1. Dimensiones del Corte (en milímetros)</span>
                <span className="text-sky-400 font-mono text-xs">{getDimensionsSummaryString()}</span>
              </label>

              <div className="pt-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-2">Medidas típicas rápidas:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button
                    onClick={() => applyPreset({ title: "Placa Base 200x200x16", l: 200, w: 200, h: 16 })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Placa Base 200x200x16mm
                  </button>
                  <button
                    onClick={() => applyPreset({ title: "Cartela Refuerzo 150x150x10", l: 150, w: 150, h: 10 })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Cartela 150x150x10mm
                  </button>
                  <button
                    onClick={() => applyPreset({ title: "Plancha Base Columna 300x300x20", l: 300, w: 300, h: 20 })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Base Columna 300x300x20mm
                  </button>
                  <button
                    onClick={() => applyPreset({ title: "Placa Nudo 250x120x12", l: 250, w: 120, h: 12 })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Placa Nudo 250x120x12mm
                  </button>
                </div>
              </div>
            </div>

            {/* Dimension Sliders & Inputs */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <div className="space-y-3.5">
                
                {/* Length L */}
                <div 
                  onMouseEnter={() => setHoveredDimension("length")}
                  onMouseLeave={() => setHoveredDimension(null)}
                  className={`p-3 rounded-lg border transition-all ${hoveredDimension === "length" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                >
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-semibold text-slate-200">Longitud / Largo (L)</span>
                    <span className="font-mono font-bold text-sky-400">{lengthMm} mm ({(lengthMm / 10).toFixed(1)} cm)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="3000"
                      step="1"
                      value={lengthMm}
                      onChange={(e) => setLengthMm(parseFloat(e.target.value) || 1)}
                      className="w-full accent-sky-500"
                    />
                    <input
                      type="number"
                      min="0.1"
                      value={lengthMm}
                      onChange={(e) => setLengthMm(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                    />
                  </div>
                </div>

                {/* Width W */}
                <div 
                  onMouseEnter={() => setHoveredDimension("width")}
                  onMouseLeave={() => setHoveredDimension(null)}
                  className={`p-3 rounded-lg border transition-all ${hoveredDimension === "width" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                >
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-semibold text-slate-200">Ancho (W o B)</span>
                    <span className="font-mono font-bold text-sky-400">{widthMm} mm ({(widthMm / 10).toFixed(1)} cm)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="2000"
                      step="1"
                      value={widthMm}
                      onChange={(e) => setWidthMm(parseFloat(e.target.value) || 1)}
                      className="w-full accent-sky-500"
                    />
                    <input
                      type="number"
                      min="0.1"
                      value={widthMm}
                      onChange={(e) => setWidthMm(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                    />
                  </div>
                </div>

                {/* Height / Thickness H */}
                <div 
                  onMouseEnter={() => setHoveredDimension("height")}
                  onMouseLeave={() => setHoveredDimension(null)}
                  className={`p-3 rounded-lg border transition-all ${hoveredDimension === "height" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                >
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-semibold text-slate-200">Altura / Espesor (H)</span>
                    <span className="font-mono font-bold text-sky-400">{heightMm} mm</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="1000"
                      step="1"
                      value={heightMm}
                      onChange={(e) => setHeightMm(parseFloat(e.target.value) || 1)}
                      className="w-full accent-sky-500"
                    />
                    <input
                      type="number"
                      min="0.1"
                      value={heightMm}
                      onChange={(e) => setHeightMm(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Optional Machining & Pocket Subtractions Accordion */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Descuento por Perforaciones / Cajeras
                  </span>
                </div>
                <button
                  onClick={() => setEnableMachining(!enableMachining)}
                  className={`text-xs px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                    enableMachining 
                      ? "bg-amber-500 text-slate-950" 
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {enableMachining ? "Activado ✓" : "Activar Vaciados +"}
                </button>
              </div>

              {enableMachining && (
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <p className="text-xs text-slate-400">
                    Resta el volumen de perforaciones o cajeras para calcular la viruta desprendida y el peso neto terminado.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Bore Holes */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-amber-400 block">Perforaciones Circulares</span>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                        <div>
                          <label className="text-slate-400 block mb-0.5">Cant.</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={boreQty} 
                            onChange={(e) => setBoreQty(parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono font-bold text-white" 
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-0.5">⌀ mm</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={boreDiameterMm} 
                            onChange={(e) => setBoreDiameterMm(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono font-bold text-white" 
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-0.5">Prof mm</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={boreDepthMm} 
                            onChange={(e) => setBoreDepthMm(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono font-bold text-white" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rectangular Pockets */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-amber-400 block">Cajeras Rectangulares</span>
                      <div className="grid grid-cols-4 gap-1 text-[11px]">
                        <div>
                          <label className="text-slate-400 block mb-0.5">Cant.</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={pocketQty} 
                            onChange={(e) => setPocketQty(parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono font-bold text-white" 
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-0.5">L mm</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={pocketLengthMm} 
                            onChange={(e) => setPocketLengthMm(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono font-bold text-white" 
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-0.5">W mm</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={pocketWidthMm} 
                            onChange={(e) => setPocketWidthMm(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono font-bold text-white" 
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-0.5">Prof</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={pocketDepthMm} 
                            onChange={(e) => setPocketDepthMm(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono font-bold text-white" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Material Selector, CAD Preview & Results (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Material & Density Selector */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>2. Material & Densidad</span>
                <span className="text-emerald-400 font-mono font-bold text-xs">{currentDensity.toFixed(2)} g/cm³</span>
              </label>

              <div>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-medium focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
                >
                  <optgroup label="Aceros & Inoxidables">
                    {ENGINEERING_MATERIALS.filter((m) => m.category === "Acero").map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.densityGcm3} g/cm³)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Fundición">
                    {ENGINEERING_MATERIALS.filter((m) => m.category === "Fundición").map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.densityGcm3} g/cm³)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Metales No Ferrosos (Aluminio, Bronce, Cobre)">
                    {ENGINEERING_MATERIALS.filter((m) => m.category === "No Ferroso").map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.densityGcm3} g/cm³)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Plásticos Técnicos (Nylon, POM, Teflón)">
                    {ENGINEERING_MATERIALS.filter((m) => m.category === "Plástico Técnico").map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.densityGcm3} g/cm³)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Personalizado">
                    <option value="custom">⚙️ Densidad Personalizada Manual (g/cm³)</option>
                  </optgroup>
                </select>

                {selectedMaterial?.notes && selectedMaterialId !== "custom" && (
                  <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    {selectedMaterial.notes}
                  </p>
                )}
              </div>

              {/* Custom Density manual slider */}
              {selectedMaterialId === "custom" && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">Densidad Manual (g/cm³ = kg/dm³)</span>
                    <span className="font-mono text-emerald-400 font-bold">{customDensity} g/cm³</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.5"
                      max="20.0"
                      step="0.05"
                      value={customDensity}
                      onChange={(e) => setCustomDensity(parseFloat(e.target.value) || 7.85)}
                      className="w-full accent-emerald-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={customDensity}
                      onChange={(e) => setCustomDensity(parseFloat(e.target.value) || 1)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded p-1 text-center font-mono text-xs font-bold text-white"
                    />
                  </div>
                </div>
              )}

              {/* Quantity & Commercial Price / kg */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Cantidad de Piezas</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Precio CLP / kg</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={pricePerKgCLP}
                    onChange={(e) => setPricePerKgCLP(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono font-bold text-center"
                  />
                </div>
              </div>
            </div>

            {/* Live Interactive CAD SVG Diagram */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-sky-400" />
                  Esquema Técnico CAD
                </span>
                <span className="font-mono text-[11px] text-sky-400 font-semibold">{result.shapeName}</span>
              </div>

              <div className="w-full h-56 bg-slate-950 rounded-lg border border-slate-800 relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:12px_12px]" />

                <svg viewBox="0 0 300 200" className="w-full h-full relative z-10">
                  <defs>
                    <marker id="arrow-cad" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                    </marker>
                  </defs>

                  <g transform="translate(150, 100)">
                    <path d="M -70 10 L 10 40 L 70 10 L -10 -20 Z" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                    <path d="M -70 10 L -70 -20 L -10 -50 L -10 -20 Z" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                    <path d="M -10 -20 L -10 -50 L 70 -20 L 70 10 Z" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />

                    <line x1="-70" y1="22" x2="10" y2="52" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                    <text x="-35" y="48" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">L={lengthMm}</text>

                    <line x1="15" y1="52" x2="75" y2="22" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                    <text x="50" y="48" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">W={widthMm}</text>

                    <line x1="82" y1="10" x2="82" y2="-20" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                    <text x="88" y="-2" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">H={heightMm}</text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Calculation Results Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-sky-500/30 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Resultados del Cálculo
                </span>
                <span className="text-xs font-mono text-sky-400 font-bold">
                  {quantity} unidad(es)
                </span>
              </div>

              {/* Main Weight Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Peso Unitario</span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-sky-400 mt-0.5">
                    {result.unitWeightKg} <span className="text-xs text-slate-400 font-normal">kg/u</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {(result.unitWeightKg * 2.20462).toFixed(2)} lbs
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/40">
                  <span className="text-[11px] text-sky-300 block font-medium">Peso Total ({quantity} pzas)</span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                    {result.totalWeightKg} <span className="text-xs text-sky-300 font-normal">kg</span>
                  </div>
                  <span className="text-[10px] text-sky-300/80 font-mono">
                    {(result.totalWeightKg / 1000).toFixed(4)} Toneladas
                  </span>
                </div>
              </div>

              {/* Volume & Machining Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Volumen Neto</span>
                  <span className="text-slate-200 font-bold">{result.volumeCm3} cm³</span>
                </div>
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Volumen (dm³)</span>
                  <span className="text-slate-200 font-bold">{result.volumeDm3} L (dm³)</span>
                </div>
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 block">Precio Total Estimado</span>
                  <span className="text-emerald-400 font-bold">${totalPriceCLP.toLocaleString("es-CL")} CLP</span>
                </div>
              </div>

              {/* Raw Stock vs Machined Scrap if Machining Enabled */}
              {enableMachining && result.machinedScrapKg ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between text-amber-300">
                  <span>Placa Bruta: <strong>{result.rawStockWeightKg} kg</strong></span>
                  <span>Viruta / Merma: <strong>{result.machinedScrapKg} kg ({result.scrapPercentage}%)</strong></span>
                </div>
              ) : null}

              {/* Custom Title Input */}
              <div>
                <input
                  type="text"
                  placeholder="Nombre / Identificador de la pieza (opcional)..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  onClick={handleAddToList}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-700 cursor-pointer shadow-sm"
                >
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  Añadir a Despiece
                </button>

                <button
                  onClick={handleAddToProject}
                  className="px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Package className="w-4 h-4" />
                  Agregar a Proyecto
                </button>

                <button
                  onClick={handleSaveToHistory}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar Historial
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Multi-Piece Assembly / Parts List View */}
      {activeSubTab === "list" && (
        <div className="space-y-4">
          
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-sky-400" />
                Lista de Despiece & Cubicación de Ensamble
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Conjunto de cortes de placa calculados para una estructura o pedido completo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSubTab("single")}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Calcular Otra Pieza
              </button>
              {partsList.length > 0 && (
                <button
                  onClick={handleClearList}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Vaciar Lista
                </button>
              )}
            </div>
          </div>

          {/* Parts List Table */}
          {partsList.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-3">
              <Box className="w-12 h-12 text-slate-600 mx-auto stroke-1" />
              <div className="text-sm font-semibold text-slate-300">No hay piezas agregadas a la lista de despiece</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Utiliza el calculador de pieza para ingresar las medidas de tus cortes y haz clic en <strong>"Añadir a Despiece"</strong> para acumular el peso y costo del conjunto.
              </p>
              <button
                onClick={() => setActiveSubTab("single")}
                className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <PlusCircle className="w-4 h-4" />
                Comenzar a Calcular Piezas
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Table of items */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="p-3">#</th>
                      <th className="p-3">Descripción de Pieza</th>
                      <th className="p-3">Dimensiones (mm)</th>
                      <th className="p-3">Material</th>
                      <th className="p-3 text-center">Cant.</th>
                      <th className="p-3 text-right">Peso Unit.</th>
                      <th className="p-3 text-right">Peso Total</th>
                      <th className="p-3 text-right">Costo Est.</th>
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {partsList.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-sans font-semibold text-white">{item.name}</td>
                        <td className="p-3 text-sky-400 font-bold">{item.dimensionsSummary}</td>
                        <td className="p-3 font-sans text-slate-300">{item.materialName}</td>
                        <td className="p-3 text-center text-white font-bold">{item.quantity}</td>
                        <td className="p-3 text-right text-slate-300">{item.unitWeightKg} kg</td>
                        <td className="p-3 text-right text-sky-400 font-black">{item.totalWeightKg} kg</td>
                        <td className="p-3 text-right text-emerald-400">${item.totalPriceCLP.toLocaleString("es-CL")}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleRemoveFromList(item.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            title="Eliminar de la lista"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Bottom Bar */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Piezas:</span>
                    <strong className="text-white font-mono text-base">{listTotalPieces} unidades</strong>
                  </div>
                  <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Peso Total Conjunto:</span>
                    <strong className="text-sky-400 font-mono text-base font-black">{listTotalWeightKg} kg ({(listTotalWeightKg / 1000).toFixed(3)} Ton)</strong>
                  </div>
                  <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Valor Total Estimado:</span>
                    <strong className="text-emerald-400 font-mono text-base font-bold">${listTotalPriceCLP.toLocaleString("es-CL")} CLP</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleAddAllListToProject}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    <Package className="w-4 h-4" />
                    Cargar Todo al Proyecto ({partsList.length} ítems)
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
