import { useState } from 'react';
import {
  BOMProfileGroup,
  MaterialStockItem,
  OptimizationSettings,
  OptimizationResult
} from '../types';
import { CutDiagram1D } from './CutDiagram1D';
import { generateSampleInventoryExcel } from '../utils/excelInventoryHandler';
import { exportCubicacionSummaryToExcel } from '../utils/cubicacionSummaryExport';
import {
  Cpu,
  CheckCircle2,
  ShoppingCart,
  Layers,
  ArrowRight,
  Sparkles,
  Scissors,
  AlertTriangle,
  Printer,
  Share2,
  Info,
  Smartphone,
  Maximize2,
  FileSpreadsheet,
  Download,
  Boxes,
  HelpCircle,
  TrendingDown,
  Warehouse,
  Flame,
  Check,
  BookmarkPlus,
  Search
} from 'lucide-react';

interface PreNestingStockViewProps {
  groups: BOMProfileGroup[];
  inventory: MaterialStockItem[];
  settings: OptimizationSettings;
  onUpdateSettings: (settings: OptimizationSettings) => void;
  onRunPreNesting: () => void;
  onProceedToPurchases: () => void;
  onOpenOperatorGuide?: (result: OptimizationResult, material: MaterialStockItem) => void;
  onOpenSaveModal?: () => void;
  onOpenStockLookup?: () => void;
  onProceedToSplice?: () => void;
}

export const PreNestingStockView = ({
  groups,
  inventory,
  settings,
  onUpdateSettings,
  onRunPreNesting,
  onProceedToPurchases,
  onOpenOperatorGuide,
  onOpenSaveModal,
  onOpenStockLookup,
  onProceedToSplice
}: PreNestingStockViewProps) => {
  // Mode switcher: 'theoretical' (Step 1: Pure project demand) vs 'reconciliation' (Step 2: Compare with warehouse stock)
  const [analysisMode, setAnalysisMode] = useState<'theoretical' | 'reconciliation'>('theoretical');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Global calculations for Pure Theoretical 1D Nesting (Step 1)
  const totalTheoreticalBarsAll = groups.reduce(
    (s, g) => s + (g.pureTheoreticalNestingResult?.totalBarsUsed || g.nestingResult?.totalBarsUsed || 0),
    0
  );
  const totalTheoreticalPiecesAll = groups.reduce((s, g) => s + g.totalPiecesCount, 0);
  const totalTheoreticalLengthMetersAll = groups.reduce((s, g) => s + g.totalLengthMm / 1000, 0);
  const totalTheoreticalWeightKgAll = groups.reduce((s, g) => s + g.totalWeightKg, 0);

  // Ponderado por material realmente usado (metros brutos), no un promedio
  // simple entre perfiles — un perfil con una sola pieza no debe pesar lo
  // mismo que uno con cientos a la hora de mostrar el aprovechamiento
  // global del proyecto.
  const totalRawMaterialAll = groups.reduce((s, g) => s + (g.pureTheoreticalNestingResult?.totalRawMaterialLengthMm || 0), 0);
  const totalUsefulCutAll = groups.reduce((s, g) => s + (g.pureTheoreticalNestingResult?.totalUsefulCutsLengthMm || 0), 0);
  const avgTheoreticalEfficiency = totalRawMaterialAll > 0
    ? Number(((totalUsefulCutAll / totalRawMaterialAll) * 100).toFixed(1))
    : 0;

  // Global calculations for Warehouse Reconciliation (Step 2)
  const totalBarsToBuyAll = groups.reduce(
    (s, g) => s + (g.stockComparison?.barsToBuy || 0),
    0
  );
  const totalMetersToBuyAll = groups.reduce(
    (s, g) => s + (g.stockComparison?.metersToBuy || 0),
    0
  );
  const totalWeightToBuyAll = groups.reduce(
    (s, g) => s + (g.stockComparison?.weightToBuyKg || 0),
    0
  );
  const totalBarsFromStockAll = groups.reduce(
    (s, g) => s + (g.stockComparison?.barsFromStock || 0),
    0
  );
  const totalOffcutsFromStockAll = groups.reduce(
    (s, g) => s + (g.stockComparison?.offcutsFromStock || 0),
    0
  );

  const totalBarsSavedAll = Math.max(0, totalTheoreticalBarsAll - totalBarsToBuyAll);

  const activeGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

  // Pick active nesting result according to mode
  const activeNestingResult = analysisMode === 'theoretical'
    ? (activeGroup?.pureTheoreticalNestingResult || activeGroup?.nestingResult)
    : activeGroup?.nestingResult;

  if (groups.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-xs">
        <Cpu className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">No hay planilla cargada para pre-anidar</h3>
        <p className="text-sm text-slate-500 mt-1">
          Primero importa tus datos en la pestaña "1. Importar Planilla (BOM)".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & 2-Stage Analysis Mode Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                Paso 3 de 4
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Cpu className="w-6 h-6 text-blue-600" />
                <span>GoNest 1D: Requerimiento & Cotejo con Bodega</span>
              </h1>
            </div>
            <p className="text-sm text-slate-600">
              {analysisMode === 'theoretical'
                ? 'Etapa 1: Calcula la cantidad bruta de barras de catálogo comercial necesarias para fabricar el proyecto.'
                : 'Etapa 2: Cruza el requerimiento contra existencias y retazos reales en bodega para definir qué comprar.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onOpenStockLookup && (
              <button
                onClick={onOpenStockLookup}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm border border-slate-300 flex items-center gap-1.5 transition-colors"
                title="Buscar existencias y despuntes en bodega"
              >
                <Search className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Consultar Stock</span>
              </button>
            )}

            <button
              onClick={onRunPreNesting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm border border-slate-300 flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Recalcular GoNest</span>
            </button>

            {onOpenSaveModal && (
              <button
                onClick={onOpenSaveModal}
                className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs sm:text-sm border border-amber-300 flex items-center gap-1.5 transition-colors"
                title="Guardar proyecto en el historial de cubicaciones"
              >
                <BookmarkPlus className="w-4 h-4 text-amber-600" />
                <span>Guardar Proyecto</span>
              </button>
            )}

            <button
              onClick={() => exportCubicacionSummaryToExcel(groups, inventory)}
              className="px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs sm:text-sm border border-blue-300 flex items-center gap-2 transition-colors"
              title="Exportar a Excel: requerimiento total, detalle barra por barra para cotejar, stock en bodega y resumen de compra"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              <span className="hidden sm:inline">Exportar Resumen</span>
              <span className="sm:hidden">Resumen</span>
            </button>

            <button
              onClick={generateSampleInventoryExcel}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm border border-emerald-300 flex items-center gap-2 transition-colors"
              title="Descargar plantilla Excel oficial de inventario"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">Plantilla Excel</span>
              <span className="sm:hidden">Plantilla</span>
            </button>

            <button
              onClick={onProceedToPurchases}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 flex items-center gap-2 transition-colors"
            >
              <span>4. Ver Orden de Compra</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2-STAGE INTERACTIVE WORKFLOW SWITCHER */}
        <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* STAGE 1 BUTTON */}
          <button
            onClick={() => setAnalysisMode('theoretical')}
            className={`flex items-start gap-3 p-3.5 rounded-xl text-left transition-all relative ${
              analysisMode === 'theoretical'
                ? 'bg-white text-slate-900 shadow-sm ring-2 ring-blue-600'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
              analysisMode === 'theoretical' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              1
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base">
                  1. ¿Cuánto Material se Necesita?
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                  GoNest 1D Puro
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cálculo del proyecto desde cero: barras comerciales teóricas requeridas y aprovechamiento.
              </p>
            </div>
          </button>

          {/* STAGE 2 BUTTON */}
          <button
            onClick={() => setAnalysisMode('reconciliation')}
            className={`flex items-start gap-3 p-3.5 rounded-xl text-left transition-all relative ${
              analysisMode === 'reconciliation'
                ? 'bg-white text-slate-900 shadow-sm ring-2 ring-emerald-600'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
              analysisMode === 'reconciliation' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              2
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base">
                  2. Cotejar con Stock de Bodega
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  Tengo vs Comprar
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Descuenta retazos y barras en stock para calcular exactamente el faltante neto a comprar.
              </p>
            </div>
          </button>
        </div>

        {/* Global Summary KPI Banner for STAGE 1: Theoretical */}
        {analysisMode === 'theoretical' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold flex items-center gap-1.5 text-blue-900">
                <Boxes className="w-4 h-4 text-blue-600" />
                Resumen de Requerimiento Bruto del Proyecto (100% Material Comercial Nuevo):
              </span>
              <button
                onClick={() => setAnalysisMode('reconciliation')}
                className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 underline underline-offset-2"
              >
                <span>👉 Ver qué tengo en bodega y qué falta comprar</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-800 block">
                  Barras Comerciales Totales
                </span>
                <div className="text-xl sm:text-2xl font-black text-blue-950 mt-0.5">
                  {totalTheoreticalBarsAll} barras
                </div>
                <span className="text-xs text-blue-700">
                  {groups.length} perfiles • {totalTheoreticalPiecesAll} piezas
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 block">
                  Metros Netos a Cortar
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                  {totalTheoreticalLengthMetersAll.toFixed(2)} m
                </div>
                <span className="text-xs text-slate-500">
                  Suma total de piezas del proyecto
                </span>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800 block">
                  Peso Acero Proyecto
                </span>
                <div className="text-xl sm:text-2xl font-black text-indigo-900 mt-0.5">
                  {totalTheoreticalWeightKgAll.toFixed(1)} kg
                </div>
                <span className="text-xs text-indigo-700">
                  Cálculo teórico de cubicación
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 block">
                  Aprovechamiento GoNest 1D
                </span>
                <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">
                  {avgTheoreticalEfficiency}%
                </div>
                <span className="text-xs text-emerald-700">
                  Merma teórica estimada: {(100 - avgTheoreticalEfficiency).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Global Summary KPI Banner for STAGE 2: Warehouse Reconciliation */}
        {analysisMode === 'reconciliation' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                <Warehouse className="w-4 h-4 text-emerald-600" />
                Cotejo contra Inventario de Bodega & Retazos Existentes:
              </span>
              <span className="text-slate-500">
                Requerimiento inicial: <strong>{totalTheoreticalBarsAll} barras</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 block">
                  Disponibles en Bodega
                </span>
                <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">
                  {totalBarsFromStockAll} barras
                </div>
                <span className="text-xs text-emerald-700 font-semibold">
                  + {totalOffcutsFromStockAll} retazos aprovechados
                </span>
              </div>

              <div className={`border rounded-xl p-3.5 ${
                totalBarsToBuyAll > 0
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
                  totalBarsToBuyAll > 0 ? 'text-rose-800' : 'text-emerald-800'
                }`}>
                  {totalBarsToBuyAll > 0 ? '🛒 Faltante a Comprar' : '✅ Stock Completo'}
                </span>
                <div className={`text-xl sm:text-2xl font-black mt-0.5 ${
                  totalBarsToBuyAll > 0 ? 'text-rose-900' : 'text-emerald-900'
                }`}>
                  {totalBarsToBuyAll > 0 ? `${totalBarsToBuyAll} barras` : 'Sin compras'}
                </div>
                <span className={`text-xs ${
                  totalBarsToBuyAll > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {totalBarsToBuyAll > 0 ? `${totalMetersToBuyAll.toFixed(1)} m lineales` : '100% en bodega'}
                </span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-800 block">
                  Peso Acero a Comprar
                </span>
                <div className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">
                  {totalWeightToBuyAll.toFixed(1)} kg
                </div>
                <span className="text-xs text-blue-700">
                  Estimado para cotización
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 block">
                  Ahorro en Compras
                </span>
                <div className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">
                  {totalBarsSavedAll} barras
                </div>
                <span className="text-xs text-amber-700">
                  Aprovechadas desde bodega
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Analysis Section: Profile Selector & Cutting Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Profiles */}
        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Perfiles ({groups.length})
            </label>
            <span className="text-[11px] text-slate-500 font-medium">
              {analysisMode === 'theoretical' ? 'Demanda Bruta' : 'Disponibilidad Bodega'}
            </span>
          </div>

          <div className="space-y-2.5">
            {groups.map((group) => {
              const isSelected = group.id === activeGroup?.id;
              const comparison = group.stockComparison;
              const theoBars = group.pureTheoreticalNestingResult?.totalBarsUsed || group.nestingResult?.totalBarsUsed || 0;
              const hasNeedToBuy = (comparison?.barsToBuy || 0) > 0;

              return (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {group.cleanProfileCode}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {group.totalPiecesCount} piezas • {(group.totalLengthMm / 1000).toFixed(2)} m
                      </div>
                    </div>

                    {/* Mode-specific badge */}
                    {analysisMode === 'theoretical' ? (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-blue-600" />
                        <span>{theoBars} barras {(group.commercialBarLengthMm / 1000)}m</span>
                      </span>
                    ) : hasNeedToBuy ? (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3 text-rose-600" />
                        <span>Comprar {comparison?.barsToBuy} b.</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>En Stock</span>
                      </span>
                    )}
                  </div>

                  {/* Quick Sub-Stats */}
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                    {analysisMode === 'theoretical' ? (
                      <>
                        <span>Largo barra: <strong>{(group.commercialBarLengthMm / 1000)}m</strong></span>
                        <span className="text-blue-700 font-semibold font-mono">
                          Aprov: {group.pureTheoreticalNestingResult?.overallEfficiencyPercentage || group.nestingResult?.overallEfficiencyPercentage || 0}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          Bodega: <strong>{comparison?.stockBarsAvailable || 0} b.</strong> / <strong>{comparison?.stockOffcutsAvailable || 0} ret.</strong>
                        </span>
                        <span className="text-emerald-700 font-semibold font-mono">
                          Consumo: {comparison?.barsFromStock} b. + {comparison?.offcutsFromStock} ret.
                        </span>
                      </>
                    )}
                  </div>

                  {/* Piezas que no entran ni en una barra estándar ni en un
                      empalme simple: necesitan empalme múltiple (Paso 2) y
                      quedan FUERA de "barras necesarias"/"aprovechamiento"
                      de arriba — sin este aviso, ese material desaparece
                      del cálculo sin que se note. */}
                  {(() => {
                    const missing = group.pureTheoreticalNestingResult?.missingPieces || [];
                    if (missing.length === 0) return null;
                    const missingQty = missing.reduce((s, p) => s + p.quantity, 0);
                    return (
                      <div className="mt-2 pt-2 border-t border-amber-200 flex items-center gap-1.5 text-[11px] text-amber-700 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{missingQty} pieza(s) muy largas quedan fuera (necesitan empalme múltiple, Paso 2)</span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail: Pre-Nesting Plan & Cutting Diagrams for Selected Profile */}
        {activeGroup && (
          <div className="lg:col-span-8 space-y-5">
            {/* Active Profile Banner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      {activeGroup.profileName}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                      Barra {(activeGroup.commercialBarLengthMm / 1000)}m
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeGroup.totalPiecesCount} piezas a cortar • {(activeGroup.totalLengthMm / 1000).toFixed(2)} m lineales netos • {activeGroup.totalWeightKg.toFixed(1)} kg
                  </p>
                </div>

                {/* Operator Guide launcher */}
                {activeNestingResult && onOpenOperatorGuide && (
                  <button
                    onClick={() => {
                      const matched = inventory.find((m) => m.id === activeGroup.matchedMaterialId) || {
                        id: activeGroup.id,
                        code: activeGroup.cleanProfileCode,
                        name: activeGroup.profileName,
                        category: 'otro',
                        dimensions: activeGroup.cleanProfileCode,
                        grade: 'A36',
                        theoreticalWeightPerMeter: 5,
                        costPerMeter: 5000,
                        standardBarLengthMm: activeGroup.commercialBarLengthMm,
                        standardBarsCount: 0,
                        offcuts: [],
                        minStockBars: 0,
                        location: 'Bodega',
                        lastUpdated: ''
                      };
                      onOpenOperatorGuide(activeNestingResult, matched);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-center"
                  >
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>Abrir Modo Taller (Sierra)</span>
                  </button>
                )}
              </div>

              {/* STAGE 1: CALLOUT REQUERIMIENTO TEÓRICO */}
              {analysisMode === 'theoretical' && activeGroup.pureTheoreticalNestingResult && (
                <div className="p-4 rounded-xl border bg-blue-50/80 border-blue-200 text-blue-950 space-y-2">
                  <div className="flex items-start gap-3">
                    <Boxes className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <div className="font-black text-sm sm:text-base">
                        Requerimiento Teórico GoNest 1D: {activeGroup.pureTheoreticalNestingResult.totalBarsUsed} barras de {(activeGroup.commercialBarLengthMm / 1000)}m
                      </div>
                      <p className="text-xs leading-relaxed text-blue-800">
                        Para cortar las {activeGroup.totalPiecesCount} piezas de este perfil necesitas en total{' '}
                        <strong>
                          {((activeGroup.pureTheoreticalNestingResult.totalBarsUsed * activeGroup.commercialBarLengthMm) / 1000).toFixed(1)} metros lineales brutos
                        </strong>{' '}
                        con un aprovechamiento de corte del{' '}
                        <strong>{activeGroup.pureTheoreticalNestingResult.overallEfficiencyPercentage}%</strong>.
                      </p>

                      <div className="flex items-center gap-4 text-xs font-semibold pt-1 text-blue-900 flex-wrap">
                        <span>Total barras comerciales: <strong>{activeGroup.pureTheoreticalNestingResult.totalBarsUsed}</strong></span>
                        <span>•</span>
                        <span>Piezas cortadas: <strong>{activeGroup.pureTheoreticalNestingResult.totalPiecesCut}</strong> de {activeGroup.totalPiecesCount}</span>
                        <span>•</span>
                        <span>Despuntes generados: <strong>{activeGroup.pureTheoreticalNestingResult.generatedOffcuts.length}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-blue-700">
                      ¿Quieres comprobar cuántas de estas barras ya tienes en bodega?
                    </span>
                    <button
                      onClick={() => setAnalysisMode('reconciliation')}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <span>Cotejar con Bodega</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 2: CALLOUT COTEJO CON BODEGA */}
              {analysisMode === 'reconciliation' && activeGroup.stockComparison && (
                <div
                  className={`p-4 rounded-xl border ${
                    activeGroup.stockComparison.barsToBuy > 0
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {activeGroup.stockComparison.barsToBuy > 0 ? (
                      <ShoppingCart className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    )}

                    <div className="space-y-1 flex-1">
                      <div className="font-extrabold text-sm sm:text-base">
                        {activeGroup.stockComparison.barsToBuy > 0
                          ? `🛒 DEBES COMPRAR: ${activeGroup.stockComparison.barsToBuy} barras de ${(activeGroup.commercialBarLengthMm / 1000)}m (${activeGroup.stockComparison.metersToBuy.toFixed(2)} m)`
                          : `✅ MATERIAL SUFICIENTE EN BODEGA`}
                      </div>

                      <div className="text-xs leading-relaxed opacity-90">
                        {activeGroup.stockComparison.message}
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold pt-1 flex-wrap">
                        <span>Requerimiento total del proyecto: <strong>{activeGroup.stockComparison.barsNeededTotal} barras</strong></span>
                        <span>•</span>
                        <span>Se toman de bodega: <strong>{activeGroup.stockComparison.barsFromStock} barras</strong></span>
                        <span>•</span>
                        <span>Retazos aprovechados: <strong>{activeGroup.stockComparison.offcutsFromStock}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Piezas que ni una barra grande ni un empalme simple pueden
                  resolver — quedan afuera del cálculo de arriba (barras
                  necesarias / aprovechamiento) hasta que se dividan a mano
                  en "2. Ajustar Medidas & Empalmes". Sin este aviso, ese
                  material no aparece en ningún número visible. */}
              {activeNestingResult && activeNestingResult.missingPieces.length > 0 && (
                <div className="p-4 rounded-xl border bg-rose-50/80 border-rose-200 text-rose-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <div className="font-extrabold text-sm">
                        ⚠️ {activeNestingResult.missingPieces.reduce((s, p) => s + p.quantity, 0)} pieza(s) NO incluidas arriba — necesitan empalme múltiple
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">
                        Son más largas que lo que cubre un largo comercial + un solo empalme. No están en "Barras Necesarias" ni en el % de Aprovechamiento de este perfil — resuélvelas en{' '}
                        {onProceedToSplice ? (
                          <button onClick={onProceedToSplice} className="underline font-bold hover:text-rose-700">
                            "2. Ajustar Medidas &amp; Empalmes"
                          </button>
                        ) : (
                          <strong>"2. Ajustar Medidas &amp; Empalmes"</strong>
                        )}{' '}
                        antes de dar por cerrada la compra de este perfil.
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {activeNestingResult.missingPieces.map((p) => (
                          <span key={p.id} className="bg-rose-100 border border-rose-300 text-rose-900 text-[11px] font-mono px-2 py-0.5 rounded-lg">
                            {p.label}: {p.quantity}× {p.lengthMm.toLocaleString('es-CL')}mm
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Piezas que exceden el largo estándar: comparación barra grande vs. empalme */}
              {activeNestingResult?.oversizedPieceComparisons && activeNestingResult.oversizedPieceComparisons.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <Scissors className="w-4 h-4" />
                    Piezas que exceden el largo estándar — Comparación de alternativas
                  </span>
                  {activeNestingResult.oversizedPieceComparisons.map((cmp, idx) => (
                    <div key={idx} className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="text-xs font-bold text-amber-900">
                        {cmp.quantity} pieza(s) de {cmp.pieceLengthMm.toLocaleString('es-CL')}mm — no caben en una barra estándar
                      </div>
                      <div className={`grid grid-cols-1 ${cmp.options.length > 1 ? 'sm:grid-cols-2' : ''} gap-2.5`}>
                        {cmp.options.map((opt) => (
                          <div
                            key={opt.type}
                            className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                              opt.type === cmp.recommendedType
                                ? 'bg-emerald-50 border-emerald-300'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">
                                {opt.type === 'bigger_bar' ? 'Opción A: Barra más grande' : 'Opción B: Empalme'}
                              </span>
                              {opt.type === cmp.recommendedType && (
                                <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Menor desperdicio
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600">{opt.label}</p>
                            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-700 pt-1 border-t border-slate-200/70">
                              <span>Barras nuevas: <strong>{opt.newBarsRequired}</strong></span>
                              <span>Desperdicio: <strong className="text-amber-700">{opt.wasteMm.toFixed(0)}mm ({opt.wastePercentage}%)</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cutting Diagrams 1D Bar by Bar */}
              {activeNestingResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Diagramas de Corte 1D ({activeNestingResult.barPlans.length} barras):
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500 font-mono">
                        Eficiencia: <strong className="text-emerald-700">{activeNestingResult.overallEfficiencyPercentage}%</strong>
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-500">
                        Modo: <strong>{analysisMode === 'theoretical' ? '100% Nuevas' : 'Optimizado con Bodega'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {activeNestingResult.barPlans.map((plan) => (
                      <CutDiagram1D
                        key={plan.id}
                        barPlan={plan}
                        materialName={activeGroup.cleanProfileCode}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
