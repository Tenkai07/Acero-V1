import React, { useState } from "react";
import { 
  FolderKanban, 
  History, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Cloud, 
  Search, 
  Check, 
  Layers, 
  ArrowRight, 
  DollarSign, 
  Weight,
  Upload
} from "lucide-react";
import { CalculationHistoryItem, SteelProject, SteelProjectItem } from "../../types";
import { exportProjectToPDF, exportProjectToExcel, exportHistoryToExcel } from "../../utils/exportUtils";
import { ImportCubicacionModal } from "./ImportCubicacionModal";

interface ProjectsAndHistoryProps {
  projects: SteelProject[];
  activeProjectId: string | null;
  history: CalculationHistoryItem[];
  syncStatus: "synced" | "syncing" | "offline" | "error";
  basePriceKgCLP?: number;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string, client?: string, notes?: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteItemFromProject: (projectId: string, itemId: string) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
  onTriggerSync: () => void;
  onAddHistoryItemToProject: (historyItem: CalculationHistoryItem) => void;
  onAddMultipleItemsToProject?: (items: Omit<SteelProjectItem, "id" | "createdAt">[], targetProjectId?: string) => void;
}

export const ProjectsAndHistory: React.FC<ProjectsAndHistoryProps> = ({
  projects,
  activeProjectId,
  history,
  syncStatus,
  basePriceKgCLP = 1420,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onDeleteItemFromProject,
  onClearHistory,
  onDeleteHistoryItem,
  onTriggerSync,
  onAddHistoryItemToProject,
  onAddMultipleItemsToProject
}) => {
  const [subTab, setSubTab] = useState<"projects" | "history">("projects");
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [newProjectClient, setNewProjectClient] = useState<string>("");
  const [newProjectNotes, setNewProjectNotes] = useState<string>("");

  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim(), newProjectClient.trim(), newProjectNotes.trim());
    setNewProjectName("");
    setNewProjectClient("");
    setNewProjectNotes("");
    setShowNewProjectModal(false);
    setFeedback("¡Nuevo proyecto creado!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleExportPDF = () => {
    if (!activeProject) return;
    exportProjectToPDF(activeProject);
    setFeedback("¡Proyecto exportado en PDF!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleExportExcel = () => {
    if (!activeProject) return;
    exportProjectToExcel(activeProject);
    setFeedback("¡Proyecto exportado en Excel!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleExportHistoryExcel = () => {
    exportHistoryToExcel(history);
    setFeedback("¡Historial exportado en Excel!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const filteredHistory = history.filter((item) => {
    const matchesCat = historyCategoryFilter === "all" || item.category === historyCategoryFilter;
    const matchesSearch = 
      item.title.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.summary.toLowerCase().includes(historySearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner with Cloud Sync */}
      <div className="bg-slate-800 dark:bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <FolderKanban className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Proyectos, Cubicaciones & Base de Datos de Historial
              </h2>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Guarda tus cubicaciones, exporta a <strong>PDF y Excel (.xlsx)</strong> y sincroniza tus cálculos automáticamente en la nube.
            </p>
          </div>

          {/* Sync Trigger & Cloud Status */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTriggerSync}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
              <span>Sincronizar Nube</span>
            </button>
            
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
              syncStatus === "synced"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : syncStatus === "syncing"
                ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}>
              <Cloud className="w-3.5 h-3.5" />
              <span>{syncStatus === "synced" ? "Sincronizado" : syncStatus === "syncing" ? "Sincronizando..." : "Local"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab("projects")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subTab === "projects"
              ? "bg-sky-500 text-slate-950 shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Cubicaciones de Proyectos ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subTab === "history"
              ? "bg-sky-500 text-slate-950 shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Historial de Cálculos Realizados ({history.length})</span>
        </button>
      </div>

      {feedback && (
        <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold text-center animate-fade-in flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4" />
          {feedback}
        </div>
      )}

      {/* Tab: Projects & Takeoffs */}
      {subTab === "projects" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Project List Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Mis Proyectos de Obra
              </span>
              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {projects.map((proj) => {
                const isSelected = activeProject?.id === proj.id;
                return (
                  <div
                    key={proj.id}
                    onClick={() => onSelectProject(proj.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-sky-500/15 border-sky-500 text-white shadow-md ring-1 ring-sky-500/40"
                        : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm text-white truncate max-w-[180px]">
                        {proj.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-sky-400">
                        {proj.totalWeightKg.toLocaleString("es-CL")} kg
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                      <span>{proj.items.length} partida(s)</span>
                      <span className="font-mono text-emerald-400">
                        ${proj.totalPriceCLP.toLocaleString("es-CL")} CLP
                      </span>
                    </div>

                    {proj.client && (
                      <div className="text-[10px] text-slate-500 mt-1">
                        Cliente: {proj.client}
                      </div>
                    )}
                  </div>
                );
              })}

              {projects.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500">
                  No hay proyectos creados aún.
                </div>
              )}
            </div>
          </div>

          {/* Active Project Details & Items Table */}
          <div className="lg:col-span-8 space-y-4">
            {activeProject ? (
              <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 space-y-5">
                
                {/* Project Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700 pb-4 gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-white">{activeProject.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeProject.client ? `Cliente: ${activeProject.client} | ` : ""}
                      {activeProject.items.length} partidas | Actualizado: {new Date(activeProject.updatedAt).toLocaleDateString("es-CL")}
                    </p>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {onAddMultipleItemsToProject && (
                      <button
                        type="button"
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Importar Excel</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel (.xlsx)</span>
                    </button>

                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteProject(activeProject.id)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-800 cursor-pointer"
                        title="Eliminar proyecto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Project Metric Totals */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Peso Total en Kilos
                    </span>
                    <span className="text-xl font-black text-sky-400 font-mono">
                      {activeProject.totalWeightKg.toLocaleString("es-CL", { minimumFractionDigits: 1 })}
                    </span>
                    <span className="text-xs text-slate-400 font-bold ml-1">kg</span>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Toneladas Métricas
                    </span>
                    <span className="text-xl font-black text-white font-mono">
                      {(activeProject.totalWeightKg / 1000).toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 font-bold ml-1">ton</span>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Presupuesto Estimado
                    </span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      ${activeProject.totalPriceCLP.toLocaleString("es-CL")}
                    </span>
                    <span className="text-xs text-slate-400 font-bold ml-1">CLP</span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Partidas / Materiales Cubicados:
                    </h4>
                  </div>

                  <div className="overflow-x-auto border border-slate-700/80 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-300 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Descripción / Medidas</th>
                          <th className="p-3 text-center">Cant.</th>
                          <th className="p-3 text-right">Peso Total</th>
                          <th className="p-3 text-right">Precio Total (CLP)</th>
                          <th className="p-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {activeProject.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-3 font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                                item.type === "placa"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  : item.type === "perfil"
                                  ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                                  : "bg-teal-500/10 text-teal-400 border-teal-500/20"
                              }`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="p-3 font-sans">
                              <div className="font-bold text-white">{item.description}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{item.dimensions}</div>
                            </td>
                            <td className="p-3 text-center font-bold text-white">{item.quantity}</td>
                            <td className="p-3 text-right font-bold text-sky-400">
                              {item.totalWeightKg.toLocaleString("es-CL")} kg
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-400">
                              ${item.totalPriceCLP.toLocaleString("es-CL")}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => onDeleteItemFromProject(activeProject.id, item.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                title="Eliminar partida"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {activeProject.items.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-slate-500 font-sans">
                              No hay partidas en esta cubicación. Utiliza las calculadoras para agregar planchas o perfiles.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                Selecciona o crea un proyecto para ver sus partidas.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab: Calculation History */}
      {subTab === "history" && (
        <div className="bg-slate-800/90 dark:bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4">
          
          {/* History Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4">
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Buscar en historial..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={historyCategoryFilter}
                onChange={(e) => setHistoryCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="all">Todas las Categorías</option>
                <option value="placa">Placas</option>
                <option value="perfil">Perfiles</option>
                <option value="plegado">Plegados</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportHistoryExcel}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar Historial</span>
              </button>

              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-800 text-xs transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

          </div>

          {/* History Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 relative group hover:border-slate-700 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-sky-400">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(item.timestamp).toLocaleString("es-CL")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteHistoryItem(item.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
                    title="Eliminar del historial"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h5 className="font-bold text-sm text-white">{item.title}</h5>
                <p className="text-xs text-slate-300">{item.summary}</p>

                <div className="flex justify-between items-center pt-2 border-t border-slate-900 text-xs">
                  <span className="font-mono font-bold text-sky-400">
                    {item.weightKg ? `${item.weightKg} kg` : ""}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => onAddHistoryItemToProject(item)}
                    className="flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    <span>Cargar a Proyecto</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {filteredHistory.length === 0 && (
              <div className="col-span-2 text-center py-12 text-slate-500 text-xs">
                No hay cálculos registrados en el historial para los filtros seleccionados.
              </div>
            )}
          </div>

        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Crear Nuevo Proyecto / Obra</h3>
            
            <form onSubmit={handleCreateProjectSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="ej. Galpón San Bernardo, Pasarela..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Cliente o Mandante (Opcional)
                </label>
                <input
                  type="text"
                  value={newProjectClient}
                  onChange={(e) => setNewProjectClient(e.target.value)}
                  placeholder="ej. Constructora del Sur SpA"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Notas de Obra (Opcional)
                </label>
                <textarea
                  value={newProjectNotes}
                  onChange={(e) => setNewProjectNotes(e.target.value)}
                  placeholder="Calidad acero requerida, ubicación de entrega..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow cursor-pointer"
                >
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Cubicación from Excel Modal */}
      {onAddMultipleItemsToProject && (
        <ImportCubicacionModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          basePriceKgCLP={basePriceKgCLP}
          onImportItems={(items) => onAddMultipleItemsToProject(items, activeProject?.id)}
        />
      )}

    </div>
  );
};
