import React, { useState } from "react";
import { 
  Calculator, 
  Search, 
  Layers, 
  PlusCircle, 
  Save, 
  Check, 
  ChevronRight, 
  Info,
  DollarSign,
  TrendingUp,
  Tag
} from "lucide-react";
import { ProfileCategory, ProfileDefinition, ProjectItem, CalculationHistoryItem } from "../../types";
import { STANDARD_CHILEAN_PROFILES } from "../../data/chileanSteelData";

interface LinearWeightCalculatorProps {
  onAddToProject: (item: Omit<ProjectItem, "id" | "dateAdded">) => void;
  onSaveToHistory: (item: Omit<CalculationHistoryItem, "id" | "timestamp">) => void;
  activeProjectName?: string;
  globalPriceKg?: number;
}

export const LinearWeightCalculator: React.FC<LinearWeightCalculatorProps> = ({
  onAddToProject,
  onSaveToHistory,
  activeProjectName,
  globalPriceKg = 1420
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ProfileCategory | "all">("all");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("hea-200");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Bar parameters
  const [lengthMeters, setLengthMeters] = useState<number>(6);
  const [quantity, setQuantity] = useState<number>(1);
  const [pricePerKgCLP, setPricePerKgCLP] = useState<number>(globalPriceKg);
  
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Filter profiles
  const filteredProfiles = STANDARD_CHILEAN_PROFILES.filter((p) => {
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch = 
      p.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.standard.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedProfile = STANDARD_CHILEAN_PROFILES.find((p) => p.id === selectedProfileId) || STANDARD_CHILEAN_PROFILES[0];

  // Calculations
  const isUnitItem = selectedProfile?.unit === "unidad" || selectedProfile?.category === "codo-fitting";
  const weightPerMeterKg = selectedProfile ? selectedProfile.weightPerMeterKg : 0;
  const barWeightKg = isUnitItem 
    ? (selectedProfile?.weightPerPieceKg || selectedProfile?.weightPerMeterKg || 1)
    : Number((weightPerMeterKg * lengthMeters).toFixed(2));
  const totalWeightKg = Number((barWeightKg * quantity).toFixed(2));
  
  const unitPriceCLP = isUnitItem && selectedProfile?.refPriceCLP
    ? selectedProfile.refPriceCLP
    : Math.round(barWeightKg * pricePerKgCLP);
  const totalPriceCLP = Math.round(unitPriceCLP * quantity);

  const categories: { id: ProfileCategory | "all"; label: string }[] = [
    { id: "all", label: "Todos los Perfiles" },
    { id: "viga-hea", label: "Vigas HEA (DIN 1025-3)" },
    { id: "viga-w", label: "Vigas W (AISC / ASTM A6)" },
    { id: "viga-in", label: "Vigas IN (ICHA)" },
    { id: "viga-hn", label: "Vigas HN (ICHA Columnas)" },
    { id: "viga-ipe", label: "Vigas IPE / IPN" },
    { id: "canal-upn", label: "Canales UPN" },
    { id: "costanera-c", label: "Costaneras C (Cintac)" },
    { id: "costanera-z", label: "Costaneras Z (Cintac)" },
    { id: "tubo-cuadrado", label: "Tubos Cuadrados" },
    { id: "tubo-rectangular", label: "Tubos Rectangulares" },
    { id: "tubo-redondo", label: "Cañerías / Tubos Redondos" },
    { id: "angulo-l", label: "Ángulos L Laminados" },
    { id: "barra-redonda-lisa", label: "Barras Lisas (Pernos / Barandas)" },
    { id: "barra-redonda", label: "Fierro Estriado (NCh 204)" },
    { id: "barra-cuadrada", label: "Barras Cuadradas Macizas" },
    { id: "pletina", label: "Pletinas Laminadas" },
    { id: "codo-fitting", label: "Codos & Fittings (Butt-Weld)" },
    { id: "malla-acma", label: "Mallas Acma" },
  ];

  const handleAddToProject = () => {
    if (!selectedProfile) return;

    const dimText = isUnitItem
      ? `Fittings / Codo Ø ${selectedProfile.dimensions?.diameter || 0}mm | Peso unit: ${barWeightKg} kg`
      : `Largo: ${lengthMeters} m | Peso: ${weightPerMeterKg} kg/m`;

    onAddToProject({
      type: "perfil",
      description: selectedProfile.designation,
      profileName: selectedProfile.designation,
      dimensions: dimText,
      quantity,
      lengthM: isUnitItem ? undefined : lengthMeters,
      unitWeightKg: barWeightKg,
      totalWeightKg: totalWeightKg,
      unitPriceCLP: unitPriceCLP,
      totalPriceCLP: totalPriceCLP,
      notes: `${selectedProfile.standard} | ${isUnitItem ? `${quantity} unidad(es)` : `Total: ${lengthMeters * quantity} m`}`
    });

    setFeedbackMsg("¡Perfil agregado al proyecto!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSaveHistory = () => {
    if (!selectedProfile) return;

    const summaryText = isUnitItem
      ? `${quantity} unidad(es) de ${selectedProfile.designation} = ${totalWeightKg} kg ($${totalPriceCLP.toLocaleString("es-CL")} CLP)`
      : `${quantity} barra(s) de ${lengthMeters}m = ${totalWeightKg} kg ($${totalPriceCLP.toLocaleString("es-CL")} CLP)`;

    onSaveToHistory({
      category: "perfil",
      title: `${selectedProfile.designation} (${isUnitItem ? `${quantity} un.` : `${lengthMeters}m x ${quantity} pzas`})`,
      summary: summaryText,
      details: {
        profileId: selectedProfile.id,
        designation: selectedProfile.designation,
        weightPerMeterKg,
        lengthMeters: isUnitItem ? 0 : lengthMeters,
        quantity,
        barWeightKg,
        totalWeightKg,
        pricePerKgCLP,
        totalPriceCLP
      },
      weightKg: totalWeightKg,
      priceCLP: totalPriceCLP,
      tags: ["Perfil", selectedProfile.category, isUnitItem ? "Fitting" : `${weightPerMeterKg} kg/m`]
    });

    setFeedbackMsg("¡Cálculo guardado en el historial!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                Calculadora de Peso Lineal & Vigas HEA
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Norma Chilena & Europea (HEA, W, IN, IPE, Costaneras y Tubos). Desglose por metro, tira de 6m y 12m.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Left Column: Filter & Profile Selection */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Category Filter Badges */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Familias de Perfiles
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {filteredProfiles.length} perfiles
              </span>
            </div>

            {/* Scrollable category chips */}
            <div className="flex flex-wrap gap-1.5 max-h-32 sm:max-h-36 overflow-y-auto pr-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-sm"
                      : "bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative pt-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por HEA, W, IN, IPE, tubo, costanera o medida..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* Profile List Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2.5 uppercase tracking-wider">
              <span className="text-sky-400">Catálogo de Perfiles:</span>
              <span className="text-[11px] text-slate-400 font-normal normal-case font-mono">
                ${pricePerKgCLP.toLocaleString("es-CL")}/kg
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 sm:max-h-96 overflow-y-auto pr-1">
              {filteredProfiles.map((p) => {
                const isSelected = selectedProfile?.id === p.id;
                const isUnit = p.unit === "unidad" || p.category === "codo-fitting";
                const weight6m = Number((p.weightPerMeterKg * 6).toFixed(1));
                const weight12m = Number((p.weightPerMeterKg * 12).toFixed(1));
                const price6m = isUnit && p.refPriceCLP ? p.refPriceCLP : Math.round(weight6m * pricePerKgCLP);
                const price12m = isUnit && p.refPriceCLP ? p.refPriceCLP * 2 : Math.round(weight12m * pricePerKgCLP);
                
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProfileId(p.id);
                      setLengthMeters(p.standardLengthM || 6);
                    }}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/10 border-sky-500 text-white shadow-md ring-2 ring-sky-500/40"
                        : "bg-slate-950/70 border-slate-800/90 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-bold text-xs text-white truncate max-w-[170px]">
                        {p.designation}
                      </span>
                      <span className="font-mono text-xs font-black text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                        {p.weightPerMeterKg} kg/m
                      </span>
                    </div>
                    
                    {/* Price breakdown badges */}
                    <div className="grid grid-cols-2 gap-1.5 mt-2 pt-1.5 border-t border-slate-800 text-[10px]">
                      <div className="bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Tira 6m:</span>
                        <span className="font-mono font-bold text-emerald-400">${price6m.toLocaleString("es-CL")}</span>
                      </div>
                      {!isUnit && (
                        <div className="bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400">Tira 12m:</span>
                          <span className="font-mono font-bold text-emerald-300">${price12m.toLocaleString("es-CL")}</span>
                        </div>
                      )}
                      {isUnit && (
                        <div className="bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400">Unidad:</span>
                          <span className="font-mono font-bold text-emerald-300">${(p.refPriceCLP || 0).toLocaleString("es-CL")}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5">
                      <span className="truncate max-w-[140px] text-slate-500">{p.standard}</span>
                      <span className="text-sky-400/80 font-mono">${pricePerKgCLP}/kg</span>
                    </div>
                  </button>
                );
              })}

              {filteredProfiles.length === 0 && (
                <div className="col-span-2 text-center py-8 text-xs text-slate-400">
                  No se encontraron perfiles para la búsqueda seleccionada.
                </div>
              )}
            </div>
          </div>

          {/* Length & Quantity Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Largo de Barra (Metros)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={lengthMeters}
                    onChange={(e) => setLengthMeters(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">m</span>
                </div>
                <div className="flex gap-1 mt-1.5">
                  {[3, 6, 9, 12].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLengthMeters(l)}
                      className={`px-2 py-0.5 text-[10px] rounded border transition-colors cursor-pointer ${
                        lengthMeters === l
                          ? "bg-sky-500 text-slate-950 font-bold border-sky-400"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {l}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Cantidad de Piezas / Tiras
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-10 px-3.5 bg-slate-950 hover:bg-slate-800 text-white rounded-l-lg border border-slate-800 font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-10 bg-slate-950 border-y border-slate-800 text-center py-2 text-white font-mono text-sm focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="h-10 px-3.5 bg-slate-950 hover:bg-slate-800 text-white rounded-r-lg border border-slate-800 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Precio Base ($ CLP / kg)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    value={pricePerKgCLP}
                    onChange={(e) => setPricePerKgCLP(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Calculations & Profile Details */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Main Calculation Card */}
          <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            
            <div className="border-b border-slate-800 pb-3">
              <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider block">
                Perfil Seleccionado
              </span>
              <h3 className="text-lg font-bold text-white leading-tight mt-0.5">
                {selectedProfile?.designation}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedProfile?.standard}
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">
                  Peso Lineal
                </span>
                <span className="text-2xl font-black text-sky-400 font-mono">
                  {weightPerMeterKg}
                </span>
                <span className="text-xs text-slate-400 font-bold ml-1">kg/m</span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">
                  Peso 1 Tira ({lengthMeters}m)
                </span>
                <span className="text-2xl font-black text-white font-mono">
                  {barWeightKg.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-400 font-bold ml-1">kg</span>
              </div>
            </div>

            {/* Standard Commercial Bar Prices Breakdown (6m and 12m) */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                <span>Precios Estándar de Barra:</span>
                <span className="text-slate-400 font-mono font-normal">Base: ${pricePerKgCLP}/kg</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* 6m Bar */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/90 space-y-1">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-bold">Barra 6 Metros:</span>
                    <span className="text-[10px] text-slate-400">{(weightPerMeterKg * 6).toFixed(1)} kg</span>
                  </div>
                  <div className="text-base font-black text-emerald-400 font-mono">
                    ${Math.round(weightPerMeterKg * 6 * pricePerKgCLP).toLocaleString("es-CL")} CLP
                  </div>
                  <div className="text-[10px] text-slate-500">
                    ${pricePerKgCLP.toLocaleString("es-CL")} / kg
                  </div>
                </div>

                {/* 12m Bar */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/90 space-y-1">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-bold">Barra 12 Metros:</span>
                    <span className="text-[10px] text-slate-400">{(weightPerMeterKg * 12).toFixed(1)} kg</span>
                  </div>
                  <div className="text-base font-black text-emerald-300 font-mono">
                    ${Math.round(weightPerMeterKg * 12 * pricePerKgCLP).toLocaleString("es-CL")} CLP
                  </div>
                  <div className="text-[10px] text-slate-500">
                    ${pricePerKgCLP.toLocaleString("es-CL")} / kg
                  </div>
                </div>
              </div>
            </div>

            {/* Total Batch Weight & Price */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-sky-500/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-300 font-medium">
                  Total {quantity} barra{quantity > 1 ? "s" : ""} de {lengthMeters}m ({lengthMeters * quantity} m lineales):
                </span>
                <span className="text-lg font-black text-sky-400 font-mono">
                  {totalWeightKg.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-xs text-emerald-300 font-bold">
                  Precio Total Estimado ({quantity} un):
                </span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  ${totalPriceCLP.toLocaleString("es-CL")} CLP
                </span>
              </div>
            </div>

            {/* Dimensions Summary List */}
            {selectedProfile && selectedProfile.dimensions && (
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Cotas y Dimensiones Nominales:
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300 font-mono text-[11px]">
                  {selectedProfile.dimensions.h && (
                    <div>Alto (h): <span className="text-white font-bold">{selectedProfile.dimensions.h} mm</span></div>
                  )}
                  {selectedProfile.dimensions.b && (
                    <div>Ancho ala (b): <span className="text-white font-bold">{selectedProfile.dimensions.b} mm</span></div>
                  )}
                  {selectedProfile.dimensions.tw && (
                    <div>Espesor alma (tw): <span className="text-white font-bold">{selectedProfile.dimensions.tw} mm</span></div>
                  )}
                  {selectedProfile.dimensions.tf && (
                    <div>Espesor ala (tf): <span className="text-white font-bold">{selectedProfile.dimensions.tf} mm</span></div>
                  )}
                  {selectedProfile.dimensions.t && (
                    <div>Espesor (t): <span className="text-white font-bold">{selectedProfile.dimensions.t} mm</span></div>
                  )}
                  {selectedProfile.dimensions.side && (
                    <div>Lado: <span className="text-white font-bold">{selectedProfile.dimensions.side} mm</span></div>
                  )}
                  {selectedProfile.dimensions.diameter && (
                    <div>Diámetro: <span className="text-white font-bold">{selectedProfile.dimensions.diameter} mm</span></div>
                  )}
                  {selectedProfile.dimensions.c && (
                    <div>Pestaña (c): <span className="text-white font-bold">{selectedProfile.dimensions.c} mm</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddToProject}
                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Agregar a Proyecto</span>
              </button>

              <button
                type="button"
                onClick={handleSaveHistory}
                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
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

        </div>

      </div>

    </div>
  );
};
