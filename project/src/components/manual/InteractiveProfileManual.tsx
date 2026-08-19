import React, { useState } from "react";
import { 
  BookOpen, 
  Layers, 
  PlusCircle, 
  Save, 
  Check, 
  Info, 
  Maximize2, 
  Sliders, 
  Ruler, 
  Cpu,
  Search,
  ChevronRight,
  Compass
} from "lucide-react";
import { STANDARD_CHILEAN_PROFILES } from "../../data/chileanSteelData";
import { ProfileCategory, ProfileDefinition } from "../../types";
import { 
  calculateBeamProperties, 
  calculateChannelProperties,
  calculateCChannelProperties,
  calculateHSSProperties,
  calculatePipeProperties,
  calculateAngleProperties,
  calculateBarProperties,
  calculateFlatProperties,
  calculateElbowProperties
} from "../../utils/steelCalculations";

interface InteractiveProfileManualProps {
  onAddToProject: (item: {
    type: "perfil";
    description: string;
    profileName?: string;
    dimensions: string;
    quantity: number;
    lengthM?: number;
    unitWeightKg: number;
    totalWeightKg: number;
    unitPriceCLP: number;
    totalPriceCLP: number;
    notes?: string;
  }) => void;
  onSaveToHistory: (data: {
    category: "perfil";
    title: string;
    summary: string;
    details: Record<string, any>;
    weightKg: number;
    priceCLP: number;
    tags: string[];
  }) => void;
}

export type CADShapeType = 
  | "viga-i-w" 
  | "canal-c"
  | "canal-u"
  | "canal-upn"
  | "tubo-rect" 
  | "tubo-redondo" 
  | "angulo-l" 
  | "barra-redonda" 
  | "pletina-cuadrada"
  | "codo-fitting";

export const InteractiveProfileManual: React.FC<InteractiveProfileManualProps> = ({
  onAddToProject,
  onSaveToHistory
}) => {
  const [profileMode, setProfileMode] = useState<"catalog" | "custom">("catalog");
  const [catalogCategory, setCatalogCategory] = useState<ProfileCategory | "all">("all");
  const [searchCatalog, setSearchCatalog] = useState<string>("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("cost-100-50-15-2");
  
  // Custom Parametric Dimensions State
  const [shapeType, setShapeType] = useState<CADShapeType>("canal-c");
  
  // Beam / Channel / Angle / Box dimensions
  const [hMm, setHMm] = useState<number>(100); // Altura total d o h
  const [bMm, setBMm] = useState<number>(50); // Ancho de ala bf
  const [twMm, setTwMm] = useState<number>(2.0); // Espesor alma tw o e
  const [tfMm, setTfMm] = useState<number>(2.0); // Espesor ala tf
  const [rMm, setRMm] = useState<number>(3.0); // Radio de acuerdo r
  const [cMm, setCMm] = useState<number>(15.0); // Pestaña / labio c (Costanera C)

  // Pipe / Round Bar dimensions
  const [diameterMm, setDiameterMm] = useState<number>(114.3); // OD Cañería
  const [pipeThicknessMm, setPipeThicknessMm] = useState<number>(6.02); // Espesor pared cañería
  const [elbowAngle, setElbowAngle] = useState<number>(90); // 90° o 45°
  
  const [hoveredDimension, setHoveredDimension] = useState<string | null>(null);
  const [lengthMeters, setLengthMeters] = useState<number>(6);
  const [quantity, setQuantity] = useState<number>(1);
  const [pricePerKgCLP, setPricePerKgCLP] = useState<number>(1420);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Profile lookup
  const currentPreset = STANDARD_CHILEAN_PROFILES.find((p) => p.id === selectedProfileId);

  // Filter Catalog
  const filteredCatalog = STANDARD_CHILEAN_PROFILES.filter((p) => {
    const matchesCat = catalogCategory === "all" || p.category === catalogCategory;
    const matchesSearch = 
      p.designation.toLowerCase().includes(searchCatalog.toLowerCase()) ||
      p.standard.toLowerCase().includes(searchCatalog.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // When picking from catalog, sync inputs and CAD shape
  const handleSelectFromCatalog = (id: string) => {
    setSelectedProfileId(id);
    const p = STANDARD_CHILEAN_PROFILES.find((prof) => prof.id === id);
    if (!p) return;

    if (p.category === "viga-w" || p.category === "viga-in" || p.category === "viga-hn" || p.category === "viga-hea" || p.category === "viga-ipe" || p.category === "viga-ipn") {
      setShapeType("viga-i-w");
      if (p.dimensions.h) setHMm(p.dimensions.h);
      if (p.dimensions.b) setBMm(p.dimensions.b);
      if (p.dimensions.tw) setTwMm(p.dimensions.tw);
      if (p.dimensions.tf) setTfMm(p.dimensions.tf);
      if (p.dimensions.r) setRMm(p.dimensions.r);
    } else if (p.category === "costanera-c" || p.category === "canal-c") {
      setShapeType("canal-c");
      if (p.dimensions.h) setHMm(p.dimensions.h);
      if (p.dimensions.b) setBMm(p.dimensions.b);
      if (p.dimensions.c) setCMm(p.dimensions.c);
      if (p.dimensions.t) {
        setTwMm(p.dimensions.t);
        setTfMm(p.dimensions.t);
      }
      if (p.dimensions.r) setRMm(p.dimensions.r);
    } else if (p.category === "canal-u") {
      setShapeType("canal-u");
      if (p.dimensions.h) setHMm(p.dimensions.h);
      if (p.dimensions.b) setBMm(p.dimensions.b);
      setCMm(0);
      if (p.dimensions.t) {
        setTwMm(p.dimensions.t);
        setTfMm(p.dimensions.t);
      }
      if (p.dimensions.r) setRMm(p.dimensions.r);
    } else if (p.category === "canal-upn" || p.category === "canal-laminado-c") {
      setShapeType("canal-upn");
      if (p.dimensions.h) setHMm(p.dimensions.h);
      if (p.dimensions.b) setBMm(p.dimensions.b);
      if (p.dimensions.tw) setTwMm(p.dimensions.tw);
      if (p.dimensions.tf) setTfMm(p.dimensions.tf);
      if (p.dimensions.r) setRMm(p.dimensions.r);
      setCMm(0);
    } else if (p.category === "costanera-z") {
      setShapeType("canal-c");
      if (p.dimensions.h) setHMm(p.dimensions.h);
      if (p.dimensions.b) setBMm(p.dimensions.b);
      if (p.dimensions.c) setCMm(p.dimensions.c);
      if (p.dimensions.t) {
        setTwMm(p.dimensions.t);
        setTfMm(p.dimensions.t);
      }
    } else if (p.category === "tubo-cuadrado" || p.category === "tubo-rectangular") {
      setShapeType("tubo-rect");
      if (p.dimensions.side) {
        setHMm(p.dimensions.side);
        setBMm(p.dimensions.side);
      }
      if (p.dimensions.h) setHMm(p.dimensions.h);
      if (p.dimensions.b) setBMm(p.dimensions.b);
      if (p.dimensions.t) {
        setTwMm(p.dimensions.t);
        setTfMm(p.dimensions.t);
      }
      if (p.dimensions.r) setRMm(p.dimensions.r);
    } else if (p.category === "tubo-redondo") {
      setShapeType("tubo-redondo");
      if (p.dimensions.diameter) setDiameterMm(p.dimensions.diameter);
      if (p.dimensions.thickness) setPipeThicknessMm(p.dimensions.thickness);
    } else if (p.category === "angulo-l") {
      setShapeType("angulo-l");
      if (p.dimensions.h) setHMm(p.dimensions.h);
      if (p.dimensions.b) setBMm(p.dimensions.b);
      if (p.dimensions.t) {
        setTwMm(p.dimensions.t);
        setTfMm(p.dimensions.t);
      }
    } else if (p.category === "barra-redonda-lisa" || p.category === "barra-redonda") {
      setShapeType("barra-redonda");
      if (p.dimensions.diameter) setDiameterMm(p.dimensions.diameter);
    } else if (p.category === "barra-cuadrada" || p.category === "pletina") {
      setShapeType("pletina-cuadrada");
      if (p.dimensions.side) {
        setBMm(p.dimensions.side);
        setHMm(p.dimensions.side);
      }
      if (p.dimensions.width) setBMm(p.dimensions.width);
      if (p.dimensions.thickness) setHMm(p.dimensions.thickness);
    } else if (p.category === "codo-fitting") {
      setShapeType("codo-fitting");
      if (p.dimensions.diameter) setDiameterMm(p.dimensions.diameter);
      if (p.dimensions.thickness) setPipeThicknessMm(p.dimensions.thickness);
      if (p.dimensions.angleDeg) setElbowAngle(p.dimensions.angleDeg);
    }
  };

  // Live Engineering Properties Calculation depending on shape
  let calculatedProperties = {
    weightKgM: 0,
    areaCm2: 0,
    ixCm4: 0,
    iyCm4: 0,
    wxCm3: 0,
    wyCm3: 0,
    rxCm: 0,
    ryCm: 0,
    extraDesc: ""
  };

  const isFitting = shapeType === "codo-fitting" || currentPreset?.category === "codo-fitting";

  if (shapeType === "viga-i-w") {
    const p = calculateBeamProperties(hMm, bMm, twMm, tfMm, rMm, 7.85);
    calculatedProperties = { ...p, extraDesc: "Viga doble T / I / H" };
  } else if (shapeType === "canal-c") {
    const p = calculateCChannelProperties(hMm, bMm, cMm, twMm, 7.85);
    const blankMm = Math.round(hMm + 2 * Math.max(0, bMm - twMm) + 2 * Math.max(0, cMm - twMm));
    calculatedProperties = { ...p, extraDesc: `Perfil C con Atiesador (Fleje/Corte: ${blankMm} mm)` };
  } else if (shapeType === "canal-u") {
    const p = calculateChannelProperties(hMm, bMm, twMm, twMm, 7.85);
    const blankMm = Math.round(hMm + 2 * Math.max(0, bMm - twMm));
    calculatedProperties = { ...p, extraDesc: `Canal U Plegado (Fleje/Corte: ${blankMm} mm)` };
  } else if (shapeType === "canal-upn") {
    const p = calculateChannelProperties(hMm, bMm, twMm, tfMm, 7.85);
    calculatedProperties = { ...p, extraDesc: "Canal Laminado UPN / ASTM AISC" };
  } else if (shapeType === "tubo-rect") {
    const p = calculateHSSProperties(hMm, bMm, twMm, 7.85);
    calculatedProperties = { ...p, extraDesc: "Tubo Estructural Hueco (HSS)" };
  } else if (shapeType === "tubo-redondo") {
    const p = calculatePipeProperties(diameterMm, pipeThicknessMm, 7.85);
    calculatedProperties = { ...p, extraDesc: "Cañería / Tubo Circular" };
  } else if (shapeType === "angulo-l") {
    const p = calculateAngleProperties(hMm, bMm, twMm, 7.85);
    calculatedProperties = { ...p, extraDesc: "Ángulo Estructural L" };
  } else if (shapeType === "barra-redonda") {
    const p = calculateBarProperties(diameterMm, 7.85);
    calculatedProperties = { ...p, extraDesc: "Barra Redonda Maciza" };
  } else if (shapeType === "pletina-cuadrada") {
    const p = calculateFlatProperties(bMm, hMm, 7.85);
    calculatedProperties = { ...p, extraDesc: "Pletina / Barra Rectangular" };
  } else if (shapeType === "codo-fitting") {
    const p = calculateElbowProperties(diameterMm, pipeThicknessMm, (elbowAngle === 45 ? 45 : 90), undefined, 7.85);
    calculatedProperties = {
      weightKgM: p.unitWeightKg,
      areaCm2: p.odMm,
      ixCm4: p.bendRadiusMm,
      iyCm4: p.centerToFaceMm,
      wxCm3: p.thicknessMm,
      wyCm3: elbowAngle,
      rxCm: 0,
      ryCm: 0,
      extraDesc: `Codo Butt-Weld ${elbowAngle}° R=${p.bendRadiusMm}mm`
    };
  }

  // Weight & price calculations
  const unitWeightKg = isFitting 
    ? (currentPreset?.weightPerPieceKg || calculatedProperties.weightKgM || 2.5)
    : Number((calculatedProperties.weightKgM * lengthMeters).toFixed(2));
  
  const totalWeightKg = Number((unitWeightKg * quantity).toFixed(2));
  const unitPriceCLP = isFitting && currentPreset?.refPriceCLP
    ? currentPreset.refPriceCLP
    : Math.round(unitWeightKg * pricePerKgCLP);
  const totalPriceCLP = Math.round(unitPriceCLP * quantity);

  const handleAddToProject = () => {
    const name = profileMode === "catalog" && currentPreset 
      ? currentPreset.designation 
      : `Perfil Paramétrico ${shapeType.toUpperCase()} (${hMm || diameterMm} mm)`;

    const dimText = isFitting
      ? `Codo Butt-Weld ${elbowAngle}° Ø ${diameterMm} mm x ${pipeThicknessMm} mm (Sch 40)`
      : shapeType === "tubo-redondo" || shapeType === "barra-redonda"
      ? `Ø ${diameterMm} mm x e:${pipeThicknessMm || 0} mm (L=${lengthMeters}m)`
      : `H:${hMm} mm, B:${bMm} mm, e:${twMm}/${tfMm} mm (L=${lengthMeters}m)`;

    onAddToProject({
      type: "perfil",
      description: name,
      profileName: name,
      dimensions: dimText,
      quantity,
      lengthM: isFitting ? undefined : lengthMeters,
      unitWeightKg,
      totalWeightKg,
      unitPriceCLP,
      totalPriceCLP,
      notes: isFitting 
        ? `C-F: ${calculatedProperties.iyCm4} mm | Radio: ${calculatedProperties.ixCm4} mm`
        : `Ix=${calculatedProperties.ixCm4} cm4 | Peso=${calculatedProperties.weightKgM} kg/m`
    });

    setFeedbackMsg("¡Perfil guardado en el proyecto actual!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSaveHistory = () => {
    const name = profileMode === "catalog" && currentPreset 
      ? currentPreset.designation 
      : `Ficha Paramétrica ${shapeType.toUpperCase()}`;

    onSaveToHistory({
      category: "perfil",
      title: `${name} - Ficha Técnica CAD`,
      summary: isFitting
        ? `${quantity} un. Codo ${elbowAngle}° Ø ${diameterMm} mm = ${totalWeightKg} kg ($${totalPriceCLP.toLocaleString("es-CL")} CLP)`
        : `${quantity} barra(s) de ${lengthMeters}m = ${totalWeightKg} kg (Ix: ${calculatedProperties.ixCm4} cm4)`,
      details: {
        shapeType,
        hMm,
        bMm,
        twMm,
        tfMm,
        diameterMm,
        lengthMeters: isFitting ? 0 : lengthMeters,
        quantity,
        properties: calculatedProperties,
        unitPriceCLP,
        totalPriceCLP
      },
      weightKg: totalWeightKg,
      priceCLP: totalPriceCLP,
      tags: ["Manual CAD", shapeType, `${calculatedProperties.weightKgM} kg/m`]
    });

    setFeedbackMsg("¡Ficha técnica guardada en el historial!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-800 dark:bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BookOpen className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Manual Interactivo de Perfiles CAD & Maestranza
              </h2>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Catálogo completo de perfiles comerciales en Chile (<strong>Vigas W, IN, HN, IPE, UPN, Costaneras C/Z, Tubos, Cañerías, Ángulos, Barras redondas para pernos/barandas y Codos</strong>). Ajusta dimensiones en tiempo real y visualiza el plano técnico CAD acotado con cálculo de propiedades mecánicas (Ix, Iy, Wx, Wy, rx, ry).
            </p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setProfileMode("catalog")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                profileMode === "catalog"
                  ? "bg-sky-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Catálogo Chile & HEA
            </button>
            <button
              onClick={() => setProfileMode("custom")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                profileMode === "custom"
                  ? "bg-sky-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Diseñador Paramétrico CAD
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Left Column: Selector & Dimensional Controls */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Mode 1: Full Catalog Search & Pick */}
          {profileMode === "catalog" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>Seleccionar Perfil del Catálogo</span>
                </span>
                <span className="text-xs text-slate-400">
                  {filteredCatalog.length} perfiles disponibles
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar pb-1">
                {[
                  { id: "all", label: "Todos" },
                  { id: "costanera-c", label: "Perfiles C (Costaneras)" },
                  { id: "canal-u", label: "Canales U Plegados" },
                  { id: "canal-upn", label: "Canales UPN (DIN)" },
                  { id: "canal-laminado-c", label: "Canales C (AISC)" },
                  { id: "costanera-z", label: "Costaneras Z" },
                  { id: "viga-hea", label: "Vigas HEA" },
                  { id: "viga-w", label: "Vigas W" },
                  { id: "viga-in", label: "Vigas IN" },
                  { id: "viga-hn", label: "Vigas HN" },
                  { id: "viga-ipe", label: "Vigas IPE" },
                  { id: "tubo-cuadrado", label: "Tubos Cuadrados" },
                  { id: "tubo-rectangular", label: "Tubos Rectangulares" },
                  { id: "tubo-redondo", label: "Cañerías Sch 40" },
                  { id: "angulo-l", label: "Ángulos L" },
                  { id: "barra-redonda-lisa", label: "Barras Lisas" },
                  { id: "barra-redonda", label: "Fierro Estriado" },
                  { id: "barra-cuadrada", label: "Barras Cuadradas" },
                  { id: "pletina", label: "Pletinas" },
                  { id: "codo-fitting", label: "Codos & Fittings" },
                  { id: "malla-acma", label: "Mallas Acma" },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCatalogCategory(c.id as any)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                      catalogCategory === c.id
                        ? "bg-sky-500 text-slate-950 border-sky-400 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchCatalog}
                  onChange={(e) => setSearchCatalog(e.target.value)}
                  placeholder="Buscar HEA, viga, perfil, ángulo, cañería o barra..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Profiles Scrollable List */}
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {filteredCatalog.map((prof) => {
                  const isSelected = selectedProfileId === prof.id;
                  const isUnit = prof.unit === "unidad" || prof.category === "codo-fitting";
                  const weight6m = Number((prof.weightPerMeterKg * 6).toFixed(1));
                  const weight12m = Number((prof.weightPerMeterKg * 12).toFixed(1));
                  const price6m = isUnit && prof.refPriceCLP ? prof.refPriceCLP : Math.round(weight6m * pricePerKgCLP);
                  const price12m = isUnit && prof.refPriceCLP ? prof.refPriceCLP * 2 : Math.round(weight12m * pricePerKgCLP);
                  
                  return (
                    <button
                      key={prof.id}
                      onClick={() => handleSelectFromCatalog(prof.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-sky-500/10 border-sky-500 text-white shadow-md ring-2 ring-sky-500/40"
                          : "bg-slate-950/70 border-slate-800/90 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="truncate pr-2">
                          <div className="font-bold text-xs text-sky-300 truncate">
                            {prof.designation}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {prof.standard}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-xs text-sky-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {isUnit ? `${prof.weightPerPieceKg || prof.weightPerMeterKg} kg/un` : `${prof.weightPerMeterKg} kg/m`}
                          </span>
                        </div>
                      </div>

                      {/* Pricing row */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-800 text-[10px]">
                        <span className="text-slate-400">
                          Tira 6m: <strong className="text-emerald-400 font-mono">${price6m.toLocaleString("es-CL")}</strong>
                        </span>
                        {!isUnit && (
                          <span className="text-slate-400">
                            Tira 12m: <strong className="text-emerald-300 font-mono">${price12m.toLocaleString("es-CL")}</strong>
                          </span>
                        )}
                        <span className="text-slate-500 font-mono">
                          ${pricePerKgCLP}/kg
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode 2: Custom Shape Selector */}
          {profileMode === "custom" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" />
                <span>Geometría & Tipo de Sección</span>
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: "canal-c", label: "Perfil C (Costanera)" },
                  { id: "canal-u", label: "Canal U Plegado" },
                  { id: "canal-upn", label: "Canal UPN / C Lam." },
                  { id: "viga-i-w", label: "Viga HEA / I / W" },
                  { id: "tubo-rect", label: "Tubo Rect./Cuad." },
                  { id: "tubo-redondo", label: "Cañería / Tubo" },
                  { id: "angulo-l", label: "Ángulo L" },
                  { id: "barra-redonda", label: "Barra Redonda" },
                  { id: "pletina-cuadrada", label: "Pletina / Barra" },
                  { id: "codo-fitting", label: "Codo Butt-Weld" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setShapeType(s.id as any);
                      if (s.id === "canal-c" && cMm <= 0) setCMm(15);
                      if (s.id === "canal-u") setCMm(0);
                    }}
                    className={`p-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                      shapeType === s.id
                        ? "bg-sky-500 text-slate-950 border-sky-400 shadow-sm"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sliders & Dimensions Editor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              <span>Ajuste de Dimensiones Milimétricas (mm)</span>
            </span>

            {/* Inputs based on shape */}
            {(shapeType === "viga-i-w" || shapeType === "canal-c" || shapeType === "canal-u" || shapeType === "canal-upn" || shapeType === "tubo-rect" || shapeType === "angulo-l" || shapeType === "pletina-cuadrada") && (
              <div className="space-y-3">
                {/* Height / Depth h */}
                <div 
                  onMouseEnter={() => setHoveredDimension("h")}
                  onMouseLeave={() => setHoveredDimension(null)}
                  className={`p-2.5 rounded-lg border transition-all ${
                    hoveredDimension === "h" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-semibold text-slate-200">
                      {shapeType === "pletina-cuadrada" ? "Espesor / Altura (h)" : "Altura Exterior Total (H / h)"}
                    </span>
                    <span className="font-mono font-bold text-sky-400">{hMm} mm</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="3"
                      max="600"
                      step="1"
                      value={hMm}
                      onChange={(e) => setHMm(parseFloat(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                    <input
                      type="number"
                      value={hMm}
                      onChange={(e) => setHMm(parseFloat(e.target.value) || 10)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center"
                    />
                  </div>
                </div>

                {/* Flange Width / Width b */}
                <div 
                  onMouseEnter={() => setHoveredDimension("b")}
                  onMouseLeave={() => setHoveredDimension(null)}
                  className={`p-2.5 rounded-lg border transition-all ${
                    hoveredDimension === "b" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-semibold text-slate-200">
                      {shapeType === "pletina-cuadrada" ? "Ancho de Pletina (b)" : "Ancho de Ala Exterior (B / b)"}
                    </span>
                    <span className="font-mono font-bold text-sky-400">{bMm} mm</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="10"
                      max="400"
                      step="1"
                      value={bMm}
                      onChange={(e) => setBMm(parseFloat(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                    <input
                      type="number"
                      value={bMm}
                      onChange={(e) => setBMm(parseFloat(e.target.value) || 10)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center"
                    />
                  </div>
                </div>

                {/* Web Thickness tw */}
                {shapeType !== "pletina-cuadrada" && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("tw")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-2.5 rounded-lg border transition-all ${
                      hoveredDimension === "tw" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">
                        {shapeType === "tubo-rect" || shapeType === "canal-c" || shapeType === "canal-u" 
                          ? "Espesor de Chapa / Pared (e / t)" 
                          : "Espesor del Alma (tw)"}
                      </span>
                      <span className="font-mono font-bold text-cyan-400">{twMm} mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0.8"
                        max="35"
                        step="0.1"
                        value={twMm}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTwMm(val);
                          if (shapeType === "tubo-rect" || shapeType === "angulo-l" || shapeType === "canal-c" || shapeType === "canal-u") {
                            setTfMm(val);
                          }
                        }}
                        className="w-full accent-sky-500"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={twMm}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 2;
                          setTwMm(val);
                          if (shapeType === "tubo-rect" || shapeType === "angulo-l" || shapeType === "canal-c" || shapeType === "canal-u") {
                            setTfMm(val);
                          }
                        }}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center"
                      />
                    </div>
                  </div>
                )}

                {/* Flange Thickness tf (for beams & hot-rolled channels) */}
                {(shapeType === "viga-i-w" || shapeType === "canal-upn") && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("tf")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-2.5 rounded-lg border transition-all ${
                      hoveredDimension === "tf" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">Espesor del Ala (tf)</span>
                      <span className="font-mono font-bold text-cyan-400">{tfMm} mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="2"
                        max="45"
                        step="0.1"
                        value={tfMm}
                        onChange={(e) => setTfMm(parseFloat(e.target.value))}
                        className="w-full accent-sky-500"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={tfMm}
                        onChange={(e) => setTfMm(parseFloat(e.target.value) || 3)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center"
                      />
                    </div>
                  </div>
                )}

                {/* Lip c (for Costaneras / Perfil C) */}
                {shapeType === "canal-c" && (
                  <div 
                    onMouseEnter={() => setHoveredDimension("c")}
                    onMouseLeave={() => setHoveredDimension(null)}
                    className={`p-2.5 rounded-lg border transition-all ${
                      hoveredDimension === "c" ? "bg-sky-500/10 border-sky-400" : "bg-slate-950/60 border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">Pestaña / Labio Atiesador (C / c)</span>
                      <span className="font-mono font-bold text-sky-400">{cMm} mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="1"
                        value={cMm}
                        onChange={(e) => setCMm(parseFloat(e.target.value))}
                        className="w-full accent-sky-500"
                      />
                      <input
                        type="number"
                        value={cMm}
                        onChange={(e) => setCMm(parseFloat(e.target.value) || 5)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Circular shapes: Pipe, Round bar, Elbow */}
            {(shapeType === "tubo-redondo" || shapeType === "barra-redonda" || shapeType === "codo-fitting") && (
              <div className="space-y-3">
                {/* Diameter */}
                <div className="p-2.5 rounded-lg border bg-slate-950/60 border-slate-800">
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-semibold text-slate-200">
                      {shapeType === "barra-redonda" ? "Diámetro Macizo (Ø D)" : "Diámetro Exterior (OD)"}
                    </span>
                    <span className="font-mono font-bold text-sky-400">{diameterMm} mm</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="6"
                      max="323.8"
                      step="0.1"
                      value={diameterMm}
                      onChange={(e) => setDiameterMm(parseFloat(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={diameterMm}
                      onChange={(e) => setDiameterMm(parseFloat(e.target.value) || 6)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center"
                    />
                  </div>
                </div>

                {/* Wall thickness for pipes & fittings */}
                {shapeType !== "barra-redonda" && (
                  <div className="p-2.5 rounded-lg border bg-slate-950/60 border-slate-800">
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">Espesor de Pared (t)</span>
                      <span className="font-mono font-bold text-cyan-400">{pipeThicknessMm} mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="0.1"
                        value={pipeThicknessMm}
                        onChange={(e) => setPipeThicknessMm(parseFloat(e.target.value))}
                        className="w-full accent-sky-500"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={pipeThicknessMm}
                        onChange={(e) => setPipeThicknessMm(parseFloat(e.target.value) || 1)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center"
                      />
                    </div>
                  </div>
                )}

                {/* Elbow Angle */}
                {shapeType === "codo-fitting" && (
                  <div className="p-2.5 rounded-lg border bg-slate-950/60 border-slate-800">
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-200">Ángulo de Curvatura</span>
                      <span className="font-mono font-bold text-sky-400">{elbowAngle}°</span>
                    </div>
                    <div className="flex gap-2">
                      {[90, 45].map((ang) => (
                        <button
                          key={ang}
                          type="button"
                          onClick={() => setElbowAngle(ang)}
                          className={`flex-1 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                            elbowAngle === ang ? "bg-sky-500 text-slate-950" : "bg-slate-900 text-slate-300"
                          }`}
                        >
                          Codo {ang}° (Radio Largo LR)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Length, Quantity & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
              {!isFitting && (
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Largo Barra (m)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={lengthMeters}
                    onChange={(e) => setLengthMeters(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Cantidad ({isFitting ? "unidades" : "barras"})
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Precio Base ($/kg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={pricePerKgCLP}
                  onChange={(e) => setPricePerKgCLP(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Dynamic SVG CAD Drawing & Mechanical Properties */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Dynamic SVG CAD Visualizer */}
          <div className="bg-slate-950 border-2 border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Ruler className="w-4 h-4" />
                <span>Plano Técnico CAD Dinámico (Cotas en Vivo)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {calculatedProperties.extraDesc}
              </span>
            </div>

            {/* SVG Canvas with Dynamic Dimension Annotations */}
            <div className="w-full h-80 bg-slate-900/90 rounded-xl border border-slate-800 p-2 flex items-center justify-center relative overflow-hidden">
              
              {/* Engineering Grid background */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

              <svg 
                className="w-full h-full max-w-[380px] max-h-[290px] overflow-visible" 
                viewBox="-40 -30 380 340"
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                  </marker>
                  <marker id="arrow-cyan" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                  </marker>
                </defs>

                {/* 1. BEAM W / IN / HN / HEA / IPE */}
                {shapeType === "viga-i-w" && (() => {
                  const maxDim = Math.max(hMm, bMm, 50);
                  const scale = 200 / maxDim;
                  const drawnH = hMm * scale;
                  const drawnB = bMm * scale;
                  const drawnTw = Math.max(4, twMm * scale);
                  const drawnTf = Math.max(4, tfMm * scale);

                  const cx = 150;
                  const cy = 140;
                  const leftX = cx - (drawnB / 2);
                  const rightX = cx + (drawnB / 2);
                  const topY = cy - (drawnH / 2);
                  const bottomY = cy + (drawnH / 2);
                  const webLeftX = cx - (drawnTw / 2);
                  const webRightX = cx + (drawnTw / 2);
                  const webTopY = topY + drawnTf;
                  const webBottomY = bottomY - drawnTf;

                  return (
                    <g>
                      <path
                        d={`M ${leftX} ${topY} L ${rightX} ${topY} L ${rightX} ${webTopY} L ${webRightX} ${webTopY} L ${webRightX} ${webBottomY} L ${rightX} ${webBottomY} L ${rightX} ${bottomY} L ${leftX} ${bottomY} L ${leftX} ${webBottomY} L ${webLeftX} ${webBottomY} L ${webLeftX} ${webTopY} L ${leftX} ${webTopY} Z`}
                        fill="#1e293b"
                        stroke={hoveredDimension ? "#38bdf8" : "#94a3b8"}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      {hoveredDimension === "tw" && (
                        <rect x={webLeftX} y={webTopY} width={drawnTw} height={webBottomY - webTopY} fill="#38bdf8" opacity="0.5" />
                      )}
                      {hoveredDimension === "tf" && (
                        <>
                          <rect x={leftX} y={topY} width={drawnB} height={drawnTf} fill="#38bdf8" opacity="0.5" />
                          <rect x={leftX} y={webBottomY} width={drawnB} height={drawnTf} fill="#38bdf8" opacity="0.5" />
                        </>
                      )}
                      {/* Top Dimension: b */}
                      <line x1={leftX} y1={topY - 14} x2={rightX} y2={topY - 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <line x1={leftX} y1={topY} x2={leftX} y2={topY - 18} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <line x1={rightX} y1={topY} x2={rightX} y2={topY - 18} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <text x={cx} y={topY - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">b = {bMm} mm</text>
                      
                      {/* Left Dimension: h */}
                      <line x1={leftX - 16} y1={topY} x2={leftX - 16} y2={bottomY} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={leftX - 22} y={cy} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${leftX - 22} ${cy})`} fontFamily="monospace">h = {hMm} mm</text>
                      
                      {/* Flange Thickness tf */}
                      <line x1={rightX + 10} y1={topY} x2={rightX + 10} y2={webTopY} stroke="#06b6d4" strokeWidth="1.2" markerStart="url(#arrow-cyan)" markerEnd="url(#arrow-cyan)" />
                      <text x={rightX + 16} y={topY + (drawnTf / 2) + 3} fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">tf={tfMm}</text>
                      
                      {/* Web Thickness tw */}
                      <line x1={webLeftX} y1={cy} x2={webRightX} y2={cy} stroke="#06b6d4" strokeWidth="1.2" markerStart="url(#arrow-cyan)" markerEnd="url(#arrow-cyan)" />
                      <text x={cx + 12} y={cy - 4} fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">tw={twMm}</text>
                    </g>
                  );
                })()}

                {/* 2A. COLD-FORMED C PROFILE WITH STIFFENER LIPS (COSTANERA C) */}
                {shapeType === "canal-c" && (() => {
                  const maxDim = Math.max(hMm, bMm, 50);
                  const scale = 190 / maxDim;
                  const drawnH = hMm * scale;
                  const drawnB = bMm * scale;
                  const drawnT = Math.max(3.5, twMm * scale);
                  const drawnC = Math.max(6, (cMm || 15) * scale);

                  const cx = 145;
                  const cy = 140;
                  const leftX = cx - (drawnB / 2);
                  const rightX = cx + (drawnB / 2);
                  const topY = cy - (drawnH / 2);
                  const bottomY = cy + (drawnH / 2);

                  // Blank size development calculation
                  const blankDevelopment = Math.round(hMm + 2 * Math.max(0, bMm - twMm) + 2 * Math.max(0, (cMm || 0) - twMm));

                  return (
                    <g>
                      {/* Grid / Reference Centerline */}
                      <line x1={cx - 110} y1={cy} x2={cx + 110} y2={cy} stroke="#334155" strokeWidth="0.8" strokeDasharray="4 4" />
                      <line x1={leftX + (drawnB * 0.35)} y1={topY - 30} x2={leftX + (drawnB * 0.35)} y2={bottomY + 30} stroke="#334155" strokeWidth="0.8" strokeDasharray="4 4" />

                      {/* C Channel CAD Profile */}
                      <path
                        d={`
                          M ${rightX} ${topY + drawnC}
                          L ${rightX} ${topY}
                          L ${leftX} ${topY}
                          L ${leftX} ${bottomY}
                          L ${rightX} ${bottomY}
                          L ${rightX} ${bottomY - drawnC}
                          L ${rightX - drawnT} ${bottomY - drawnC}
                          L ${rightX - drawnT} ${bottomY - drawnT}
                          L ${leftX + drawnT} ${bottomY - drawnT}
                          L ${leftX + drawnT} ${topY + drawnT}
                          L ${rightX - drawnT} ${topY + drawnT}
                          L ${rightX - drawnT} ${topY + drawnC}
                          Z
                        `}
                        fill="#1e293b"
                        stroke="#94a3b8"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />

                      {/* Hover Overlays */}
                      {hoveredDimension === "h" && (
                        <rect x={leftX - 2} y={topY} width={drawnT + 4} height={drawnH} fill="#38bdf8" opacity="0.45" />
                      )}
                      {hoveredDimension === "b" && (
                        <>
                          <rect x={leftX} y={topY - 2} width={drawnB} height={drawnT + 4} fill="#38bdf8" opacity="0.45" />
                          <rect x={leftX} y={bottomY - drawnT - 2} width={drawnB} height={drawnT + 4} fill="#38bdf8" opacity="0.45" />
                        </>
                      )}
                      {hoveredDimension === "c" && (
                        <>
                          <rect x={rightX - drawnT - 2} y={topY} width={drawnT + 4} height={drawnC} fill="#38bdf8" opacity="0.5" />
                          <rect x={rightX - drawnT - 2} y={bottomY - drawnC} width={drawnT + 4} height={drawnC} fill="#38bdf8" opacity="0.5" />
                        </>
                      )}
                      {hoveredDimension === "tw" && (
                        <path
                          d={`
                            M ${rightX} ${topY + drawnC}
                            L ${rightX} ${topY}
                            L ${leftX} ${topY}
                            L ${leftX} ${bottomY}
                            L ${rightX} ${bottomY}
                            L ${rightX} ${bottomY - drawnC}
                            L ${rightX - drawnT} ${bottomY - drawnC}
                            L ${rightX - drawnT} ${bottomY - drawnT}
                            L ${leftX + drawnT} ${bottomY - drawnT}
                            L ${leftX + drawnT} ${topY + drawnT}
                            L ${rightX - drawnT} ${topY + drawnT}
                            L ${rightX - drawnT} ${topY + drawnC}
                            Z
                          `}
                          fill="#06b6d4"
                          opacity="0.35"
                        />
                      )}

                      {/* Width Dimension: B */}
                      <line x1={leftX} y1={topY - 14} x2={rightX} y2={topY - 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <line x1={leftX} y1={topY} x2={leftX} y2={topY - 18} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <line x1={rightX} y1={topY} x2={rightX} y2={topY - 18} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <text x={cx} y={topY - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">B = {bMm} mm</text>

                      {/* Height Dimension: H */}
                      <line x1={leftX - 16} y1={topY} x2={leftX - 16} y2={bottomY} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <line x1={leftX} y1={topY} x2={leftX - 20} y2={topY} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <line x1={leftX} y1={bottomY} x2={leftX - 20} y2={bottomY} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <text x={leftX - 22} y={cy} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${leftX - 22} ${cy})`} fontFamily="monospace">H = {hMm} mm</text>

                      {/* Lip Dimension: C */}
                      <line x1={rightX + 14} y1={topY} x2={rightX + 14} y2={topY + drawnC} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <line x1={rightX} y1={topY} x2={rightX + 18} y2={topY} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <line x1={rightX} y1={topY + drawnC} x2={rightX + 18} y2={topY + drawnC} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <text x={rightX + 22} y={topY + (drawnC / 2) + 3} fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">C={cMm}</text>

                      {/* Sheet Thickness e / t */}
                      <text x={leftX + drawnT + 8} y={cy} fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">e = {twMm} mm</text>

                      {/* Technical Callout Badge */}
                      <rect x={10} y={10} width={280} height={22} rx={4} fill="#0f172a" stroke="#334155" strokeWidth="1" />
                      <text x={20} y={24} fill="#94a3b8" fontSize="9" fontWeight="bold" fontFamily="monospace">
                        PERFIL C: {hMm}x{bMm}x{cMm}x{twMm} | Fleje: {blankDevelopment}mm
                      </text>
                    </g>
                  );
                })()}

                {/* 2B. COLD-FORMED U CHANNEL WITHOUT LIPS */}
                {shapeType === "canal-u" && (() => {
                  const maxDim = Math.max(hMm, bMm, 50);
                  const scale = 190 / maxDim;
                  const drawnH = hMm * scale;
                  const drawnB = bMm * scale;
                  const drawnT = Math.max(3.5, twMm * scale);

                  const cx = 145;
                  const cy = 140;
                  const leftX = cx - (drawnB / 2);
                  const rightX = cx + (drawnB / 2);
                  const topY = cy - (drawnH / 2);
                  const bottomY = cy + (drawnH / 2);

                  const blankDevelopment = Math.round(hMm + 2 * Math.max(0, bMm - twMm));

                  return (
                    <g>
                      <line x1={cx - 110} y1={cy} x2={cx + 110} y2={cy} stroke="#334155" strokeWidth="0.8" strokeDasharray="4 4" />
                      
                      <path
                        d={`
                          M ${rightX} ${topY}
                          L ${leftX} ${topY}
                          L ${leftX} ${bottomY}
                          L ${rightX} ${bottomY}
                          L ${rightX} ${bottomY - drawnT}
                          L ${leftX + drawnT} ${bottomY - drawnT}
                          L ${leftX + drawnT} ${topY + drawnT}
                          L ${rightX} ${topY + drawnT}
                          Z
                        `}
                        fill="#1e293b"
                        stroke="#94a3b8"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />

                      {hoveredDimension === "h" && (
                        <rect x={leftX - 2} y={topY} width={drawnT + 4} height={drawnH} fill="#38bdf8" opacity="0.45" />
                      )}
                      {hoveredDimension === "b" && (
                        <>
                          <rect x={leftX} y={topY - 2} width={drawnB} height={drawnT + 4} fill="#38bdf8" opacity="0.45" />
                          <rect x={leftX} y={bottomY - drawnT - 2} width={drawnB} height={drawnT + 4} fill="#38bdf8" opacity="0.45" />
                        </>
                      )}

                      {/* Top Dimension: B */}
                      <line x1={leftX} y1={topY - 14} x2={rightX} y2={topY - 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <line x1={leftX} y1={topY} x2={leftX} y2={topY - 18} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <line x1={rightX} y1={topY} x2={rightX} y2={topY - 18} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <text x={cx} y={topY - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">B = {bMm} mm</text>

                      {/* Left Dimension: H */}
                      <line x1={leftX - 16} y1={topY} x2={leftX - 16} y2={bottomY} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <line x1={leftX} y1={topY} x2={leftX - 20} y2={topY} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <line x1={leftX} y1={bottomY} x2={leftX - 20} y2={bottomY} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                      <text x={leftX - 22} y={cy} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${leftX - 22} ${cy})`} fontFamily="monospace">H = {hMm} mm</text>

                      {/* Thickness */}
                      <text x={leftX + drawnT + 8} y={cy} fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">e = {twMm} mm</text>

                      {/* Technical Callout Badge */}
                      <rect x={10} y={10} width={280} height={22} rx={4} fill="#0f172a" stroke="#334155" strokeWidth="1" />
                      <text x={20} y={24} fill="#94a3b8" fontSize="9" fontWeight="bold" fontFamily="monospace">
                        CANAL U: {hMm}x{bMm}x{twMm} | Fleje: {blankDevelopment}mm
                      </text>
                    </g>
                  );
                })()}

                {/* 2C. HOT ROLLED UPN / ASTM C CHANNEL */}
                {shapeType === "canal-upn" && (() => {
                  const maxDim = Math.max(hMm, bMm, 50);
                  const scale = 190 / maxDim;
                  const drawnH = hMm * scale;
                  const drawnB = bMm * scale;
                  const drawnTw = Math.max(3.5, twMm * scale);
                  const drawnTf = Math.max(4.5, tfMm * scale);

                  const cx = 145;
                  const cy = 140;
                  const leftX = cx - (drawnB / 2);
                  const rightX = cx + (drawnB / 2);
                  const topY = cy - (drawnH / 2);
                  const bottomY = cy + (drawnH / 2);

                  return (
                    <g>
                      <line x1={cx - 110} y1={cy} x2={cx + 110} y2={cy} stroke="#334155" strokeWidth="0.8" strokeDasharray="4 4" />
                      
                      <path
                        d={`
                          M ${rightX} ${topY}
                          L ${leftX} ${topY}
                          L ${leftX} ${bottomY}
                          L ${rightX} ${bottomY}
                          L ${rightX} ${bottomY - drawnTf}
                          L ${leftX + drawnTw} ${bottomY - drawnTf}
                          L ${leftX + drawnTw} ${topY + drawnTf}
                          L ${rightX} ${topY + drawnTf}
                          Z
                        `}
                        fill="#1e293b"
                        stroke="#94a3b8"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />

                      {/* Dimensions */}
                      <line x1={leftX} y1={topY - 14} x2={rightX} y2={topY - 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={cx} y={topY - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">b = {bMm} mm</text>

                      <line x1={leftX - 16} y1={topY} x2={leftX - 16} y2={bottomY} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={leftX - 22} y={cy} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${leftX - 22} ${cy})`} fontFamily="monospace">h = {hMm} mm</text>

                      <line x1={rightX + 10} y1={topY} x2={rightX + 10} y2={topY + drawnTf} stroke="#06b6d4" strokeWidth="1.2" markerStart="url(#arrow-cyan)" markerEnd="url(#arrow-cyan)" />
                      <text x={rightX + 16} y={topY + (drawnTf / 2) + 3} fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">tf={tfMm}</text>

                      <text x={leftX + drawnTw + 8} y={cy} fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">tw={twMm}</text>

                      <rect x={10} y={10} width={280} height={22} rx={4} fill="#0f172a" stroke="#334155" strokeWidth="1" />
                      <text x={20} y={24} fill="#94a3b8" fontSize="9" fontWeight="bold" fontFamily="monospace">
                        CANAL LAMINADO UPN / C (ASTM A36 / DIN 1026)
                      </text>
                    </g>
                  );
                })()}

                {/* 3. RECTANGULAR / SQUARE TUBE (HSS) */}
                {shapeType === "tubo-rect" && (() => {
                  const maxDim = Math.max(hMm, bMm, 50);
                  const scale = 200 / maxDim;
                  const drawnH = hMm * scale;
                  const drawnB = bMm * scale;
                  const drawnT = Math.max(3, twMm * scale);

                  const cx = 150;
                  const cy = 140;
                  const leftX = cx - (drawnB / 2);
                  const topY = cy - (drawnH / 2);

                  return (
                    <g>
                      <rect x={leftX} y={topY} width={drawnB} height={drawnH} rx="8" fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" />
                      <rect x={leftX + drawnT} y={topY + drawnT} width={drawnB - (2 * drawnT)} height={drawnH - (2 * drawnT)} rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                      
                      <line x1={leftX} y1={topY - 14} x2={leftX + drawnB} y2={topY - 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={cx} y={topY - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">b = {bMm} mm</text>
                      <line x1={leftX - 16} y1={topY} x2={leftX - 16} y2={topY + drawnH} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={leftX - 22} y={cy} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${leftX - 22} ${cy})`} fontFamily="monospace">h = {hMm} mm</text>
                      <text x={cx} y={cy + 4} fill="#06b6d4" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">t = {twMm} mm</text>
                    </g>
                  );
                })()}

                {/* 4. PIPE / CIRCULAR TUBE */}
                {shapeType === "tubo-redondo" && (() => {
                  const scale = 180 / Math.max(diameterMm, 40);
                  const outerR = (diameterMm * scale) / 2;
                  const innerR = Math.max(4, outerR - (pipeThicknessMm * scale));
                  const cx = 150;
                  const cy = 140;

                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={outerR} fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" />
                      <circle cx={cx} cy={cy} r={innerR} fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                      
                      {/* Center axes */}
                      <line x1={cx - outerR - 10} y1={cy} x2={cx + outerR + 10} y2={cy} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
                      <line x1={cx} y1={cy - outerR - 10} x2={cx} y2={cy + outerR + 10} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />

                      <line x1={cx - outerR} y1={cy - outerR - 14} x2={cx + outerR} y2={cy - outerR - 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={cx} y={cy - outerR - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">OD = {diameterMm} mm</text>
                      <text x={cx} y={cy + 4} fill="#06b6d4" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">e = {pipeThicknessMm} mm</text>
                    </g>
                  );
                })()}

                {/* 5. ANGLE L */}
                {shapeType === "angulo-l" && (() => {
                  const maxDim = Math.max(hMm, bMm, 40);
                  const scale = 200 / maxDim;
                  const drawnH = hMm * scale;
                  const drawnB = bMm * scale;
                  const drawnT = Math.max(3, twMm * scale);

                  const leftX = 80;
                  const topY = 40;

                  return (
                    <g>
                      <path
                        d={`M ${leftX} ${topY} L ${leftX + drawnT} ${topY} L ${leftX + drawnT} ${topY + drawnH - drawnT} L ${leftX + drawnB} ${topY + drawnH - drawnT} L ${leftX + drawnB} ${topY + drawnH} L ${leftX} ${topY + drawnH} Z`}
                        fill="#1e293b"
                        stroke="#94a3b8"
                        strokeWidth="2.5"
                      />
                      <line x1={leftX} y1={topY + drawnH + 14} x2={leftX + drawnB} y2={topY + drawnH + 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={leftX + (drawnB / 2)} y={topY + drawnH + 28} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">b = {bMm} mm</text>
                      <line x1={leftX - 16} y1={topY} x2={leftX - 16} y2={topY + drawnH} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={leftX - 22} y={topY + (drawnH / 2)} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${leftX - 22} ${topY + (drawnH / 2)})`} fontFamily="monospace">h = {hMm} mm</text>
                      <text x={leftX + drawnT + 8} y={topY + 20} fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">t = {twMm} mm</text>
                    </g>
                  );
                })()}

                {/* 6. SOLID ROUND BAR */}
                {shapeType === "barra-redonda" && (() => {
                  const scale = 180 / Math.max(diameterMm, 20);
                  const r = (diameterMm * scale) / 2;
                  const cx = 150;
                  const cy = 140;

                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />
                      <line x1={cx - r - 10} y1={cy} x2={cx + r + 10} y2={cy} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
                      <line x1={cx} y1={cy - r - 10} x2={cx} y2={cy + r + 10} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
                      
                      <line x1={cx - r} y1={cy - r - 14} x2={cx + r} y2={cy - r - 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={cx} y={cy - r - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">Ø = {diameterMm} mm (Macizo)</text>
                      <text x={cx} y={cy + 4} fill="#06b6d4" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">Pernos / Barandas</text>
                    </g>
                  );
                })()}

                {/* 7. SOLID FLAT / SQUARE BAR */}
                {shapeType === "pletina-cuadrada" && (() => {
                  const maxDim = Math.max(hMm, bMm, 30);
                  const scale = 200 / maxDim;
                  const drawnH = hMm * scale;
                  const drawnB = bMm * scale;
                  const cx = 150;
                  const cy = 140;
                  const leftX = cx - (drawnB / 2);
                  const topY = cy - (drawnH / 2);

                  return (
                    <g>
                      <rect x={leftX} y={topY} width={drawnB} height={drawnH} fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />
                      <line x1={leftX} y1={topY - 14} x2={leftX + drawnB} y2={topY - 14} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={cx} y={topY - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">Ancho = {bMm} mm</text>
                      <line x1={leftX - 16} y1={topY} x2={leftX - 16} y2={topY + drawnH} stroke="#38bdf8" strokeWidth="1.2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text x={leftX - 22} y={cy} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${leftX - 22} ${cy})`} fontFamily="monospace">Espesor = {hMm} mm</text>
                    </g>
                  );
                })()}

                {/* 8. ELBOW BUTT-WELD (CODO 90° / 45°) */}
                {shapeType === "codo-fitting" && (() => {
                  return (
                    <g>
                      {/* Curved Elbow Profile */}
                      <path
                        d="M 60 220 A 130 130 0 0 1 190 90 L 220 90 A 160 160 0 0 0 60 250 Z"
                        fill="#1e293b"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                      />
                      {/* Center line */}
                      <path
                        d="M 60 235 A 145 145 0 0 1 205 90"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                      />
                      {/* Dimensions */}
                      <text x="140" y="70" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                        Codo Butt-Weld {elbowAngle}° (Sch 40)
                      </text>
                      <text x="140" y="85" fill="#06b6d4" fontSize="9" fontWeight="bold" fontFamily="monospace">
                        OD = {diameterMm} mm | t = {pipeThicknessMm} mm
                      </text>
                      <text x="60" y="270" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                        Radio R = 1.5 x D = {Math.round(diameterMm * 1.5)} mm
                      </text>
                    </g>
                  );
                })()}

              </svg>
            </div>

            {/* Calculated Mechanical Properties Card */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  <span>Propiedades Estructurales Calculadas:</span>
                </span>
                <span className="text-xs font-black text-sky-400 font-mono">
                  {isFitting ? `${unitWeightKg} kg/unidad` : `${calculatedProperties.weightKgM} kg/m`}
                </span>
              </div>

              {!isFitting ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Área de Sección:</span>
                    <span className="font-mono font-bold text-white">{calculatedProperties.areaCm2} cm²</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Inercia Eje X (Ix):</span>
                    <span className="font-mono font-bold text-sky-300">{calculatedProperties.ixCm4} cm⁴</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Inercia Eje Y (Iy):</span>
                    <span className="font-mono font-bold text-sky-300">{calculatedProperties.iyCm4} cm⁴</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Módulo Wx:</span>
                    <span className="font-mono font-bold text-slate-200">{calculatedProperties.wxCm3} cm³</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Módulo Wy:</span>
                    <span className="font-mono font-bold text-slate-200">{calculatedProperties.wyCm3} cm³</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Radio Giro (rx/ry):</span>
                    <span className="font-mono font-bold text-slate-200">{calculatedProperties.rxCm} / {calculatedProperties.ryCm} cm</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Radio de Curvatura (R):</span>
                    <span className="font-mono font-bold text-sky-300">{calculatedProperties.ixCm4} mm</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Centro a Extremo (C-F):</span>
                    <span className="font-mono font-bold text-sky-300">{calculatedProperties.iyCm4} mm</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Diámetro Exterior (OD):</span>
                    <span className="font-mono font-bold text-white">{calculatedProperties.areaCm2} mm</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Espesor Sch 40 (t):</span>
                    <span className="font-mono font-bold text-white">{calculatedProperties.wxCm3} mm</span>
                  </div>
                </div>
              )}
            </div>

            {/* Standard Bar Prices (6m / 12m) */}
            {!isFitting && (
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Precio Tira 6m:</div>
                  <div className="font-mono font-bold text-emerald-400 text-sm">
                    ${Math.round(calculatedProperties.weightKgM * 6 * pricePerKgCLP).toLocaleString("es-CL")} CLP
                  </div>
                  <div className="text-[10px] text-slate-500">{(calculatedProperties.weightKgM * 6).toFixed(1)} kg • ${pricePerKgCLP}/kg</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Precio Tira 12m:</div>
                  <div className="font-mono font-bold text-emerald-300 text-sm">
                    ${Math.round(calculatedProperties.weightKgM * 12 * pricePerKgCLP).toLocaleString("es-CL")} CLP
                  </div>
                  <div className="text-[10px] text-slate-500">{(calculatedProperties.weightKgM * 12).toFixed(1)} kg • ${pricePerKgCLP}/kg</div>
                </div>
              </div>
            )}

            {/* Total Batch Weight & Action Buttons */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">
                  {isFitting 
                    ? `Total ${quantity} unidad(es):` 
                    : `Total ${quantity} tira(s) de ${lengthMeters}m (${lengthMeters * quantity} m):`}
                </span>
                <span className="font-mono font-black text-sky-400 text-sm">
                  {totalWeightKg.toLocaleString("es-CL")} kg
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                <span className="text-emerald-300 font-bold">Precio Total Estimado ({quantity} un):</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  ${totalPriceCLP.toLocaleString("es-CL")} CLP
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleAddToProject}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Agregar a Proyecto</span>
              </button>

              <button
                type="button"
                onClick={handleSaveHistory}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4 text-sky-400" />
                <span>Guardar Ficha</span>
              </button>
            </div>

            {feedbackMsg && (
              <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold text-center animate-fade-in flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {feedbackMsg}
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
