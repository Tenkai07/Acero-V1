import React, { useState } from "react";
import { 
  FoldHorizontal, 
  Layers, 
  PlusCircle, 
  Save, 
  Info, 
  Check, 
  Sparkles, 
  Scissors, 
  Maximize2, 
  ArrowDownUp, 
  Settings2 
} from "lucide-react";
import { calculateChannelFolding } from "../../utils/steelCalculations";
import { STANDARD_GAUGES_MSG } from "../../data/chileanSteelData";

interface ChannelFoldingCalculatorProps {
  onAddToProject: (item: {
    type: "plegado";
    description: string;
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
    category: "plegado";
    title: string;
    summary: string;
    details: Record<string, any>;
    weightKg: number;
    priceCLP: number;
    tags: string[];
  }) => void;
}

export const ChannelFoldingCalculator: React.FC<ChannelFoldingCalculatorProps> = ({
  onAddToProject,
  onSaveToHistory
}) => {
  const [profileType, setProfileType] = useState<"canal-u" | "canal-c-atiesada" | "perfil-z" | "angulo">("canal-u");
  
  // Dimensions
  const [webHeightH, setWebHeightH] = useState<number>(150); // Alma exterior
  const [flangeWidthB, setFlangeWidthB] = useState<number>(50); // Ala exterior
  const [lipWidthC, setLipWidthC] = useState<number>(15); // Pestaña atiesadora
  const [thicknessMm, setThicknessMm] = useState<number>(2.0); // Espesor e
  const [lengthMm, setLengthMm] = useState<number>(3000); // Largo
  const [quantity, setQuantity] = useState<number>(1);
  const [density, setDensity] = useState<number>(8.0);
  const [pricePerKgCLP, setPricePerKgCLP] = useState<number>(1450);

  // Press brake tooling / Bending params
  const [innerRadiusMm, setInnerRadiusMm] = useState<number>(2.5);
  const [kFactor, setKFactor] = useState<number>(0.42);
  const [showAdvancedBending, setShowAdvancedBending] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Auto-adjust default inner radius when thickness changes
  const handleThicknessChange = (t: number) => {
    setThicknessMm(t);
    setInnerRadiusMm(Number((t * 1.25).toFixed(1)));
  };

  const results = calculateChannelFolding({
    type: profileType,
    thicknessMm,
    innerRadiusMm,
    kFactor,
    webHeightH,
    flangeWidthB,
    lipWidthC: profileType === "canal-c-atiesada" ? lipWidthC : 0,
    lengthMm,
    quantity,
    density
  });

  const unitWeightKg = Number(((results.weightPerMeterKg * lengthMm) / 1000).toFixed(2));
  const unitPriceCLP = Math.round(unitWeightKg * pricePerKgCLP);
  const totalPriceCLP = Math.round(results.totalWeightKg * pricePerKgCLP);

  const handleAddToProject = () => {
    const typeLabel = 
      profileType === "canal-u" ? `Canal U Plegada ${webHeightH}x${flangeWidthB}x${thicknessMm}mm` :
      profileType === "canal-c-atiesada" ? `Costanera C ${webHeightH}x${flangeWidthB}x${lipWidthC}x${thicknessMm}mm` :
      profileType === "perfil-z" ? `Perfil Z Plegado ${webHeightH}x${flangeWidthB}x${thicknessMm}mm` :
      `Ángulo Plegado ${webHeightH}x${flangeWidthB}x${thicknessMm}mm`;

    onAddToProject({
      type: "plegado",
      description: typeLabel,
      dimensions: `Desarrollo: ${results.developedWidthMm} mm x Largo: ${lengthMm} mm (e=${thicknessMm}mm)`,
      quantity,
      lengthM: lengthMm / 1000,
      unitWeightKg,
      totalWeightKg: results.totalWeightKg,
      unitPriceCLP,
      totalPriceCLP,
      notes: `Deducción por pliegue BD: ${results.bendDeductionMm} mm | R_int: ${innerRadiusMm} mm | K: ${kFactor}`
    });

    setFeedbackMsg("¡Perfil plegado agregado al proyecto!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSaveHistory = () => {
    const typeLabel = 
      profileType === "canal-u" ? `Canal U ${webHeightH}x${flangeWidthB}x${thicknessMm}` :
      profileType === "canal-c-atiesada" ? `Canal C ${webHeightH}x${flangeWidthB}x${lipWidthC}x${thicknessMm}` :
      `Perfil Plegado ${webHeightH}x${flangeWidthB}x${thicknessMm}`;

    onSaveToHistory({
      category: "plegado",
      title: `${typeLabel} (Desarrollo: ${results.developedWidthMm}mm)`,
      summary: `${quantity} pza(s) de L=${lengthMm}mm. Plancha plana: ${results.developedWidthMm} x ${lengthMm} mm = ${results.totalWeightKg} kg`,
      details: {
        profileType,
        webHeightH,
        flangeWidthB,
        lipWidthC,
        thicknessMm,
        innerRadiusMm,
        kFactor,
        developedWidthMm: results.developedWidthMm,
        bendDeductionMm: results.bendDeductionMm,
        bendAllowanceMm: results.bendAllowanceMm,
        totalWeightKg: results.totalWeightKg,
        weightPerMeterKg: results.weightPerMeterKg,
        lengthMm,
        quantity,
        totalPriceCLP
      },
      weightKg: results.totalWeightKg,
      priceCLP: totalPriceCLP,
      tags: ["Plegado", profileType, `Desarrollo ${results.developedWidthMm}mm`]
    });

    setFeedbackMsg("¡Cálculo de plegado guardado en historial!");
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-800 dark:bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <FoldHorizontal className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Calculadora de Desarrollo de Plegado (Blank Size para Canales)
              </h2>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Calcula el ancho exacto que debe tener la plancha plana antes de pasar por la plegadora, considerando la <strong>deformación y deducción en las zonas de curvatura (Bend Deduction)</strong>.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Geometric & Tooling Inputs */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Profile Geometry Type */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              1. Geometría del Perfil a Plegar
            </label>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "canal-u", label: "Canal U (3 caras)", desc: "Ala + Alma + Ala" },
                { id: "canal-c-atiesada", label: "Canal C Atiesada", desc: "5 caras con pestaña" },
                { id: "perfil-z", label: "Perfil Z", desc: "Alas opuestas" },
                { id: "angulo", label: "Ángulo L", desc: "2 caras (90°)" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setProfileType(t.id as any)}
                  className={`p-2.5 rounded-lg text-xs font-medium border text-left transition-all cursor-pointer ${
                    profileType === t.id
                      ? "bg-sky-500 text-slate-950 border-sky-400 font-bold shadow"
                      : "bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  <div className="font-bold">{t.label}</div>
                  <div className={`text-[10px] mt-0.5 ${profileType === t.id ? "text-slate-900" : "text-slate-400"}`}>
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Exterior Dimensions Inputs */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-4">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              2. Medidas Exteriores Finales (Cotas Terminadas)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Web Height H */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Alto del Alma (H)
                  </label>
                  <span className="text-[10px] text-sky-400">Exterior</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    value={webHeightH}
                    onChange={(e) => setWebHeightH(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">mm</span>
                </div>
              </div>

              {/* Flange Width B */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Ancho de Alas (B)
                  </label>
                  <span className="text-[10px] text-sky-400">Exterior</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    value={flangeWidthB}
                    onChange={(e) => setFlangeWidthB(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">mm</span>
                </div>
              </div>

              {/* Lip Width C (if applicable) */}
              {profileType === "canal-c-atiesada" && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      Pestaña Atiesador (C)
                    </label>
                    <span className="text-[10px] text-sky-400">Exterior</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      value={lipWidthC}
                      onChange={(e) => setLipWidthC(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-500">mm</span>
                  </div>
                </div>
              )}

              {/* Thickness e */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Espesor Plancha (e)
                  </label>
                  <span className="text-[10px] text-sky-400 font-mono">{thicknessMm} mm</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    step="0.1"
                    value={thicknessMm}
                    onChange={(e) => handleThicknessChange(parseFloat(e.target.value) || 0.5)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">mm</span>
                </div>
              </div>
            </div>

            {/* Quick Gauges */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">Espesores comunes:</span>
              {[1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleThicknessChange(t)}
                  className={`px-2 py-1 text-[11px] rounded border font-mono transition-colors cursor-pointer ${
                    thicknessMm === t
                      ? "bg-sky-500 text-slate-950 font-bold border-sky-400"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-700"
                  }`}
                >
                  {t}mm
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Bending Tooling & Press Parameters */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvancedBending(!showAdvancedBending)}
              className="flex items-center justify-between w-full text-xs font-bold text-slate-300 uppercase tracking-wider hover:text-sky-400 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-sky-400" />
                <span>3. Parámetros de Matriz y Plegadora (K-Factor y Radio Ri)</span>
              </div>
              <span className="text-[11px] text-sky-400 font-normal lowercase">
                {showAdvancedBending ? "ocultar" : "ver ajustes avanzados"}
              </span>
            </button>

            {showAdvancedBending && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Radio Interior de Doblado (Ri en mm)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={innerRadiusMm}
                    onChange={(e) => setInnerRadiusMm(parseFloat(e.target.value) || 0.1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Normalmente Ri ≈ 1.0 a 1.5 veces el espesor para acero A270ES.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Factor K (Eje Neutro de Doblado)
                  </label>
                  <input
                    type="number"
                    min="0.2"
                    max="0.5"
                    step="0.01"
                    value={kFactor}
                    onChange={(e) => setKFactor(parseFloat(e.target.value) || 0.42)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Estándar en maestranzas chilenas: K = 0.40 a 0.44 para plegado al aire.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Length, Quantity & Price */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Largo de la Tira (mm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={lengthMm}
                    onChange={(e) => setLengthMm(parseFloat(e.target.value) || 1000)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">mm</span>
                </div>
                <div className="flex gap-1 mt-1.5">
                  {[2000, 2400, 3000, 6000].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLengthMm(l)}
                      className="px-2 py-1 text-[10px] bg-slate-900 text-slate-400 hover:text-white rounded border border-slate-800 font-mono transition-colors cursor-pointer"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Cantidad de Canales
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-l-lg border border-slate-700 font-bold cursor-pointer"
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
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-r-lg border border-slate-700 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Precio Referencial ($ CLP/kg)
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
            </div>
          </div>

        </div>

        {/* Right Column: Blank Size Result, Schematics & Nesting */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Main Blank Development Card */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-sky-500/40 rounded-2xl p-5 shadow-xl space-y-4">
            
            <div className="border-b border-slate-700 pb-3">
              <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider block">
                Resultado de Desarrollo de Plancha Plana (Blank Size)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-sky-400 font-mono">
                  {results.developedWidthMm}
                </span>
                <span className="text-sm font-bold text-white">mm de Ancho Plano</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Medida de corte de plancha: <strong>{results.developedWidthMm} mm x {lengthMm} mm</strong>
              </p>
            </div>

            {/* Bending Physics Detail */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Deducción por Pliegue (BD):</span>
                <span className="font-mono font-bold text-sky-300">
                  {results.bendDeductionMm} mm / pliegue
                </span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Tolerancia de Arco (BA):</span>
                <span className="font-mono font-bold text-slate-200">
                  {results.bendAllowanceMm} mm
                </span>
              </div>
            </div>

            {/* Weight & Price Metrics */}
            <div className="bg-slate-950/90 p-3.5 rounded-xl border border-sky-500/30 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Peso por metro lineal:</span>
                <span className="font-mono font-bold text-white">{results.weightPerMeterKg} kg/m</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Peso 1 tira ({lengthMm}mm):</span>
                <span className="font-mono font-bold text-white">{unitWeightKg} kg</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                <span className="text-sky-300 font-bold">Peso Total ({quantity} piezas):</span>
                <span className="font-mono font-bold text-sky-400 text-sm">
                  {results.totalWeightKg.toLocaleString("es-CL")} kg
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                <span className="text-emerald-300 font-bold">Precio Total Estimado:</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  ${totalPriceCLP.toLocaleString("es-CL")} CLP
                </span>
              </div>
            </div>

            {/* Visual 2D Drawing: Flat Plate with Bending Lines & Folded Cross-Section */}
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Croquis de Fabricación en Taller
                </span>
              </div>

              {/* Folded Cross Section SVG */}
              <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800 flex flex-col items-center">
                <span className="text-[9px] text-slate-500 font-semibold mb-1">
                  1. Sección Doblada Terminada (Cotas Exteriores)
                </span>
                
                <svg className="w-full h-24" viewBox="0 0 200 90">
                  {profileType === "canal-u" && (
                    <g stroke="#38bdf8" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      {/* Left flange */}
                      <line x1="60" y1="20" x2="60" y2="70" />
                      {/* Web */}
                      <line x1="60" y1="70" x2="140" y2="70" />
                      {/* Right flange */}
                      <line x1="140" y1="70" x2="140" y2="20" />
                      
                      {/* Annotations */}
                      <text x="100" y="85" fill="#e2e8f0" fontSize="8" textAnchor="middle" fontFamily="monospace">
                        H = {webHeightH} mm
                      </text>
                      <text x="45" y="45" fill="#e2e8f0" fontSize="8" textAnchor="middle" fontFamily="monospace">
                        B={flangeWidthB}
                      </text>
                      <text x="155" y="45" fill="#e2e8f0" fontSize="8" textAnchor="middle" fontFamily="monospace">
                        B={flangeWidthB}
                      </text>
                    </g>
                  )}

                  {profileType === "canal-c-atiesada" && (
                    <g stroke="#38bdf8" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      {/* Left lip */}
                      <line x1="75" y1="20" x2="60" y2="20" />
                      {/* Left flange */}
                      <line x1="60" y1="20" x2="60" y2="70" />
                      {/* Web */}
                      <line x1="60" y1="70" x2="140" y2="70" />
                      {/* Right flange */}
                      <line x1="140" y1="70" x2="140" y2="20" />
                      {/* Right lip */}
                      <line x1="140" y1="20" x2="125" y2="20" />

                      <text x="100" y="84" fill="#e2e8f0" fontSize="8" textAnchor="middle" fontFamily="monospace">
                        H = {webHeightH} mm
                      </text>
                      <text x="44" y="48" fill="#e2e8f0" fontSize="8" textAnchor="middle" fontFamily="monospace">
                        B={flangeWidthB}
                      </text>
                      <text x="100" y="16" fill="#38bdf8" fontSize="7.5" textAnchor="middle" fontFamily="monospace">
                        Pestaña C = {lipWidthC} mm
                      </text>
                    </g>
                  )}

                  {profileType === "perfil-z" && (
                    <g stroke="#38bdf8" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="50" y1="20" x2="90" y2="20" />
                      <line x1="90" y1="20" x2="90" y2="70" />
                      <line x1="90" y1="70" x2="130" y2="70" />
                      <text x="110" y="45" fill="#e2e8f0" fontSize="8" fontFamily="monospace">H={webHeightH}</text>
                    </g>
                  )}

                  {profileType === "angulo" && (
                    <g stroke="#38bdf8" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="70" y1="20" x2="70" y2="70" />
                      <line x1="70" y1="70" x2="130" y2="70" />
                      <text x="50" y="45" fill="#e2e8f0" fontSize="8" fontFamily="monospace">{webHeightH}</text>
                      <text x="100" y="85" fill="#e2e8f0" fontSize="8" fontFamily="monospace">{flangeWidthB}</text>
                    </g>
                  )}
                </svg>
              </div>

              {/* Unfolded Flat Sheet SVG with Bending Lines */}
              <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800">
                <span className="text-[9px] text-slate-500 font-semibold block mb-1">
                  2. Plancha Desplegada (Líneas de Plegado en Punteado):
                </span>
                
                <div className="relative border-2 border-dashed border-sky-400/80 bg-sky-500/10 rounded p-2 text-center">
                  <div className="text-xs font-mono font-bold text-sky-300">
                    Ancho de Corte Plano = {results.developedWidthMm} mm
                  </div>
                  
                  {/* Bending lines indication */}
                  <div className="text-[10px] text-slate-400 mt-1">
                    {results.stepBendLocations.length} línea(s) de doblado desde el borde:
                    <span className="text-white font-mono font-semibold ml-1">
                      {results.stepBendLocations.map(loc => `${loc} mm`).join(" | ")}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Chilean Standard Sheets Nesting Optimizer */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center gap-1 font-bold text-slate-300">
                <Scissors className="w-3.5 h-3.5 text-sky-400" />
                <span>Optimización en Planchas Comerciales en Chile:</span>
              </div>
              
              <div className="space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between py-0.5 border-b border-slate-800">
                  <span>En Plancha 1000 x 3000 mm:</span>
                  <span className="font-mono text-white">
                    <strong>{results.cutsPerStandardSheet.sheet1000x3000.cuts} tiras</strong> (Despunte: {results.cutsPerStandardSheet.sheet1000x3000.scrapMm} mm / {results.cutsPerStandardSheet.sheet1000x3000.scrapPercent}%)
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800">
                  <span>En Plancha 1500 x 3000 mm:</span>
                  <span className="font-mono text-white">
                    <strong>{results.cutsPerStandardSheet.sheet1500x3000.cuts} tiras</strong> (Despunte: {results.cutsPerStandardSheet.sheet1500x3000.scrapMm} mm / {results.cutsPerStandardSheet.sheet1500x3000.scrapPercent}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
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
