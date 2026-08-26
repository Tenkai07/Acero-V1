import { useState, FormEvent } from 'react';
import { BOMProfileGroup, BOMProject, OptimizationSettings } from '../types';
import { BookmarkPlus, X, Check, FileText, User, Hash, Calendar } from 'lucide-react';

interface SaveProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: BOMProfileGroup[];
  settings: OptimizationSettings;
  onSave: (project: BOMProject) => void;
}

export const SaveProjectModal = ({
  isOpen,
  onClose,
  groups,
  settings,
  onSave
}: SaveProjectModalProps) => {
  const [projectName, setProjectName] = useState('');
  const [client, setClient] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'cotizacion' | 'en_fabricacion' | 'completado' | 'guardado'>('cotizacion');
  const [esReal, setEsReal] = useState<boolean>(false);

  if (!isOpen) return null;

  const totalPiecesCount = groups.reduce((s, g) => s + g.totalPiecesCount, 0);
  const totalWeightKg = Number(groups.reduce((s, g) => s + g.totalWeightKg, 0).toFixed(1));
  const totalBarsTheoretical = groups.reduce(
    (s, g) => s + (g.pureTheoreticalNestingResult?.totalBarsUsed || g.nestingResult?.totalBarsUsed || 0),
    0
  );
  const totalBarsToBuy = groups.reduce(
    (s, g) => s + (g.stockComparison?.barsToBuy || 0),
    0
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      alert('Por favor ingresa un nombre para el proyecto.');
      return;
    }

    const newProject: BOMProject = {
      id: `proj-${Date.now()}`,
      name: projectName.trim(),
      client: client.trim() || undefined,
      workOrder: workOrder.trim() || undefined,
      date: new Date().toISOString().split('T')[0],
      notes: notes.trim() || undefined,
      totalProfilesCount: groups.length,
      totalPiecesCount,
      totalWeightKg,
      totalBarsTheoretical,
      totalBarsToBuy,
      groups: JSON.parse(JSON.stringify(groups)),
      settings: { ...settings },
      createdAt: new Date().toISOString(),
      status,
      esReal
    };

    onSave(newProject);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BookmarkPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Guardar Proyecto en Historial
              </h2>
              <p className="text-xs text-slate-500">
                Almacena esta cubicación para revisarla, reimprimirla o recargarla en el futuro.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Nombre del Proyecto / Estructura <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ej: Galpón Principal Módulos A-B, Tinglado 30x15m, Pasarela..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Cliente / Mandante:
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Ej: Constructora del Sur"
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                N° Orden de Trabajo (OT) / Ref:
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={workOrder}
                  onChange={(e) => setWorkOrder(e.target.value)}
                  placeholder="Ej: OT-2026-084"
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              ¿Esta cubicación es real o teórica? *
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Importante para que el informe mensual no mezcle consumo/costo real con estimaciones que
              podrían no concretarse.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEsReal(true)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition ${
                  esReal ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                ✅ Real (se va a ejecutar/comprar)
              </button>
              <button
                type="button"
                onClick={() => setEsReal(false)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition ${
                  !esReal ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                🧪 Teórica (cotización/estimación)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Estado del Proyecto:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="cotizacion">📋 En Cotización</option>
                <option value="en_fabricacion">⚙️ En Fabricación (Taller)</option>
                <option value="completado">✅ Fabricación Completada</option>
                <option value="guardado">📁 Guardado de Respaldo</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Fecha Registro:
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  disabled
                  value={new Date().toLocaleDateString('es-CL')}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-100 border border-slate-300 rounded-xl text-slate-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Notas / Observaciones del Proyecto:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles sobre cortes con ángulo, soldaduras especiales, despachos..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Quick Metrics Summary */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-blue-700 block font-semibold">Perfiles / Piezas</span>
              <span className="font-extrabold text-blue-950 text-sm">
                {groups.length} / {totalPiecesCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-blue-700 block font-semibold">Peso Estructura</span>
              <span className="font-extrabold text-blue-950 text-sm">{totalWeightKg} kg</span>
            </div>
            <div>
              <span className="text-[10px] text-blue-700 block font-semibold">Barras a Comprar</span>
              <span className={`font-extrabold text-sm ${totalBarsToBuy > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {totalBarsToBuy > 0 ? `${totalBarsToBuy} b.` : '0 (Stock)'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Guardar en Historial</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
