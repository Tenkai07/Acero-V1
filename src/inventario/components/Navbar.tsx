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

  const tabs = [
    {
      id: 'importar',
      label: '1. Importar Planilla (BOM)',
      shortLabel: '1. Importar',
      icon: FileSpreadsheet,
      badge: totalProfilesLoaded > 0 ? `${totalProfilesLoaded} perfiles` : undefined,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      id: 'empalmes',
      label: '2. Medidas & Empalmes',
      shortLabel: '2. Empalmes',
      icon: Scissors
    },
    {
      id: 'preanidado',
      label: '3. Pre-Anidado & Stock',
      shortLabel: '3. Pre-Anidado',
      icon: Cpu,
      badge: totalBarsToBuy > 0 ? `Comprar: ${totalBarsToBuy} b.` : undefined,
      badgeColor: totalBarsToBuy > 0 ? 'bg-rose-100 text-rose-800 border-rose-200 font-bold animate-pulse' : undefined
    },
    {
      id: 'compras',
      label: '4. Orden de Compra & Taller',
      shortLabel: '4. Compras',
      icon: ShoppingCart
    },
    {
      id: 'historial',
      label: '5. Historial de Proyectos',
      shortLabel: '5. Historial',
      icon: FolderClock,
      badge: savedProjectsCount > 0 ? `${savedProjectsCount}` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    {
      id: 'inventario',
      label: '6. Base de Datos / Bodega',
      shortLabel: '6. Bodega',
      icon: Database,
      badge: `${totalStandardBars} b. / ${totalOffcuts} ret.`,
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
    }
  ];

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

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-100 py-1.5 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.shortLabel}</span>

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
            );
          })}
        </nav>
      </div>
    </header>
  );
};
