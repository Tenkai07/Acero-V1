import { useState } from 'react';
import { CutBarPlan, CutPieceDetail } from '../types';
import { Info, Tag, Check, Scissors, AlertCircle, Repeat } from 'lucide-react';
import { formatBarIndices } from '../utils/cutPatternGrouping';

interface CutDiagram1DProps {
  key?: string;
  barPlan: CutBarPlan;
  materialName?: string;
  onMarkCutDone?: (barId: string, cutIndex: number) => void;
  completedCuts?: Set<string>; // 'barId_cutIndex'
  /** Cuántas barras físicas comparten EXACTAMENTE este mismo patrón de
   * corte (ver `groupBarPlansByPattern`) — 1 si no se agrupó nada. */
  repeatCount?: number;
  /** Los `barIndex` de todas las barras que comparten el patrón, para
   * mostrar "Barras #3, #7, #12..." en vez de solo la primera. */
  barIndices?: number[];
}

export const CutDiagram1D = ({
  barPlan,
  materialName,
  onMarkCutDone,
  completedCuts,
  repeatCount = 1,
  barIndices
}: CutDiagram1DProps) => {
  const [hoveredPiece, setHoveredPiece] = useState<CutPieceDetail | null>(null);

  const totalLength = barPlan.sourceLengthMm;
  const isOffcutSource = barPlan.sourceType === 'stock_offcut';
  const isPurchasedBar = barPlan.sourceType === 'new_purchased_bar';

  const trimPercent = (barPlan.trimCutMm / totalLength) * 100;
  const remainingPercent = (barPlan.remainingMm / totalLength) * 100;

  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs transition-all hover:border-slate-300">
      {/* Header of Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
              {barPlan.barIndex}
            </span>
            <span>
              {repeatCount > 1
                ? `Patrón de Corte (barras ${formatBarIndices(barIndices || [barPlan.barIndex])})`
                : `Barra #${barPlan.barIndex}`}
            </span>
          </span>

          {repeatCount > 1 && (
            <span className="px-2.5 py-0.5 rounded-md font-bold text-[11px] border bg-blue-50 text-blue-800 border-blue-200 flex items-center gap-1">
              <Repeat className="w-3 h-3" /> ×{repeatCount} barras iguales
            </span>
          )}

          <span
            className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] border ${
              isOffcutSource
                ? 'bg-purple-50 text-purple-800 border-purple-200'
                : isPurchasedBar
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {isOffcutSource
              ? `♻️ Retazo de Bodega (${totalLength} mm)`
              : isPurchasedBar
              ? `🛒 Barra a Comprar (${totalLength / 1000} m)`
              : `📦 Barra Estándar en Bodega (${totalLength / 1000} m)`}
          </span>

          {materialName && (
            <span className="text-slate-500 font-mono font-medium hidden md:inline">
              {materialName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <div>
            <span className="text-slate-400">Eficiencia:</span>{' '}
            <strong
              className={`font-bold ${
                barPlan.efficiencyPercentage >= 90
                  ? 'text-emerald-700'
                  : barPlan.efficiencyPercentage >= 75
                  ? 'text-blue-700'
                  : 'text-amber-700'
              }`}
            >
              {barPlan.efficiencyPercentage}%
            </strong>
          </div>
          <span className="text-slate-200">|</span>
          <div>
            <span className="text-slate-400">Piezas:</span>{' '}
            <strong className="text-slate-800 font-bold">{barPlan.cuts.length}</strong>
          </div>
          <span className="text-slate-200">|</span>
          <div>
            {barPlan.isReusableOffcut ? (
              <span className="text-emerald-700 font-bold">
                Retazo útil: <strong>{barPlan.remainingMm} mm</strong>
                {repeatCount > 1 && (
                  <span className="text-slate-400 font-normal"> (×{repeatCount} = {barPlan.remainingMm * repeatCount} mm total)</span>
                )}
              </span>
            ) : (
              <span className="text-slate-500">
                Merma: <strong>{barPlan.remainingMm} mm</strong>
                {repeatCount > 1 && (
                  <span className="text-slate-400 font-normal"> (×{repeatCount} = {barPlan.remainingMm * repeatCount} mm total)</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 1D Visual Bar Container (GoNest 1D Representation) */}
      <div className="relative my-2">
        {/* Rulers / Scale indicators */}
        <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1 px-0.5 font-medium">
          <span>0 mm (Cabezal)</span>
          <span>{totalLength} mm (Largo Total)</span>
        </div>

        {/* The Bar Track */}
        <div className="h-14 sm:h-16 w-full bg-slate-100 rounded-xl p-1 border border-slate-300 flex items-stretch overflow-hidden shadow-inner relative select-none">
          {/* Trim cut indicator */}
          {barPlan.trimCutMm > 0 && (
            <div
              style={{ width: `${Math.max(1.5, trimPercent)}%` }}
              className="bg-slate-300 border-r border-slate-400 flex items-center justify-center text-[9px] text-slate-700 font-mono overflow-hidden relative"
              title={`Saneo Inicial: ${barPlan.trimCutMm} mm`}
            >
              <div className="rotate-90 sm:rotate-0 tracking-tighter font-bold">
                {barPlan.trimCutMm}
              </div>
            </div>
          )}

          {/* Pieces cut along the bar */}
          {barPlan.cuts.map((cut, idx) => {
            const pieceWidthPercent = (cut.lengthMm / totalLength) * 100;
            const cutKey = `${barPlan.id}_${cut.cutIndex}`;
            const isDone = completedCuts?.has(cutKey);

            return (
              <div
                key={cut.pieceId}
                style={{ width: `${pieceWidthPercent}%` }}
                onMouseEnter={() => setHoveredPiece(cut)}
                onMouseLeave={() => setHoveredPiece(null)}
                className={`relative flex flex-col justify-center items-center px-1 border-r-2 border-white transition-all cursor-pointer overflow-hidden ${
                  isDone ? 'opacity-40 grayscale' : 'hover:brightness-105'
                }`}
              >
                {/* Background colored bar */}
                <div
                  className="absolute inset-0 opacity-90 transition-opacity"
                  style={{ backgroundColor: cut.color }}
                />

                {/* Content inside piece block */}
                <div className="relative z-10 text-center text-white px-0.5 max-w-full drop-shadow-sm font-sans">
                  <div className="font-bold text-[11px] sm:text-xs truncate tracking-tight">
                    {cut.label}
                  </div>
                  <div className="font-mono text-[10px] sm:text-xs font-bold text-white/95">
                    {cut.lengthMm} mm
                  </div>
                </div>

                {/* Cut number badge */}
                <div className="absolute top-1 left-1 bg-black/50 text-[9px] text-white font-mono px-1 rounded-sm font-bold">
                  #{cut.cutIndex}
                </div>

                {/* Checkmark if cut is marked done */}
                {isDone && (
                  <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-400 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Remaining End Portion (Reusable Offcut or Scrap Waste) */}
          {barPlan.remainingMm > 0 && (
            <div
              style={{ width: `${Math.max(2, remainingPercent)}%` }}
              className={`relative flex flex-col justify-center items-center px-1 overflow-hidden transition-all ${
                barPlan.isReusableOffcut
                  ? 'bg-emerald-100 border-2 border-dashed border-emerald-500 text-emerald-900 font-bold'
                  : 'bg-slate-200 border-2 border-dashed border-slate-400 text-slate-600'
              }`}
              title={
                barPlan.isReusableOffcut
                  ? `Retazo Aprovechable: ${barPlan.remainingMm} mm (se guardará en bodega)`
                  : `Merma / Descarte: ${barPlan.remainingMm} mm`
              }
            >
              <div className="text-[10px] font-mono font-black truncate">
                {barPlan.remainingMm} mm
              </div>
              <div className="text-[8px] uppercase tracking-tighter truncate font-bold opacity-80">
                {barPlan.isReusableOffcut ? '♻️ Retazo' : 'Merma'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Operator Cut Sequence & Stop Gauge Table */}
      <div className="mt-3 pt-2">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="flex items-center gap-1 font-bold text-slate-700">
            <Scissors className="w-3.5 h-3.5 text-blue-600" />
            <span>Secuencia de Corte & Topes de Sierra:</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Sangría Kerf: {barPlan.kerfTotalMm > 0 ? `${barPlan.cuts.length - 1} cortes` : '0 mm'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {barPlan.cuts.map((cut) => {
            const cutKey = `${barPlan.id}_${cut.cutIndex}`;
            const isDone = completedCuts?.has(cutKey);

            return (
              <button
                key={cut.pieceId}
                onClick={() => onMarkCutDone && onMarkCutDone(barPlan.id, cut.cutIndex)}
                className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                  isDone
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 line-through opacity-70'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-blue-500 hover:bg-blue-50/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold font-mono text-blue-700">
                    Corte #{cut.cutIndex}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: cut.color }}
                  />
                </div>
                <div className="font-bold truncate text-slate-900" title={cut.label}>
                  {cut.label}
                </div>
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                  Largo: <strong>{cut.lengthMm} mm</strong>
                </div>
                <div className="text-[10px] text-blue-900 font-mono font-bold mt-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
                  Tope: {cut.stopPositionMm} mm
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hovered piece quick inspector */}
      {hoveredPiece && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs flex items-center gap-2.5 text-blue-950 animate-fadeIn font-medium">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <strong>Pieza {hoveredPiece.label}</strong>: {hoveredPiece.lengthMm} mm • Posición acumulada de corte con tope de sierra: <strong>{hoveredPiece.stopPositionMm} mm</strong>
          </div>
        </div>
      )}
    </div>
  );
};
