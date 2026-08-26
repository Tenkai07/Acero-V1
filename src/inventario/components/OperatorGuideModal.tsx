import { useState } from 'react';
import { OptimizationResult, MaterialStockItem, CutPieceDetail } from '../types';
import { Smartphone, Check, ChevronLeft, ChevronRight, X, Scissors, Layers, CheckCircle2 } from 'lucide-react';

interface OperatorGuideModalProps {
  result: OptimizationResult;
  material: MaterialStockItem;
  onClose: () => void;
}

export const OperatorGuideModal = ({
  result,
  material,
  onClose
}: OperatorGuideModalProps) => {
  const [currentBarIndex, setCurrentBarIndex] = useState<number>(0);
  const [completedCutKeys, setCompletedCutKeys] = useState<Set<string>>(new Set());

  const currentPlan = result.barPlans[currentBarIndex];
  if (!currentPlan) return null;

  const handleToggleCut = (cutIndex: number) => {
    const key = `${currentPlan.id}_${cutIndex}`;
    const next = new Set(completedCutKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCompletedCutKeys(next);
  };

  const totalCutsInApp = result.barPlans.reduce((s, b) => s + b.cuts.length, 0);
  const totalCompletedCuts = completedCutKeys.size;
  const progressPercent = Math.round((totalCompletedCuts / totalCutsInApp) * 100) || 0;

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col z-50 p-3 sm:p-6 select-none animate-fadeIn">
      {/* Header for Shop Floor */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-white">
                Modo Taller • Operador de Sierra
              </span>
              <span className="bg-amber-500/20 text-amber-300 text-[11px] px-2 py-0.5 rounded-full font-bold">
                {progressPercent}% Completado
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {material.name} ({material.dimensions})
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-emerald-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Bar Navigation & Information */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 max-w-3xl mx-auto w-full">
        {/* Bar Selector Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <button
            disabled={currentBarIndex === 0}
            onClick={() => setCurrentBarIndex(Math.max(0, currentBarIndex - 1))}
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-amber-400 font-bold">
              Barra {currentPlan.barIndex} de {result.barPlans.length}
            </div>
            <div className="text-xl font-black text-white mt-0.5">
              Largo Inicial: {currentPlan.sourceLengthMm} mm
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {currentPlan.sourceType === 'stock_offcut'
                ? '♻️ Tomar Retazo de Bodega'
                : '📦 Tomar Barra Estándar 6m/12m'}
            </div>
          </div>

          <button
            disabled={currentBarIndex === result.barPlans.length - 1}
            onClick={() =>
              setCurrentBarIndex(Math.min(result.barPlans.length - 1, currentBarIndex + 1))
            }
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Initial Trim instruction */}
        {currentPlan.trimCutMm > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-400" />
              <span>Saneo inicial (escuadrar punta de la barra):</span>
            </span>
            <strong className="font-mono text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
              {currentPlan.trimCutMm} mm
            </strong>
          </div>
        )}

        {/* Cuts list with large tactile touch cards for workshop phone use */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Cortes a Realizar en esta Barra ({currentPlan.cuts.length} cortes):
          </div>

          {currentPlan.cuts.map((cut) => {
            const cutKey = `${currentPlan.id}_${cut.cutIndex}`;
            const isDone = completedCutKeys.has(cutKey);

            return (
              <div
                key={cut.pieceId}
                onClick={() => handleToggleCut(cut.cutIndex)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isDone
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 opacity-60'
                    : 'bg-slate-900 border-slate-700 hover:border-amber-400 text-white shadow-md active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                      isDone
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {isDone ? <Check className="w-6 h-6 stroke-[3]" /> : `#${cut.cutIndex}`}
                  </div>

                  <div>
                    <div className="font-bold text-base text-white">{cut.label}</div>
                    <div className="text-xs text-slate-400">
                      Largo de pieza:{' '}
                      <strong className="text-amber-300 font-mono text-sm">{cut.lengthMm} mm</strong>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-mono">
                    Posición Tope de Sierra
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 inline-block mt-0.5">
                    {cut.stopPositionMm} mm
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Remaining Tail Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 flex items-center justify-between">
          <span>
            {currentPlan.isReusableOffcut
              ? '♻️ Sobrante aprovechable (Guardar en bodega):'
              : '🗑️ Sobrante Merma / Descarte:'}
          </span>
          <strong
            className={`font-mono text-base ${
              currentPlan.isReusableOffcut ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {currentPlan.remainingMm} mm
          </strong>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="pt-3 border-t border-slate-800 flex justify-between items-center max-w-3xl mx-auto w-full">
        <button
          onClick={onClose}
          className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl transition-colors"
        >
          Salir de Modo Taller
        </button>

        {currentBarIndex < result.barPlans.length - 1 ? (
          <button
            onClick={() => setCurrentBarIndex(currentBarIndex + 1)}
            className="text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span>Siguiente Barra ({currentBarIndex + 2})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>¡Corte Completo! Salir</span>
          </button>
        )}
      </div>
    </div>
  );
};
