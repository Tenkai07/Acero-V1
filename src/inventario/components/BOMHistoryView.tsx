import { useState, useMemo } from 'react';
import { BOMProject, BOMProfileGroup, MaterialStockItem } from '../types';
import * as XLSX from 'xlsx';
import {
  FolderClock,
  Search,
  Calendar,
  User,
  Hash,
  Play,
  Trash2,
  Share2,
  Printer,
  FileSpreadsheet,
  Plus,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Hammer,
  AlertCircle,
  Copy,
  Info
} from 'lucide-react';

interface BOMHistoryViewProps {
  projects: BOMProject[];
  onLoadProject: (project: BOMProject) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateProjectStatus: (projectId: string, newStatus: BOMProject['status']) => void;
  onOpenSaveModal: () => void;
  currentGroupsCount: number;
}

export const BOMHistoryView = ({
  projects,
  onLoadProject,
  onDeleteProject,
  onUpdateProjectStatus,
  onOpenSaveModal,
  currentGroupsCount
}: BOMHistoryViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'reales' | 'teoricas'>('todos');

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.client && p.client.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.workOrder && p.workOrder.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'todos' || p.status === statusFilter;
      const matchTipo = tipoFilter === 'todos' || (tipoFilter === 'reales' ? p.esReal === true : p.esReal !== true);

      return matchSearch && matchStatus && matchTipo;
    });
  }, [projects, searchTerm, statusFilter, tipoFilter]);

  const handleExportProjectExcel = (proj: BOMProject) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumen General
    const summaryData = [
      ['PROYECTO CUBICACIÓN ESTRUCTURAL - MAESTRANZA NEST 1D'],
      [''],
      ['Nombre Proyecto', proj.name],
      ['Cliente / Mandante', proj.client || 'N/A'],
      ['N° Orden de Trabajo', proj.workOrder || 'N/A'],
      ['Fecha', proj.date],
      ['Estado', proj.status || 'guardado'],
      ['Total Perfiles Distintos', proj.totalProfilesCount],
      ['Total Piezas a Cortar', proj.totalPiecesCount],
      ['Peso Total Estructura (kg)', proj.totalWeightKg],
      ['Barras Teóricas Comerciales', proj.totalBarsTheoretical],
      ['Barras Faltantes a Comprar', proj.totalBarsToBuy],
      ['Observaciones', proj.notes || '']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_Proyecto');

    // Sheet 2: Detalle por Perfil
    const profileHeaders = [
      'Código Perfil',
      'Nombre',
      'Cant. Piezas',
      'Metros Totales',
      'Peso (kg)',
      'Largo Barra (mm)',
      'Barras Requeridas',
      'Barras a Comprar'
    ];
    const profileRows = proj.groups.map((g) => [
      g.cleanProfileCode,
      g.profileName,
      g.totalPiecesCount,
      (g.totalLengthMm / 1000).toFixed(2),
      g.totalWeightKg.toFixed(2),
      g.commercialBarLengthMm,
      g.pureTheoreticalNestingResult?.totalBarsUsed || g.nestingResult?.totalBarsUsed || 0,
      g.stockComparison?.barsToBuy || 0
    ]);
    const wsProfiles = XLSX.utils.aoa_to_sheet([profileHeaders, ...profileRows]);
    XLSX.utils.book_append_sheet(wb, wsProfiles, 'Perfiles_Cubicacion');

    // Sheet 3: Lista de Piezas
    const piecesHeaders = ['Código Perfil', 'Marca / Tag', 'Largo (mm)', 'Cantidad', 'Calidad'];
    const piecesRows: any[] = [];
    proj.groups.forEach((g) => {
      g.pieces.forEach((p) => {
        piecesRows.push([g.cleanProfileCode, p.itemNumber || p.id, p.lengthMm, p.quantity, p.grade || 'A36']);
      });
    });
    const wsPieces = XLSX.utils.aoa_to_sheet([piecesHeaders, ...piecesRows]);
    XLSX.utils.book_append_sheet(wb, wsPieces, 'Lista_Piezas_Corte');

    const cleanFilename = proj.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Cubicacion_${cleanFilename}.xlsx`);
  };

  const handleShareWhatsApp = (proj: BOMProject) => {
    const text =
      `*📐 PROYECTO CUBICACIÓN MAESTRANZA*\n` +
      `*Proyecto:* ${proj.name}\n` +
      (proj.client ? `*Cliente:* ${proj.client}\n` : '') +
      (proj.workOrder ? `*OT / Ref:* ${proj.workOrder}\n` : '') +
      `*Fecha:* ${proj.date}\n` +
      `*Total Perfiles:* ${proj.totalProfilesCount} (${proj.totalPiecesCount} piezas)\n` +
      `*Peso Total:* ${proj.totalWeightKg} kg\n` +
      `*Barras a Comprar:* ${proj.totalBarsToBuy > 0 ? `${proj.totalBarsToBuy} barras` : '0 (Cubierto con Bodega)'}\n\n` +
      `_Generado desde MaestranzaNest 1D_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'cotizacion':
        return (
          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>En Cotización</span>
          </span>
        );
      case 'en_fabricacion':
        return (
          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <Hammer className="w-3 h-3 text-blue-600" />
            <span>En Fabricación</span>
          </span>
        );
      case 'completado':
        return (
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Fabricado</span>
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <span>Guardado</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <FolderClock className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Historial de Cubicaciones & Proyectos
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Accede a todos los proyectos guardados, consulta cubicaciones pasadas, descárgalas en Excel o cárgalas para re-anidar.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentGroupsCount > 0 && (
            <button
              onClick={onOpenSaveModal}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar Cubicación Actual</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre de proyecto, cliente, N° de OT, notas..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value as 'todos' | 'reales' | 'teoricas')}
            className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="todos">Reales y Teóricas</option>
            <option value="reales">✅ Solo Reales</option>
            <option value="teoricas">🧪 Solo Teóricas</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="todos">Todos los Estados ({projects.length})</option>
            <option value="cotizacion">📋 En Cotización</option>
            <option value="en_fabricacion">⚙️ En Fabricación</option>
            <option value="completado">✅ Completados</option>
            <option value="guardado">📁 Guardados</option>
          </select>
        </div>
      </div>

      {/* Project Cards List */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-xs">
          <FolderClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            {projects.length === 0
              ? 'Aún no tienes proyectos guardados en el historial'
              : 'No se encontraron proyectos con ese filtro'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {projects.length === 0
              ? 'Cuando tengas cubicada una estructura en la pestaña "1. Importar Planilla" o "3. Pre-Anidado", presiona "Guardar Proyecto".'
              : 'Prueba cambiando el texto de búsqueda o el selector de estado.'}
          </p>

          {currentGroupsCount > 0 && projects.length === 0 && (
            <button
              onClick={onOpenSaveModal}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar Cubicación Activa Ahora</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((proj) => {
            return (
              <div
                key={proj.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between gap-4 relative group"
              >
                {/* Card Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getStatusBadge(proj.status)}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          proj.esReal
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300'
                        }`}
                      >
                        {proj.esReal ? '✅ Real' : '🧪 Teórica'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{proj.date}</span>
                    </span>
                  </div>

                  <h3 className="font-black text-slate-900 text-base line-clamp-2" title={proj.name}>
                    {proj.name}
                  </h3>

                  {(proj.client || proj.workOrder) && (
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {proj.client && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-slate-700">{proj.client}</span>
                        </div>
                      )}
                      {proj.workOrder && (
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <span className="font-mono text-slate-600">OT: {proj.workOrder}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {proj.notes && (
                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                      "{proj.notes}"
                    </p>
                  )}
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Perfiles</span>
                    <span className="font-bold text-slate-800">{proj.totalProfilesCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Piezas</span>
                    <span className="font-bold text-slate-800">{proj.totalPiecesCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Peso Acero</span>
                    <span className="font-bold text-slate-800">{proj.totalWeightKg} kg</span>
                  </div>
                </div>

                {/* Purchase Alert Box */}
                <div
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-between ${
                    proj.totalBarsToBuy > 0
                      ? 'bg-rose-50 border border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}
                >
                  <span>
                    {proj.totalBarsToBuy > 0
                      ? `Comprar: ${proj.totalBarsToBuy} barras`
                      : '✅ 100% Stock en Bodega'}
                  </span>
                  <span className="text-[10px] opacity-75">
                    Teórico: {proj.totalBarsTheoretical} b.
                  </span>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleShareWhatsApp(proj)}
                      className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Compartir por WhatsApp"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExportProjectExcel(proj)}
                      className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Descargar Planilla Excel de este proyecto"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Estás seguro de eliminar el proyecto "${proj.name}" del historial?`)) {
                          onDeleteProject(proj.id);
                        }
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Eliminar de historial"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => onLoadProject(proj)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Cargar Proyecto</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
