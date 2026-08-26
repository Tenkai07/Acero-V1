import { MaterialStockItem } from '../types';
import {
  FileSpreadsheet,
  Scissors,
  Cpu,
  ShoppingCart,
  Database,
  Layers,
  Sparkles,
  Search,
  Cloud,
  FolderClock,
  BookmarkPlus
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'importar' | 'empalmes' | 'preanidado' | 'compras' | 'historial' | 'inventario';
  setActiveTab: (tab: 'importar' | 'empalmes' | 'preanidado' | 'compras' | 'historial' | 'inventario') => void;
  inventory: MaterialStockItem[];
  totalProfilesLoaded: number;
  totalBarsToBuy: number;
  savedProjectsCount: number;
  onOpenStockLookup: () => void;
  onOpenCloudGuide: () => void;
  onOpenSaveModal: () => void;
}

export const Navbar = ({
  activeTab,
  setActiveTab,
  inventory,
  totalProfilesLoaded,
  totalBarsToBuy,
  savedProjectsCount,
  onOpenStockLookup,
  onOpenCloudGuide,
  onOpenSaveModal
}: NavbarProps) => {
  const totalStandardBars = inventory.reduce((s, m) => s + m.standardBarsCount, 0);
  const totalOffcuts = inventory.reduce((s, m) => s + m.offcuts.length, 0);

  // El flujo real es lineal (1 -> 2 -> 3 -> 4), con "Empalmes" como paso
  // opcional intermedio. "Historial" y "Bodega" NO son pasos siguientes de
  // ese flujo — son secciones de referencia disponibles en cualquier
  // momento (por eso antes numerarlas "5." y "6." junto a las demás
  // confundía, sugiriendo un orden que no existe). Se agrupan aparte.
  const flowTabs = [
    {
      id: 'importar',
      step: 1,
      label: 'Importar Planilla (BOM)',
      shortLabel: 'Importar',
      icon: FileSpreadsheet,
      badge: totalProfilesLoaded > 0 ? `${totalProfilesLoaded} perfiles` : undefined,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      id: 'empalmes',
      step: 2,
      label: 'Medidas & Empalmes',
      shortLabel: 'Empalmes',
      icon: Scissors,
      optional: true,
      badge: undefined as string | undefined,
      badgeColor: undefined as string | undefined
    },
    {
      id: 'preanidado',
      step: 3,
      label: 'Pre-Anidado & Stock',
      shortLabel: 'Pre-Anidado',
      icon: Cpu,
      badge: totalBarsToBuy > 0 ? `Comprar: ${totalBarsToBuy} b.` : undefined,
      badgeColor: totalBarsToBuy > 0 ? 'bg-rose-100 text-rose-800 border-rose-200 font-bold animate-pulse' : undefined
    },
    {
      id: 'compras',
      step: 4,
      label: 'Orden de Compra & Taller',
      shortLabel: 'Compras',
      icon: ShoppingCart,
      badge: undefined as string | undefined,
      badgeColor: undefined as string | undefined
    }
  ];

  const resourceTabs = [
    {
      id: 'historial',
      label: 'Historial de Proyectos',
      shortLabel: 'Historial',
      icon: FolderClock,
      badge: savedProjectsCount > 0 ? `${savedProjectsCount}` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    {
      id: 'inventario',
      label: 'Base de Datos / Bodega',
      shortLabel: 'Bodega',
      icon: Database,
      badge: `${totalStandardBars} b. / ${totalOffcuts} ret.`,
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
    }
  ] as const;

  const activeFlowIndex = flowTabs.findIndex((t) => t.id === activeTab);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-black">
              <Layers className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                  Maestranza<span className="text-blue-600">Nest</span> 1D
                </span>
                <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-md">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  Pre-Anidado & Bodega
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Cubicación estructural • GoNest 1D • Stock vs Comprar
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
            {/* Quick Stock Lookup Button */}
            <button
              onClick={onOpenStockLookup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold border border-blue-200/80 transition-colors shadow-2xs"
              title="Consultar disponibilidad de perfiles y retazos en bodega"
            >
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">Consultar Stock Bodega</span>
              <span className="md:hidden">Consultar Stock</span>
            </button>

            {/* Cloud & Mobile Access Guide Button */}
            <button
              onClick={onOpenCloudGuide}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300 transition-colors"
              title="Ver instrucciones para instalar en celular o abrir en PC"
            >
              <Cloud className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Móvil & Nube</span>
            </button>

            {/* Save Current Project Button */}
            {totalProfilesLoaded > 0 && (
              <button
                onClick={onOpenSaveModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors shadow-xs"
                title="Guardar cubicación actual en el historial con un nombre"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Guardar Proyecto</span>
              </button>
            )}
          </div>
        </div>

        {/* Flujo principal: pasos 1-4, numerados y conectados para dejar claro
            que son secuenciales (Empalmes marcado como opcional). */}
        <nav className="flex items-center border-t border-slate-100 py-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center shrink-0">
            {flowTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isDone = idx < activeFlowIndex;

              return (
                <div key={tab.id} className="flex items-center">
                  {idx > 0 && (
                    <div className={`w-4 sm:w-6 h-0.5 shrink-0 ${isDone || isActive ? 'bg-blue-300' : 'bg-slate-200'}`} />
                  )}
                  <button
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 sm:gap-2 pl-1.5 pr-3 sm:pr-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : isDone
                        ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        isActive ? 'bg-white/25 text-white' : isDone ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {tab.step}
                    </span>
                    <Icon className={`w-4 h-4 hidden sm:block ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                    {'optional' in tab && tab.optional && (
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        opcional
                      </span>
                    )}
                    {tab.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${
                          isActive
                            ? 'bg-white/20 text-white border-white/30'
                            : tab.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Separador visual antes de las secciones de referencia */}
          <div className="w-px h-6 bg-slate-200 mx-2.5 shrink-0 hidden sm:block" />

          {/* Recursos: no son "siguientes pasos", están disponibles siempre */}
          <div className="flex items-center gap-1 shrink-0">
            {resourceTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap border border-dashed ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'text-slate-500 border-slate-300 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className="md:hidden">{tab.shortLabel}</span>
                  {tab.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${
                        isActive ? 'bg-white/20 text-white border-white/30' : tab.badgeColor
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
};
