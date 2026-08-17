import React, { useState } from "react";
import { 
  Box, 
  Circle, 
  Layers, 
  PlusCircle, 
  Save, 
  Trash2, 
  Sparkles, 
  Info, 
  Check, 
  Maximize2, 
  Minimize2, 
  FileSpreadsheet, 
  Scissors, 
  Compass, 
  Wrench, 
  Package, 
  RotateCcw,
  Sliders,
  ChevronDown
} from "lucide-react";
import { 
  calculateCustomPiece, 
  ENGINEERING_MATERIALS, 
  MaterialDensityOption, 
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

export type PieceShapeType = 
  | "bloque-prisma" 
  | "cilindro-eje" 
  | "buje-tubo-macizo" 
  | "disco-plato" 
  | "brida-flange" 
  | "barra-hexagonal" 
  | "tronco-cono" 
  | "esfera" 
  | "cartela-triangulo" 
  | "cartela-trapecio";

export interface PartListItem {
  id: string;
  name: string;
  shape: PieceShapeType;
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
  onSaveToHistory,
  activeProject
}) => {
  // Shape & Category
  const [selectedShape, setSelectedShape] = useState<PieceShapeType>("bloque-prisma");
  
  // Dimensions State
  const [lengthMm, setLengthMm] = useState<number>(300);
  const [widthMm, setWidthMm] = useState<number>(150);
  const [heightMm, setHeightMm] = useState<number>(40);
  const [thicknessMm, setThicknessMm] = useState<number>(20);
  
  // Diameters & Radii
  const [outerDiameterMm, setOuterDiameterMm] = useState<number>(120);
  const [innerDiameterMm, setInnerDiameterMm] = useState<number>(60);
  const [diameterMajorMm, setDiameterMajorMm] = useState<number>(140);
  const [diameterMinorMm, setDiameterMinorMm] = useState<number>(70);
  const [hexWidthAcrossFlatsMm, setHexWidthAcrossFlatsMm] = useState<number>(46);
  
  // Gusset / Trapezoid
  const [baseMajorMm, setBaseMajorMm] = useState<number>(250);
  const [baseMinorMm, setBaseMinorMm] = useState<number>(120);
  const [cornerCutMm, setCornerCutMm] = useState<number>(25);

  // Holes / Flange
  const [numHoles, setNumHoles] = useState<number>(6);
  const [holeDiameterMm, setHoleDiameterMm] = useState<number>(18);

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
    shape: selectedShape,
    dimensions: {
      lengthMm,
      widthMm,
      heightMm,
      thicknessMm,
      outerDiameterMm,
      innerDiameterMm,
      diameterMm: outerDiameterMm,
      diameterMajorMm,
      diameterMinorMm,
      hexWidthAcrossFlatsMm,
      baseMajorMm,
      baseMinorMm,
      cornerCutMm,
      numHoles,
      holeDiameterMm
    },
    densityGcm3: currentDensity,
    quantity,
    subtractions
  });

  const unitPriceCLP = Math.round(result.unitWeightKg * pricePerKgCLP);
  const totalPriceCLP = Math.round(result.totalWeightKg * pricePerKgCLP);

  // Quick Preset Presets for Quick Testing in Workshops
  const applyPreset = (preset: {
    shape: PieceShapeType;
    title: string;
    dims: Record<string, number>;
  }) => {
    setSelectedShape(preset.shape);
    if (preset.dims.lengthMm !== undefined) setLengthMm(preset.dims.lengthMm);
    if (preset.dims.widthMm !== undefined) setWidthMm(preset.dims.widthMm);
    if (preset.dims.heightMm !== undefined) setHeightMm(preset.dims.heightMm);
    if (preset.dims.thicknessMm !== undefined) setThicknessMm(preset.dims.thicknessMm);
    if (preset.dims.outerDiameterMm !== undefined) setOuterDiameterMm(preset.dims.outerDiameterMm);
    if (preset.dims.innerDiameterMm !== undefined) setInnerDiameterMm(preset.dims.innerDiameterMm);
    if (preset.dims.diameterMajorMm !== undefined) setDiameterMajorMm(preset.dims.diameterMajorMm);
    if (preset.dims.diameterMinorMm !== undefined) setDiameterMinorMm(preset.dims.diameterMinorMm);
    if (preset.dims.hexWidthAcrossFlatsMm !== undefined) setHexWidthAcrossFlatsMm(preset.dims.hexWidthAcrossFlatsMm);
    if (preset.dims.baseMajorMm !== undefined) setBaseMajorMm(preset.dims.baseMajorMm);
    if (preset.dims.baseMinorMm !== undefined) setBaseMinorMm(preset.dims.baseMinorMm);
    if (preset.dims.cornerCutMm !== undefined) setCornerCutMm(preset.dims.cornerCutMm);
    if (preset.dims.numHoles !== undefined) setNumHoles(preset.dims.numHoles);
    if (preset.dims.holeDiameterMm !== undefined) setHoleDiameterMm(preset.dims.holeDiameterMm);
    setCustomTitle(preset.title);
  };

  // Add to Parts Assembly List
  const handleAddToList = () => {
    const itemTitle = customTitle.trim() || result.shapeName;
    const newItem: PartListItem = {
      id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: itemTitle,
      shape: selectedShape,
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

  const getDimensionsSummaryString = (): string => {
    switch (selectedShape) {
      case "bloque-prisma":
        return `${lengthMm}x${widthMm}x${heightMm} mm`;
      case "cilindro-eje":
        return `⌀${outerDiameterMm} x L=${lengthMm} mm`;
      case "buje-tubo-macizo":
        return `⌀ext ${outerDiameterMm} / ⌀int ${innerDiameterMm} x L=${lengthMm} mm`;
      case "disco-plato":
        return `⌀${outerDiameterMm} x e=${thicknessMm} mm`;
      case "brida-flange":
        return `⌀${outerDiameterMm}/⌀${innerDiameterMm} x ${thicknessMm}mm (${numHoles}x⌀${holeDiameterMm})`;
      case "barra-hexagonal":
        return `S=${hexWidthAcrossFlatsMm}mm x L=${lengthMm}mm`;
      case "tronco-cono":
        return `⌀${diameterMajorMm}/⌀${diameterMinorMm} x H=${heightMm}mm`;
      case "esfera":
        return `⌀${outerDiameterMm} mm`;
      case "cartela-triangulo":
        return `${baseMajorMm}x${heightMm}x${thicknessMm} mm (c=${cornerCutMm}mm)`;
      case "cartela-trapecio":
        return `B1=${baseMajorMm} B2=${baseMinorMm} H=${heightMm} e=${thicknessMm} mm`;
      default:
        return `${lengthMm}x${widthMm}x${thicknessMm} mm`;
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
        shape: selectedShape,
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
      tags: ["Pieza Mecanizada", selectedShape, `${currentDensity} g/cm³`]
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
                Calculadora Universal de Piezas & Sólidos
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-400/30">
                  Maestranza & Tornería
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingresa las medidas exactas de cualquier pieza, bloque, eje, buje, disco o refuerzo y obtén su peso, volumen y merma en tiempo real.
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
          
          {/* Left / Center Column: Shapes & Dimension Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Shape Geometry Selector Grid */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>1. Selecciona la Forma / Geometría de la Pieza</span>
                <span className="text-slate-500 text-[11px] font-normal lowercase">10 figuras 3D</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "bloque-prisma", label: "Bloque / Prisma", desc: "L x W x H", icon: Box },
                  { id: "cilindro-eje", label: "Eje / Barra", desc: "⌀D x L", icon: Circle },
                  { id: "buje-tubo-macizo", label: "Buje / Camisa", desc: "⌀ext / ⌀int x L", icon: Circle },
                  { id: "disco-plato", label: "Disco / Plato", desc: "⌀D x e", icon: Circle },
                  { id: "brida-flange", label: "Brida / Flange", desc: "⌀OD/ID + Pernos", icon: Circle },
                  { id: "barra-hexagonal", label: "Hexagonal", desc: "Entre caras S x L", icon: Box },
                  { id: "tronco-cono", label: "Tronco Cónico", desc: "⌀D1/⌀D2 x H", icon: Compass },
                  { id: "esfera", label: "Esfera Maciza", desc: "⌀D Bola", icon: Circle },
                  { id: "cartela-triangulo", label: "Cartela Triang.", desc: "B x H x e", icon: Layers },
                  { id: "cartela-trapecio", label: "Cartela Trapecio", desc: "B1/B2 x H x e", icon: Layers },
                ].map((s) => {
                  const Icon = s.icon;
                  const isSelected = selectedShape === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedShape(s.id as PieceShapeType);
                        setCustomTitle("");
                      }}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-sky-500 text-slate-950 border-sky-400 shadow-md font-bold"
                          : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-slate-950" : "text-sky-400"}`} />
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-950" />}
                      </div>
                      <span className="text-xs leading-tight font-semibold block">{s.label}</span>
                      <span className={`text-[10px] font-mono block mt-0.5 ${isSelected ? "text-slate-800" : "text-slate-500"}`}>
                        {s.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Presets for Fast Maestranza Tasks */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 mr-2">Medidas típicas rápidas:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button
                    onClick={() => applyPreset({ shape: "bloque-prisma", title: "Placa Base 200x200x16", dims: { lengthMm: 200, widthMm: 200, heightMm: 16 } })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Placa Base 200x200x16mm
                  </button>
                  <button
                    onClick={() => applyPreset({ shape: "cilindro-eje", title: "Eje Transmisión ⌀50x500", dims: { outerDiameterMm: 50, lengthMm: 500 } })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Eje ⌀50x500mm
                  </button>
                  <button
                    onClick={() => applyPreset({ shape: "buje-tubo-macizo", title: "Buje ⌀100/⌀60x120", dims: { outerDiameterMm: 100, innerDiameterMm: 60, lengthMm: 120 } })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Buje ⌀100/⌀60x120mm
                  </button>
                  <button
                    onClick={() => applyPreset({ shape: "brida-flange", title: "Flange ⌀200/⌀80 e=20 4x⌀18", dims: { outerDiameterMm: 200, innerDiameterMm: 80, thicknessMm: 20, numHoles: 4, holeDiameterMm: 18 } })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Flange ⌀200/80 e=20mm
                  </button>
                  <button
                    onClick={() => applyPreset({ shape: "cartela-triangulo", title: "Gusset Refuerzo 150x150x10", dims: { baseMajorMm: 150, heightMm: 150, thicknessMm: 10, cornerCutMm: 20 } })}
                    className="px-2 py-1 rounded text-[11px] bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    Cartela 150x150x10mm
                  </button>
                </div>
              </div>
            </div>

            {/* Dimension Sliders & Inputs */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>2. Dimensiones de la Pieza (en milímetros)</span>
                <span className="text-sky-400 font-mono text-xs">{getDimensionsSummaryString()}</span>
              </label>

              <div className="space-y-3.5">
                
                {/* Length L (Bloque, Eje, Buje, Hexágono) */}
                {(selectedShape === "bloque-prisma" || selectedShape === "cilindro-eje" || selectedShape === "buje-tubo-macizo" || selectedShape === "barra-hexagonal") && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("length")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-3 rounded-lg border transition-all ${hoveredDimension === "length" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">Longitud / Largo Total (L)</span>
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
                )}

                {/* Width W (Bloque) */}
                {selectedShape === "bloque-prisma" && (
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
                )}

                {/* Height / Thickness H (Bloque, Tronco Cono, Cartelas) */}
                {(selectedShape === "bloque-prisma" || selectedShape === "tronco-cono" || selectedShape === "cartela-triangulo" || selectedShape === "cartela-trapecio") && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("height")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-3 rounded-lg border transition-all ${hoveredDimension === "height" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">
                        {selectedShape === "bloque-prisma" ? "Altura / Espesor (H)" : "Altura (H)"}
                      </span>
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
                )}

                {/* Outer Diameter OD / D (Eje, Buje, Disco, Brida, Esfera) */}
                {(selectedShape === "cilindro-eje" || selectedShape === "buje-tubo-macizo" || selectedShape === "disco-plato" || selectedShape === "brida-flange" || selectedShape === "esfera") && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("outerDiameter")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-3 rounded-lg border transition-all ${hoveredDimension === "outerDiameter" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">
                        {selectedShape === "buje-tubo-macizo" || selectedShape === "brida-flange" ? "Diámetro Exterior (⌀ OD)" : "Diámetro Exterior (⌀ D)"}
                      </span>
                      <span className="font-mono font-bold text-sky-400">{outerDiameterMm} mm (⌀{(outerDiameterMm / 25.4).toFixed(2)}")</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="2"
                        max="1500"
                        step="1"
                        value={outerDiameterMm}
                        onChange={(e) => setOuterDiameterMm(parseFloat(e.target.value) || 2)}
                        className="w-full accent-sky-500"
                      />
                      <input
                        type="number"
                        min="1"
                        value={outerDiameterMm}
                        onChange={(e) => setOuterDiameterMm(parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Inner Diameter ID / Barreno (Buje, Brida) */}
                {(selectedShape === "buje-tubo-macizo" || selectedShape === "brida-flange") && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("innerDiameter")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-3 rounded-lg border transition-all ${hoveredDimension === "innerDiameter" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">Diámetro Interior / Barreno (⌀ ID)</span>
                      <span className="font-mono font-bold text-cyan-400">{innerDiameterMm} mm (Pared: {((outerDiameterMm - innerDiameterMm) / 2).toFixed(1)} mm)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max={Math.max(1, outerDiameterMm - 1)}
                        step="1"
                        value={innerDiameterMm}
                        onChange={(e) => setInnerDiameterMm(Math.min(outerDiameterMm - 1, parseFloat(e.target.value) || 0))}
                        className="w-full accent-cyan-500"
                      />
                      <input
                        type="number"
                        min="0"
                        max={outerDiameterMm - 1}
                        value={innerDiameterMm}
                        onChange={(e) => setInnerDiameterMm(Math.min(outerDiameterMm - 1, parseFloat(e.target.value) || 0))}
                        className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Thickness e (Disco, Brida, Cartelas) */}
                {(selectedShape === "disco-plato" || selectedShape === "brida-flange" || selectedShape === "cartela-triangulo" || selectedShape === "cartela-trapecio") && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("thickness")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-3 rounded-lg border transition-all ${hoveredDimension === "thickness" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">Espesor de Plancha / Chapa (e)</span>
                      <span className="font-mono font-bold text-sky-400">{thicknessMm} mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="200"
                        step="0.5"
                        value={thicknessMm}
                        onChange={(e) => setThicknessMm(parseFloat(e.target.value) || 1)}
                        className="w-full accent-sky-500"
                      />
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={thicknessMm}
                        onChange={(e) => setThicknessMm(parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Hexagon across flats S */}
                {selectedShape === "barra-hexagonal" && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("hexWidth")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-3 rounded-lg border transition-all ${hoveredDimension === "hexWidth" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"}`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">Distancia Entre Caras Planas (S / Llave)</span>
                      <span className="font-mono font-bold text-sky-400">{hexWidthAcrossFlatsMm} mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="5"
                        max="250"
                        step="1"
                        value={hexWidthAcrossFlatsMm}
                        onChange={(e) => setHexWidthAcrossFlatsMm(parseFloat(e.target.value) || 5)}
                        className="w-full accent-sky-500"
                      />
                      <input
                        type="number"
                        min="1"
                        value={hexWidthAcrossFlatsMm}
                        onChange={(e) => setHexWidthAcrossFlatsMm(parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Cone Diameters D1 & D2 */}
                {selectedShape === "tronco-cono" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-semibold text-slate-200">Diámetro Mayor (⌀ D1)</span>
                        <span className="font-mono font-bold text-sky-400">{diameterMajorMm} mm</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={diameterMajorMm}
                        onChange={(e) => setDiameterMajorMm(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-semibold text-slate-200">Diámetro Menor (⌀ D2)</span>
                        <span className="font-mono font-bold text-sky-400">{diameterMinorMm} mm</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={diameterMinorMm}
                        onChange={(e) => setDiameterMinorMm(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Flange Bolt Holes */}
                {selectedShape === "brida-flange" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div>
                      <span className="text-xs font-semibold text-slate-300 block mb-1">N° de Perforaciones / Pernos</span>
                      <input
                        type="number"
                        min="0"
                        max="32"
                        value={numHoles}
                        onChange={(e) => setNumHoles(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-300 block mb-1">Diámetro Barrenos (⌀ mm)</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={holeDiameterMm}
                        onChange={(e) => setHoleDiameterMm(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Gusset Bases & Corner Cut */}
                {(selectedShape === "cartela-triangulo" || selectedShape === "cartela-trapecio") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-xs font-semibold text-slate-300 block mb-1">
                        {selectedShape === "cartela-triangulo" ? "Base (B)" : "Base Mayor (B1)"}
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={baseMajorMm}
                        onChange={(e) => setBaseMajorMm(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                      />
                    </div>
                    {selectedShape === "cartela-trapecio" ? (
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="text-xs font-semibold text-slate-300 block mb-1">Base Menor (B2)</span>
                        <input
                          type="number"
                          min="1"
                          value={baseMinorMm}
                          onChange={(e) => setBaseMinorMm(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                        />
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="text-xs font-semibold text-slate-300 block mb-1">Despunte / Chaflán Esquina (c)</span>
                        <input
                          type="number"
                          min="0"
                          value={cornerCutMm}
                          onChange={(e) => setCornerCutMm(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-center font-bold"
                        />
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* Optional Machining & Pocket Subtractions Accordion */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Descuento por Vaciados / Barrenos (Mecanizado Torno/Fresa)
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
                      <span className="text-xs font-bold text-amber-400 block">Barrenos Cilíndricos</span>
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

          {/* Right Column: Material Selector, 2D CAD Preview & Results (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Material & Density Selector */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>3. Material & Densidad</span>
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

            {/* Live Interactive 2D/3D CAD SVG Diagram */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-sky-400" />
                  Esquema Técnico CAD
                </span>
                <span className="font-mono text-[11px] text-sky-400 font-semibold">{result.shapeName}</span>
              </div>

              <div className="w-full h-56 bg-slate-950 rounded-lg border border-slate-800 relative flex items-center justify-center overflow-hidden">
                {/* Millimeter Blueprint Grid Effect */}
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:12px_12px]" />

                <svg viewBox="0 0 300 200" className="w-full h-full relative z-10">
                  <defs>
                    <marker id="arrow-cad" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                    </marker>
                    <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#334155" />
                      <stop offset="50%" stopColor="#1e293b" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                  </defs>

                  {/* 1. Rectangular Block */}
                  {selectedShape === "bloque-prisma" && (
                    <g transform="translate(150, 100)">
                      {/* Isometric-like 3D Block projection */}
                      <path d="M -70 10 L 10 40 L 70 10 L -10 -20 Z" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                      <path d="M -70 10 L -70 -20 L -10 -50 L -10 -20 Z" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                      <path d="M -10 -20 L -10 -50 L 70 -20 L 70 10 Z" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />

                      {/* Dimension lines */}
                      <line x1="-70" y1="22" x2="10" y2="52" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="-35" y="48" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">L={lengthMm}</text>

                      <line x1="15" y1="52" x2="75" y2="22" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="50" y="48" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">W={widthMm}</text>

                      <line x1="82" y1="10" x2="82" y2="-20" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="88" y="-2" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">H={heightMm}</text>
                    </g>
                  )}

                  {/* 2. Cylinder / Solid Bar */}
                  {selectedShape === "cilindro-eje" && (
                    <g transform="translate(150, 100)">
                      <rect x="-80" y="-35" width="160" height="70" rx="0" fill="url(#metalGrad)" stroke="#64748b" strokeWidth="1.5" />
                      <ellipse cx="-80" cy="0" rx="14" ry="35" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                      <ellipse cx="80" cy="0" rx="14" ry="35" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />

                      {/* Centerline */}
                      <line x1="-100" y1="0" x2="100" y2="0" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="4 3" />

                      {/* Dimensions */}
                      <line x1="-80" y1="-48" x2="80" y2="-48" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="-53" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">L = {lengthMm} mm</text>

                      <line x1="102" y1="-35" x2="102" y2="35" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="108" y="4" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">⌀{outerDiameterMm}</text>
                    </g>
                  )}

                  {/* 3. Bushing / Hollow Cylinder */}
                  {selectedShape === "buje-tubo-macizo" && (
                    <g transform="translate(150, 100)">
                      <rect x="-75" y="-35" width="150" height="70" fill="url(#metalGrad)" stroke="#64748b" strokeWidth="1.5" />
                      {/* Outer Ellipse */}
                      <ellipse cx="-75" cy="0" rx="14" ry="35" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                      <ellipse cx="75" cy="0" rx="14" ry="35" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                      {/* Inner Bore Ellipse */}
                      <ellipse cx="75" cy="0" rx="8" ry="20" fill="#030712" stroke="#38bdf8" strokeWidth="1.5" />
                      <line x1="-75" y1="-20" x2="75" y2="-20" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="3 3" />
                      <line x1="-75" y1="20" x2="75" y2="20" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="3 3" />

                      <line x1="-75" y1="-46" x2="75" y2="-46" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="-51" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">L = {lengthMm}</text>
                      <text x="92" y="-12" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">⌀OD={outerDiameterMm}</text>
                      <text x="92" y="16" fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">⌀ID={innerDiameterMm}</text>
                    </g>
                  )}

                  {/* 4. Disc / Circular Plate */}
                  {selectedShape === "disco-plato" && (
                    <g transform="translate(150, 100)">
                      <ellipse cx="0" cy="0" rx="65" ry="65" fill="url(#metalGrad)" stroke="#94a3b8" strokeWidth="2" />
                      <line x1="-65" y1="0" x2="65" y2="0" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="-8" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">⌀ {outerDiameterMm} mm</text>
                      <text x="0" y="24" fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">Espesor e = {thicknessMm} mm</text>
                    </g>
                  )}

                  {/* 5. Flange with Bolt Holes */}
                  {selectedShape === "brida-flange" && (
                    <g transform="translate(150, 100)">
                      <circle cx="0" cy="0" r="70" fill="url(#metalGrad)" stroke="#94a3b8" strokeWidth="2" />
                      <circle cx="0" cy="0" r="30" fill="#030712" stroke="#38bdf8" strokeWidth="2" />
                      <circle cx="0" cy="0" r="50" fill="none" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="3 3" />
                      {/* Bolt Holes based on numHoles */}
                      {Array.from({ length: Math.min(12, Math.max(2, numHoles)) }).map((_, idx) => {
                        const angle = (idx * 2 * Math.PI) / Math.min(12, Math.max(2, numHoles));
                        const hx = 50 * Math.cos(angle);
                        const hy = 50 * Math.sin(angle);
                        return <circle key={idx} cx={hx} cy={hy} r="4.5" fill="#030712" stroke="#38bdf8" strokeWidth="1.2" />;
                      })}
                      <text x="0" y="-76" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">⌀OD={outerDiameterMm} / ⌀ID={innerDiameterMm}</text>
                      <text x="0" y="88" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{numHoles} Barrenos ⌀{holeDiameterMm}mm | e={thicknessMm}mm</text>
                    </g>
                  )}

                  {/* 6. Hexagonal Bar */}
                  {selectedShape === "barra-hexagonal" && (
                    <g transform="translate(150, 100)">
                      <polygon points="0,-45 40,-22 40,22 0,45 -40,22 -40,-22" fill="url(#metalGrad)" stroke="#94a3b8" strokeWidth="2" />
                      <line x1="-40" y1="0" x2="40" y2="0" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="-8" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">S = {hexWidthAcrossFlatsMm} mm</text>
                      <text x="0" y="65" fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">L = {lengthMm} mm</text>
                    </g>
                  )}

                  {/* 7. Truncated Cone */}
                  {selectedShape === "tronco-cono" && (
                    <g transform="translate(150, 100)">
                      <polygon points="-55,-35 55,-35 30,35 -30,35" fill="url(#metalGrad)" stroke="#94a3b8" strokeWidth="2" />
                      <line x1="-55" y1="-45" x2="55" y2="-45" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="-50" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">⌀D1 = {diameterMajorMm}</text>
                      <line x1="-30" y1="45" x2="30" y2="45" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="58" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">⌀D2 = {diameterMinorMm}</text>
                      <line x1="65" y1="-35" x2="65" y2="35" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="70" y="4" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">H={heightMm}</text>
                    </g>
                  )}

                  {/* 8. Sphere */}
                  {selectedShape === "esfera" && (
                    <g transform="translate(150, 100)">
                      <circle cx="0" cy="0" r="55" fill="url(#metalGrad)" stroke="#94a3b8" strokeWidth="2" />
                      <ellipse cx="0" cy="0" rx="55" ry="18" fill="none" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="3 3" />
                      <line x1="-55" y1="0" x2="55" y2="0" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="-6" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">⌀ {outerDiameterMm} mm</text>
                    </g>
                  )}

                  {/* 9. Triangular Gusset */}
                  {selectedShape === "cartela-triangulo" && (
                    <g transform="translate(150, 100)">
                      {cornerCutMm > 0 ? (
                        <polygon points="-60,-40 50,40 -60,40 -60,-20 -40,-40" fill="url(#metalGrad)" stroke="#94a3b8" strokeWidth="2" />
                      ) : (
                        <polygon points="-60,-40 50,40 -60,40" fill="url(#metalGrad)" stroke="#94a3b8" strokeWidth="2" />
                      )}
                      <line x1="-60" y1="52" x2="50" y2="52" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="-5" y="65" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">Base = {baseMajorMm} mm</text>
                      <line x1="-72" y1="-40" x2="-72" y2="40" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="-78" y="0" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" transform="rotate(-90 -78 0)" fontFamily="monospace">H={heightMm}</text>
                      <text x="10" y="-15" fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">e={thicknessMm}</text>
                    </g>
                  )}

                  {/* 10. Trapezoidal Gusset */}
                  {selectedShape === "cartela-trapecio" && (
                    <g transform="translate(150, 100)">
                      <polygon points="-65,35 65,35 35,-35 -35,-35" fill="url(#metalGrad)" stroke="#94a3b8" strokeWidth="2" />
                      <line x1="-65" y1="46" x2="65" y2="46" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="58" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">B1 = {baseMajorMm} mm</text>
                      <line x1="-35" y1="-44" x2="35" y2="-44" stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow-cad)" markerEnd="url(#arrow-cad)" />
                      <text x="0" y="-48" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">B2 = {baseMinorMm} mm</text>
                      <text x="50" y="0" fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">H={heightMm} e={thicknessMm}</text>
                    </g>
                  )}
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
                  <span>Tocho Bruto: <strong>{result.rawStockWeightKg} kg</strong></span>
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
                Conjunto de piezas calculadas para una estructura, máquina o mecanizado completo.
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
                Utiliza el calculador de pieza para ingresar las medidas de tus piezas y haz clic en <strong>"Añadir a Despiece"</strong> para acumular el peso y costo del conjunto.
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
