import React, { useState } from "react";
import { 
  ShieldCheck, 
  HelpCircle, 
  DollarSign, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Info, 
  Layers, 
  BookOpen, 
  BadgePercent 
} from "lucide-react";
import { CHILEAN_STEEL_GRADES, MARKET_PRICE_REFERENCES } from "../../data/chileanSteelData";

export const SteelCatalogAndPrices: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"grades" | "identification" | "prices">("grades");
  const [selectedGradeId, setSelectedGradeId] = useState<string>("a270es");
  const [priceCategory, setPriceCategory] = useState<string>("all");
  const [searchPrice, setSearchPrice] = useState<string>("");

  const selectedGrade = CHILEAN_STEEL_GRADES.find((g) => g.id === selectedGradeId) || CHILEAN_STEEL_GRADES[0];

  const filteredPrices = MARKET_PRICE_REFERENCES.filter((p) => {
    const matchesCat = priceCategory === "all" || p.category === priceCategory;
    const matchesSearch = 
      p.product.toLowerCase().includes(searchPrice.toLowerCase()) ||
      p.unit.toLowerCase().includes(searchPrice.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-800 dark:bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Aceros en Chile: Guía Técnica, Identificación & Precios
              </h2>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Catálogo de calidades chilenas (<strong>NCh 203, NCh 204, ICHA</strong>), guía de identificación visual por código de colores y marcas, y lista de precios referenciales en CLP.
            </p>
          </div>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: "grades", label: "Calidades & Normas Chilenas", icon: BookOpen },
          { id: "identification", label: "Cómo Identificar en Obra / Taller", icon: HelpCircle },
          { id: "prices", label: "Precios de Mercado (CLP)", icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-sky-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Grades & Standards */}
      {activeTab === "grades" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Grade Selector List */}
          <div className="lg:col-span-4 space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Calidades Estructurales Habituales en Chile:
            </label>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {CHILEAN_STEEL_GRADES.map((grade) => {
                const isSelected = selectedGrade?.id === grade.id;
                return (
                  <button
                    key={grade.id}
                    onClick={() => setSelectedGradeId(grade.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/15 border-sky-500 text-white shadow-md ring-1 ring-sky-500/40"
                        : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{grade.designation}</span>
                      <span className="text-[10px] font-mono font-bold bg-slate-950 px-2 py-0.5 rounded text-sky-400 border border-slate-800">
                        {grade.standard}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {grade.application}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grade Full Technical Sheet */}
          <div className="lg:col-span-8 space-y-4">
            {selectedGrade && (
              <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 space-y-5">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700 pb-4 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-white">{selectedGrade.designation}</h3>
                      <span className="bg-sky-500/20 text-sky-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-sky-500/30">
                        {selectedGrade.standard}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Equivalencias Internacionales: <strong className="text-sky-400">{selectedGrade.equivalentStandards.join(" | ")}</strong>
                    </p>
                  </div>

                  {/* Identification Color Tag */}
                  <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start">
                    <span className="text-[11px] text-slate-400">Color de Punta:</span>
                    <span className="text-xs font-bold text-sky-300">{selectedGrade.identificationColor}</span>
                  </div>
                </div>

                {/* Mechanical Properties Grid */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    Propiedades Mecánicas Garantizadas:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Límite de Fluencia (Fy):</span>
                      <span className="text-base font-black text-sky-400 font-mono">
                        {selectedGrade.yieldStrengthMinMpa} MPa
                      </span>
                      <span className="text-[10px] text-slate-500 block">({(selectedGrade.yieldStrengthMinMpa * 10.197).toFixed(0)} kgf/cm²)</span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Resistencia Tracción (Fu):</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {selectedGrade.tensileStrengthMpa} MPa
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Alargamiento Mínimo:</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        {selectedGrade.elongationMinPercent}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">en L=200mm</span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Soldabilidad / CEV:</span>
                      <span className="text-xs font-bold text-cyan-400">
                        {selectedGrade.weldability}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Applications & Features */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Aplicaciones y Usos Típicos en Chile:
                  </h4>
                  <p className="text-sm text-slate-200 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
                    {selectedGrade.application}
                  </p>
                </div>

                {/* Weldability & Workshop Notes */}
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-sky-400">
                    <Info className="w-4 h-4" />
                    <span>Recomendaciones de Taller y Fabricación:</span>
                  </div>
                  <p>
                    {selectedGrade.id === "a270es" && "Acero estructural soldable estándar para edificación sismorresistente en Chile. No requiere precalentamiento para espesores menores a 25 mm con electrodos E7018 o microalambre ER70S-6."}
                    {selectedGrade.id === "a630-420h" && "Barras de hormigón armado con resaltes. La letra 'H' indica uso en hormigón. El doblado debe respetar los diámetros de mandril de la norma NCh 204 para evitar fisuración del núcleo."}
                    {selectedGrade.id === "a36" && "Acero al carbono tradicional para pletinas, perfiles comerciales y pernos de anclaje. Soldabilidad universal."}
                    {selectedGrade.id === "a572-50" && "Acero de alta resistencia y baja aleación (HSLA). Ideal para vigas de grandes luces y puentes, reduciendo el peso de la estructura hasta un 25%."}
                  </p>
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab 2: How to Identify Steel */}
      {activeTab === "identification" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Guide 1: Color Codes */}
            <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <span className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">1</span>
                <span>Código de Colores en Puntas</span>
              </div>
              <p className="text-xs text-slate-300">
                Las acererías (AZA, CAP, Cintac, Gerdau) pintan los extremos de las barras y atados para su rápida identificación visual en patio:
              </p>
              <ul className="space-y-2 text-xs font-mono">
                <li className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-white">A270ES (NCh 203):</span>
                  <span className="text-sky-300 font-bold">Amarillo o Blanco</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-white">A36 (ASTM):</span>
                  <span className="text-emerald-400 font-bold">Verde</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-white">A572 Gr 50:</span>
                  <span className="text-red-400 font-bold">Rojo</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-white">A630-420H (Fierro):</span>
                  <span className="text-cyan-400 font-bold">Azul / Naranjo</span>
                </li>
              </ul>
            </div>

            {/* Guide 2: Rebar Marks NCh 204 */}
            <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <span className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">2</span>
                <span>Marcas en Fierro de Construcción</span>
              </div>
              <p className="text-xs text-slate-300">
                Cada barra estriada de hormigón armado lleva estampado en relieve a lo largo de su cuerpo:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="font-mono text-sky-300 font-bold text-center p-1.5 bg-slate-900 rounded border border-slate-800">
                  AZA [CHILE] 16 A630-420H
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                  <li><strong>Fabricante:</strong> Logotipo del laminador (ej: AZA, CAP).</li>
                  <li><strong>País de Origen:</strong> CHILE.</li>
                  <li><strong>Diámetro:</strong> 8, 10, 12, 16, 18, 22, 25, 28, 32 mm.</li>
                  <li><strong>Calidad:</strong> A630 (resistencia mínima a tracción 630 MPa, fluencia 420 MPa).</li>
                </ul>
              </div>
            </div>

            {/* Guide 3: Certificates and Mill Test */}
            <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <span className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">3</span>
                <span>Certificado de Calidad (MTR)</span>
              </div>
              <p className="text-xs text-slate-300">
                El Certificado de Ensayo de Laminación (Mill Test Report) debe acompañar cada lote y certificar:
              </p>
              <ul className="space-y-1.5 text-xs text-slate-300">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Número de Colada (Heat No):</strong> Trazabilidad del horno de fundición.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Composición Química:</strong> Carbono (C ≤ 0.23%), Manganeso, Fósforo, Azufre.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Ensayos de Tracción y Doblado:</strong> Cumplimiento estricto de NCh 203 / NCh 204.</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      )}

      {/* Tab 3: Market Prices in Chile */}
      {activeTab === "prices" && (
        <div className="space-y-4">
          
          {/* Search & Category Filter */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "Todos los Productos" },
                { id: "Planchas", label: "Planchas Gruesas y Delgadas" },
                { id: "Perfiles", label: "Perfiles Estructurales" },
                { id: "Barras", label: "Barras (Pernos / Barandas)" },
                { id: "Fierro Construcción", label: "Fierro Construcción (AZA)" },
                { id: "Tubulares", label: "Tubos y Cañerías" },
                { id: "Fittings", label: "Codos y Fittings" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setPriceCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    priceCategory === cat.id
                      ? "bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-sm"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchPrice}
                onChange={(e) => setSearchPrice(e.target.value)}
                placeholder="Filtrar por producto o medida..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

          </div>

          {/* Prices Table */}
          <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-950/40">
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Tabla de Precios Referenciales (Mercado Chileno en Pesos Chilenos - CLP)
                </span>
                <p className="text-[11px] text-slate-400">
                  Valores promedio referenciales de distribuidores mayoristas e industriales en Santiago y regiones (+IVA).
                </p>
              </div>
              <span className="text-xs text-sky-400 font-bold bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
                Actualizado 2025/2026
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-300 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Producto / Especificación</th>
                    <th className="p-3">Unidad de Venta</th>
                    <th className="p-3 text-right">Precio Neto Estimado (CLP)</th>
                    <th className="p-3 text-right">Precio con IVA (19%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {filteredPrices.map((item, idx) => {
                    const priceWithIva = Math.round(item.averagePriceCLP * 1.19);
                    return (
                      <tr key={idx} className="hover:bg-slate-950/50 transition-colors">
                        <td className="p-3 font-sans">
                          <span className="bg-slate-950 text-slate-300 px-2 py-0.5 rounded text-[10px] border border-slate-800">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-3 font-sans font-bold text-white">{item.product}</td>
                        <td className="p-3 text-slate-400 font-sans">{item.unit}</td>
                        <td className="p-3 text-right font-bold text-sky-400">
                          ${item.averagePriceCLP.toLocaleString("es-CL")} CLP
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-400">
                          ${priceWithIva.toLocaleString("es-CL")} CLP
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
