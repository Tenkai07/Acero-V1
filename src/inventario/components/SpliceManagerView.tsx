import { useState } from 'react';
import { BOMProfileGroup, MaterialStockItem, BOMPieceItem } from '../types';
import { calculateSplices, applySpliceToPiece } from '../utils/spliceCalculator';
import {
  Scissors,
  Layers,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Plus,
  Trash2,
  Ruler,
  SplitSquareVertical,
  RotateCcw
} from 'lucide-react';

interface SpliceManagerViewProps {
  groups: BOMProfileGroup[];
  onUpdateGroups: (groups: BOMProfileGroup[]) => void;
  inventory: MaterialStockItem[];
  onProceedToPreNesting: () => void;
}

export const SpliceManagerView = ({
  groups,
  onUpdateGroups,
  inventory,
  onProceedToPreNesting
}: SpliceManagerViewProps) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [defaultOverlapMm, setDefaultOverlapMm] = useState<number>(0); // 0 mm para soldadura a tope
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const currentGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

  const handleUpdateBarLength = (groupId: string, newLengthMm: number) => {
    const next = groups.map((g) => {
      if (g.id === groupId) {
        return { ...g, commercialBarLengthMm: newLengthMm };
      }
      return g;
    });
    onUpdateGroups(next);
  };

  const handleApplyAutoSpliceToGroup = (groupId: string, maxLenMm: number, overlapMm: number) => {
    const next = groups.map((g) => {
      if (g.id === groupId) {
        let newPieces: BOMPieceItem[] = [];
        let totalCount = 0;
        let totalLen = 0;

        g.pieces.forEach((p) => {
          if (p.lengthMm > maxLenMm) {
            const splicedPieces = applySpliceToPiece(p, maxLenMm, overlapMm);
            newPieces.push(...splicedPieces);
          } else {
            newPieces.push(p);
          }
        });

        totalCount = newPieces.reduce((s, p) => s + p.quantity, 0);
        totalLen = newPieces.reduce((s, p) => s + p.lengthMm * p.quantity, 0);

        return {
          ...g,
          pieces: newPieces,
          totalPiecesCount: totalCount,
          totalLengthMm: totalLen
        };
      }
      return g;
    });

    onUpdateGroups(next);
    setStatusNotice(`¡Empalmes aplicados con éxito para el perfil!`);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleAddPieceToGroup = (groupId: string) => {
    const next = groups.map((g) => {
      if (g.id === groupId) {
        const newP: BOMPieceItem = {
          id: `pc-manual-${Date.now()}`,
          itemNumber: `Pza-${g.pieces.length + 1}`,
          grade: g.pieces[0]?.grade || 'A36',
          lengthMm: 1500,
          quantity: 1,
          weightKg: 0,
          areaM2: 0
        };
        const updatedPieces = [...g.pieces, newP];
        return {
          ...g,
          pieces: updatedPieces,
          totalPiecesCount: updatedPieces.reduce((s, p) => s + p.quantity, 0),
          totalLengthMm: updatedPieces.reduce((s, p) => s + p.lengthMm * p.quantity, 0)
        };
      }
      return g;
    });
    onUpdateGroups(next);
  };

  const handleDeletePiece = (groupId: string, pieceId: string) => {
    const next = groups.map((g) => {
      if (g.id === groupId) {
        const updatedPieces = g.pieces.filter((p) => p.id !== pieceId);
        return {
          ...g,
          pieces: updatedPieces,
          totalPiecesCount: updatedPieces.reduce((s, p) => s + p.quantity, 0),
          totalLengthMm: updatedPieces.reduce((s, p) => s + p.lengthMm * p.quantity, 0)
        };
      }
      return g;
    });
    onUpdateGroups(next);
  };

  const handleUpdatePieceField = (
    groupId: string,
    pieceId: string,
    field: 'lengthMm' | 'quantity' | 'itemNumber',
    val: any
  ) => {
    const next = groups.map((g) => {
      if (g.id === groupId) {
        const updatedPieces = g.pieces.map((p) => {
          if (p.id === pieceId) {
            return { ...p, [field]: val };
          }
          return p;
        });
        return {
          ...g,
          pieces: updatedPieces,
          totalPiecesCount: updatedPieces.reduce((s, p) => s + p.quantity, 0),
          totalLengthMm: updatedPieces.reduce((s, p) => s + p.lengthMm * p.quantity, 0)
        };
      }
      return g;
    });
    onUpdateGroups(next);
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-xs">
        <Scissors className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">No hay perfiles ni piezas cargadas</h3>
        <p className="text-sm text-slate-500 mt-1">
          Primero importa una planilla de cubicación en la pestaña "1. Importar Planilla (BOM)".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                Paso 2 de 4
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Scissors className="w-6 h-6 text-blue-600" />
                <span>Gestor de Medidas Comerciales & Empalmes</span>
              </h1>
            </div>
            <p className="text-sm text-slate-600">
              Configura el largo de barra comercial (6m / 12m) por perfil y divide piezas que excedan el largo con traslapos o soldadura a tope.
            </p>
          </div>

          <button
            onClick={onProceedToPreNesting}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 flex items-center gap-2 transition-colors self-start lg:self-center"
          >
            <span>Ir al Pre-Anidado & Stock</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {statusNotice && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Profiles Selector & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Profile Selector */}
        <div className="lg:col-span-4 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block px-1">
            Seleccionar Perfil ({groups.length})
          </label>

          <div className="space-y-2">
            {groups.map((grp) => {
              const isSelected = grp.id === currentGroup?.id;
              const hasOversizedPieces = grp.pieces.some(
                (p) => p.lengthMm > grp.commercialBarLengthMm
              );

              return (
                <button
                  key={grp.id}
                  onClick={() => setSelectedGroupId(grp.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {grp.cleanProfileCode}
                    </div>
                    <div className="text-xs text-slate-500">
                      {grp.totalPiecesCount} piezas • {(grp.totalLengthMm / 1000).toFixed(2)} m
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                      Barra: {(grp.commercialBarLengthMm / 1000)}m
                    </span>

                    {hasOversizedPieces && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Requiere Empalme</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Profile Detail, Bar Settings & Pieces Table */}
        {currentGroup && (
          <div className="lg:col-span-8 space-y-5">
            {/* Commercial Bar Length & Splice Control Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    {currentGroup.profileName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configuración de barra comercial y división de piezas largas.
                  </p>
                </div>

                {/* Commercial Bar Length Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Largo Comercial:</span>
                  <select
                    value={currentGroup.commercialBarLengthMm}
                    onChange={(e) =>
                      handleUpdateBarLength(currentGroup.id, Number(e.target.value))
                    }
                    className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={6000}>6.000 mm (6 metros)</option>
                    <option value={12000}>12.000 mm (12 metros)</option>
                    <option value={8000}>8.000 mm (8 metros)</option>
                    <option value={3000}>3.000 mm (3 metros)</option>
                  </select>
                </div>
              </div>

              {/* Long Piece Warning & Splice Auto-Split Trigger */}
              {currentGroup.pieces.some(
                (p) => p.lengthMm > currentGroup.commercialBarLengthMm
              ) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-900 text-sm">
                        ¡Pieza excede el largo comercial de {currentGroup.commercialBarLengthMm} mm!
                      </div>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Detectamos piezas de mayor longitud (ej. 26.115 mm). Puedes aplicar división automática en tramos comerciales estándar con o sin traslapo.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-slate-700">Traslapo/Empalme adicional:</span>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={defaultOverlapMm}
                        onChange={(e) => setDefaultOverlapMm(Number(e.target.value))}
                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-center font-bold"
                      />
                      <span className="text-slate-500">mm (0 = soldadura a tope)</span>
                    </div>

                    <button
                      onClick={() =>
                        handleApplyAutoSpliceToGroup(
                          currentGroup.id,
                          currentGroup.commercialBarLengthMm,
                          defaultOverlapMm
                        )
                      }
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <SplitSquareVertical className="w-4 h-4" />
                      <span>Dividir Piezas con Empalmes</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Pieces Table with In-Place Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Lista de Piezas ({currentGroup.pieces.length} ítems):
                  </span>

                  <button
                    onClick={() => handleAddPieceToGroup(currentGroup.id)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Pieza</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Marca / Nombre</th>
                        <th className="px-3 py-2 w-24">Cantidad</th>
                        <th className="px-3 py-2 w-32">Longitud (mm)</th>
                        <th className="px-3 py-2">Estado / Empalme</th>
                        <th className="px-3 py-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentGroup.pieces.map((p) => {
                        const isOversized = p.lengthMm > currentGroup.commercialBarLengthMm;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={p.itemNumber}
                                onChange={(e) =>
                                  handleUpdatePieceField(
                                    currentGroup.id,
                                    p.id,
                                    'itemNumber',
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 rounded font-medium text-slate-800"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={1}
                                value={p.quantity}
                                onChange={(e) =>
                                  handleUpdatePieceField(
                                    currentGroup.id,
                                    p.id,
                                    'quantity',
                                    Math.max(1, Number(e.target.value))
                                  )
                                }
                                className="w-20 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 rounded font-bold font-mono text-slate-900 text-center"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={10}
                                  step={1}
                                  value={p.lengthMm}
                                  onChange={(e) =>
                                    handleUpdatePieceField(
                                      currentGroup.id,
                                      p.id,
                                      'lengthMm',
                                      Number(e.target.value)
                                    )
                                  }
                                  className={`w-28 px-2 py-1 border rounded font-mono font-bold text-center ${
                                    isOversized
                                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                                      : 'bg-transparent hover:bg-white focus:bg-white border-transparent hover:border-slate-300 focus:border-blue-500 text-blue-700'
                                  }`}
                                />
                                <span className="text-slate-400 font-mono text-[11px]">mm</span>
                              </div>
                            </td>

                            <td className="px-3 py-2">
                              {p.isSpliced ? (
                                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Tramo Empalmado</span>
                                </span>
                              ) : isOversized ? (
                                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>Excede {currentGroup.commercialBarLengthMm}mm</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500">
                                  Largo estándar OK
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleDeletePiece(currentGroup.id, p.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Eliminar pieza"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
