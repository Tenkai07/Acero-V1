import React, { useState } from "react";
import { 
  ArrowRightLeft, 
  Ruler, 
  Scale, 
  Layers, 
  Copy, 
  Check, 
  Info, 
  Zap 
} from "lucide-react";
import { STANDARD_GAUGES_MSG } from "../../data/chileanSteelData";
import { decimalToFractionInch } from "../../utils/steelCalculations";

export const UnitConverter: React.FC = () => {
  const [activeConverterTab, setActiveConverterTab] = useState<"length" | "gauges" | "weight" | "linear-density" | "stress">("length");

  // Length conversion state
  const [lengthValue, setLengthValue] = useState<number>(100);
  const [lengthFrom, setLengthFrom] = useState<string>("mm");

  // Fraction builder state
  const [fractionWhole, setFractionWhole] = useState<number>(1);
  const [fractionNum, setFractionNum] = useState<number>(1);
  const [fractionDen, setFractionDen] = useState<number>(2);

  // Weight conversion state
  const [weightValue, setWeightValue] = useState<number>(1000);
  const [weightFrom, setWeightFrom] = useState<string>("kg");

  // Linear density state (kg/m <-> lbs/ft)
  const [linearVal, setLinearVal] = useState<number>(30); // e.g. W10x30
  const [linearFrom, setLinearFrom] = useState<"lbs_ft" | "kg_m">("lbs_ft");

  // Stress state (MPa <-> ksi)
  const [stressVal, setStressVal] = useState<number>(36); // e.g. A36
  const [stressFrom, setStressFrom] = useState<"ksi" | "mpa">("ksi");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Convert length to base mm
  let baseMm = 0;
  switch (lengthFrom) {
    case "mm": baseMm = lengthValue; break;
    case "cm": baseMm = lengthValue * 10; break;
    case "m": baseMm = lengthValue * 1000; break;
    case "pulgadas": baseMm = lengthValue * 25.4; break;
    case "pies": baseMm = lengthValue * 304.8; break;
    case "yardas": baseMm = lengthValue * 914.4; break;
    default: baseMm = lengthValue;
  }

  const lengthResults = {
    mm: Number(baseMm.toFixed(3)),
    cm: Number((baseMm / 10).toFixed(3)),
    m: Number((baseMm / 1000).toFixed(4)),
    inchesDec: Number((baseMm / 25.4).toFixed(4)),
    inchesFrac: decimalToFractionInch(baseMm / 25.4),
    feet: Number((baseMm / 304.8).toFixed(4)),
    feetInches: `${Math.floor(baseMm / 304.8)}' ${((baseMm % 304.8) / 25.4).toFixed(2)}"`
  };

  // Fraction builder calculation
  const fractionTotalInches = fractionWhole + (fractionNum / (fractionDen || 1));
  const fractionTotalMm = fractionTotalInches * 25.4;

  // Weight conversion results
  let baseKg = 0;
  switch (weightFrom) {
    case "kg": baseKg = weightValue; break;
    case "lbs": baseKg = weightValue / 2.20462; break;
    case "ton": baseKg = weightValue * 1000; break;
    default: baseKg = weightValue;
  }

  const weightResults = {
    kg: Number(baseKg.toFixed(2)),
    lbs: Number((baseKg * 2.20462).toFixed(2)),
    ton: Number((baseKg / 1000).toFixed(4)),
    quintales: Number((baseKg / 100).toFixed(2)) // Quintal métrico 100 kg
  };

  // Linear density result
  const linearResult = linearFrom === "lbs_ft"
    ? { kg_m: Number((linearVal * 1.48816).toFixed(2)), lbs_ft: linearVal }
    : { lbs_ft: Number((linearVal / 1.48816).toFixed(2)), kg_m: linearVal };

  // Stress result
  const stressResult = stressFrom === "ksi"
    ? { mpa: Number((stressVal * 6.89476).toFixed(1)), kgf_cm2: Number((stressVal * 70.307).toFixed(1)), ksi: stressVal }
    : { ksi: Number((stressVal / 6.89476).toFixed(2)), kgf_cm2: Number((stressVal * 10.197).toFixed(1)), mpa: stressVal };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-800 dark:bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <ArrowRightLeft className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Conversor de Medidas Metalúrgicas & Estructurales
              </h2>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Conversión de <strong>pies, milímetros, pulgadas (decimales y fracciones de maestranza), calibres MSG, kilos y libras</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tabs selector */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar gap-1">
        {[
          { id: "length", label: "Longitud & Fracciones", icon: Ruler },
          { id: "gauges", label: "Tabla de Calibres MSG", icon: Layers },
          { id: "linear-density", label: "Vigas AISC (lbs/ft ⇄ kg/m)", icon: Zap },
          { id: "weight", label: "Masa & Peso (kg ⇄ lbs)", icon: Scale },
          { id: "stress", label: "Tensión (MPa ⇄ ksi)", icon: ArrowRightLeft },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeConverterTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveConverterTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-sky-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Length & Fractions */}
      {activeConverterTab === "length" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Direct Value Input */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Entrada de Valor Directo
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Valor a Convertir
                  </label>
                  <input
                    type="number"
                    value={lengthValue}
                    onChange={(e) => setLengthValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white font-mono text-base focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Unidad Origen
                  </label>
                  <select
                    value={lengthFrom}
                    onChange={(e) => setLengthFrom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  >
                    <option value="mm">Milímetros (mm)</option>
                    <option value="pulgadas">Pulgadas (")</option>
                    <option value="pies">Pies (ft / ')</option>
                    <option value="cm">Centímetros (cm)</option>
                    <option value="m">Metros (m)</option>
                  </select>
                </div>
              </div>

              {/* Converted Results Grid */}
              <div className="pt-2 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Resultados Equivalentes:
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Milímetros (mm)", value: `${lengthResults.mm} mm`, key: "mm" },
                    { label: "Pulgadas Fracción", value: lengthResults.inchesFrac, key: "frac" },
                    { label: "Pulgadas Decimal", value: `${lengthResults.inchesDec}"`, key: "inDec" },
                    { label: "Pies (ft)", value: `${lengthResults.feet} ft (${lengthResults.feetInches})`, key: "ft" },
                    { label: "Centímetros (cm)", value: `${lengthResults.cm} cm`, key: "cm" },
                    { label: "Metros (m)", value: `${lengthResults.m} m`, key: "m" },
                  ].map((res) => (
                    <div
                      key={res.key}
                      onClick={() => copyToClipboard(res.value, res.key)}
                      className="bg-slate-950 p-3 rounded-lg border border-slate-800 hover:border-sky-500/50 cursor-pointer transition-colors group relative"
                    >
                      <span className="text-[10px] text-slate-400 block">{res.label}</span>
                      <span className="text-sm font-bold text-sky-300 font-mono block mt-0.5">
                        {res.value}
                      </span>
                      <span className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-slate-400">
                        {copiedKey === res.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fractional Inch Builder for Workshop */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>2. Constructor de Pulgadas Fraccionarias</span>
                <span className="text-xs text-sky-400 font-normal lowercase">típico en maestranza</span>
              </h3>

              <div className="grid grid-cols-3 gap-3 items-center">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Entero (Pulgadas)</label>
                  <input
                    type="number"
                    min="0"
                    value={fractionWhole}
                    onChange={(e) => setFractionWhole(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-center text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Numerador</label>
                  <input
                    type="number"
                    min="0"
                    value={fractionNum}
                    onChange={(e) => setFractionNum(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-center text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Denominador</label>
                  <select
                    value={fractionDen}
                    onChange={(e) => setFractionDen(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-white font-mono text-center text-lg font-bold"
                  >
                    {[2, 4, 8, 16, 32, 64].map((d) => (
                      <option key={d} value={d}>/{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conversion Preview Box */}
              <div className="bg-slate-950 p-4 rounded-xl border border-sky-500/40 text-center space-y-1">
                <div className="text-xs text-slate-400">Fracción Ingresada:</div>
                <div className="text-2xl font-black text-sky-400 font-mono">
                  {fractionWhole > 0 ? `${fractionWhole} ` : ""}{fractionNum}/{fractionDen}"
                </div>
                <div className="text-lg font-bold text-white font-mono mt-1">
                  = {fractionTotalMm.toFixed(2)} mm
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  ({fractionTotalInches.toFixed(4)} pulgadas decimales)
                </div>
              </div>

              {/* Quick Fraction Reference Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Equivalencias Rápidas Habituales:</span>
                <div className="grid grid-cols-4 gap-1 text-[11px] font-mono">
                  {[
                    { f: '1/8"', mm: "3.18 mm" },
                    { f: '3/16"', mm: "4.76 mm" },
                    { f: '1/4"', mm: "6.35 mm" },
                    { f: '5/16"', mm: "7.94 mm" },
                    { f: '3/8"', mm: "9.52 mm" },
                    { f: '1/2"', mm: "12.70 mm" },
                    { f: '5/8"', mm: "15.88 mm" },
                    { f: '3/4"', mm: "19.05 mm" },
                    { f: '7/8"', mm: "22.22 mm" },
                    { f: '1"', mm: "25.40 mm" },
                    { f: '1 1/4"', mm: "31.75 mm" },
                    { f: '1 1/2"', mm: "38.10 mm" },
                  ].map((item) => (
                    <div key={item.f} className="bg-slate-950/80 p-1 rounded border border-slate-800 text-center">
                      <span className="text-sky-400 font-bold block">{item.f}</span>
                      <span className="text-slate-300 text-[10px]">{item.mm}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Gauge MSG Table */}
      {activeConverterTab === "gauges" && (
        <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">
                Tabla de Calibres MSG (Manufacturers Standard Gauge) en Chile
              </h3>
              <p className="text-xs text-slate-400">
                Correspondencia oficial entre número de calibre, espesor nominal en milímetros, pulgadas y peso teórico por metro cuadrado.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-300 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Calibre (MSG)</th>
                  <th className="p-3">Espesor (mm)</th>
                  <th className="p-3">Fracción Aprox.</th>
                  <th className="p-3">Peso Plancha d=8.0 (kg/m²)</th>
                  <th className="p-3">Peso Plancha d=7.85 (kg/m²)</th>
                  <th className="p-3">Aplicaciones Comunes en Chile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {STANDARD_GAUGES_MSG.map((g) => {
                  const weightD8 = Number((g.mm * 8.0).toFixed(2));
                  const weightD785 = Number((g.mm * 7.85).toFixed(2));
                  return (
                    <tr key={g.gauge} className="hover:bg-slate-950/40 transition-colors">
                      <td className="p-3 font-bold text-sky-400">{g.gauge.split("(")[0]}</td>
                      <td className="p-3 font-bold text-white">{g.mm} mm</td>
                      <td className="p-3 text-slate-300">{g.fraction}</td>
                      <td className="p-3 text-sky-300 font-bold">{weightD8} kg/m²</td>
                      <td className="p-3 text-slate-400">{weightD785} kg/m²</td>
                      <td className="p-3 font-sans text-slate-300">{g.typicalUse}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: AISC Linear Density lbs/ft <-> kg/m */}
      {activeConverterTab === "linear-density" && (
        <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4 max-w-2xl mx-auto">
          <div>
            <h3 className="text-base font-bold text-white">
              Conversión de Peso Lineal de Vigas AISC (lbs/ft ⇄ kg/m)
            </h3>
            <p className="text-xs text-slate-400">
              En planos norteamericanos las vigas se denominan con su peso en libras por pie (ej. <strong>W 10x30</strong> = peralte ~10" y peso de <strong>30 lbs/ft</strong>).
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Valor de Peso Lineal</label>
                <input
                  type="number"
                  value={linearVal}
                  onChange={(e) => setLinearVal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Unidad Ingresada</label>
                <select
                  value={linearFrom}
                  onChange={(e) => setLinearFrom(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-semibold text-sm"
                >
                  <option value="lbs_ft">Libras por Pie (lbs/ft)</option>
                  <option value="kg_m">Kilos por Metro (kg/m)</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-sky-500/40 text-center space-y-1">
              <div className="text-xs text-slate-400">Equivalencia Exacta:</div>
              <div className="text-2xl font-black text-sky-400 font-mono">
                {linearResult.kg_m} kg/m
              </div>
              <div className="text-sm font-bold text-white font-mono">
                = {linearResult.lbs_ft} lbs/ft
              </div>
              <div className="text-[11px] text-slate-500 pt-1 font-mono">
                Factor: 1 lb/ft = 1.48816 kg/m
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Weight kg <-> lbs */}
      {activeConverterTab === "weight" && (
        <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4 max-w-2xl mx-auto">
          <div>
            <h3 className="text-base font-bold text-white">
              Conversor de Masa y Peso (Kilogramos, Libras y Toneladas)
            </h3>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Valor de Masa/Peso</label>
                <input
                  type="number"
                  value={weightValue}
                  onChange={(e) => setWeightValue(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Unidad</label>
                <select
                  value={weightFrom}
                  onChange={(e) => setWeightFrom(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-semibold text-sm"
                >
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="lbs">Libras (lbs)</option>
                  <option value="ton">Toneladas Métricas (t)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Kilos:</span>
                <span className="text-base font-bold text-sky-400 font-mono">{weightResults.kg} kg</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Libras:</span>
                <span className="text-base font-bold text-white font-mono">{weightResults.lbs} lbs</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block">Toneladas:</span>
                <span className="text-base font-bold text-sky-300 font-mono">{weightResults.ton} ton</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Stress MPa <-> ksi */}
      {activeConverterTab === "stress" && (
        <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4 max-w-2xl mx-auto">
          <div>
            <h3 className="text-base font-bold text-white">
              Conversión de Tensión y Resistencia de Acero (MPa ⇄ ksi ⇄ kgf/cm²)
            </h3>
            <p className="text-xs text-slate-400">
              Fluencia mínima de aceros comunes: <strong>A36 = 36 ksi ≈ 250 MPa</strong>; <strong>A270ES = 270 MPa</strong>; <strong>A572 Gr 50 = 50 ksi ≈ 345 MPa</strong>.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tensión / Resistencia</label>
                <input
                  type="number"
                  value={stressVal}
                  onChange={(e) => setStressVal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Unidad</label>
                <select
                  value={stressFrom}
                  onChange={(e) => setStressFrom(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-semibold text-sm"
                >
                  <option value="ksi">ksi (kilo-pound per square inch)</option>
                  <option value="mpa">Megapascales (MPa / N/mm²)</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-sky-500/40 text-center space-y-1">
              <div className="text-2xl font-black text-sky-400 font-mono">
                {stressResult.mpa} MPa (N/mm²)
              </div>
              <div className="text-sm font-bold text-white font-mono">
                = {stressResult.ksi} ksi = {stressResult.kgf_cm2} kgf/cm²
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
