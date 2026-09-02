import React from "react";
import {
  Square,
  Box,
  Layers,
  FoldHorizontal,
  BookOpen,
  ArrowRightLeft,
  ShoppingBag,
  BookMarked,
  FolderKanban,
  FileBox,
  Warehouse,
  BarChart3,
  LayoutDashboard
} from "lucide-react";
import { NavigationTab } from "../types";

interface NavigationProps {
  activeTab: NavigationTab;
  onSelectTab?: (tab: NavigationTab) => void;
  setActiveTab?: (tab: NavigationTab) => void;
  projectsCount?: number;
  historyCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  setActiveTab,
  projectsCount = 0,
  historyCount = 0
}) => {
  const handleTabClick = (tab: NavigationTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  const navItems: {
    id: NavigationTab;
    label: string;
    shortLabel: string;
    subLabel: string;
    icon: React.ElementType;
    badge?: number;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      shortLabel: "Dashboard",
      subLabel: "Resumen Bodega, Cubicación & Rentabilidad",
      icon: LayoutDashboard
    },
    {
      id: "pieces",
      label: "Piezas a Medida",
      shortLabel: "Piezas",
      subLabel: "Ejes, Bujes, Bloques, Discos",
      icon: Box
    },
    {
      id: "plates",
      label: "Placas & Planchas",
      shortLabel: "Planchas",
      subLabel: "Densidad 8.0 & Formatos",
      icon: Square
    },
    {
      id: "profiles",
      label: "Perfiles & Vigas",
      shortLabel: "Perfiles",
      subLabel: "HEA, W, IN, UPN, Tubos",
      icon: Layers
    },
    {
      id: "folding",
      label: "Plegado Canal",
      shortLabel: "Plegado",
      subLabel: "Desarrollo y Factor K",
      icon: FoldHorizontal
    },
    {
      id: "manual",
      label: "Manual Perfiles CAD",
      shortLabel: "Manual",
      subLabel: "Cotas y Secciones en Vivo",
      icon: BookOpen
    },
    {
      id: "converter",
      label: "Conversor Técnico",
      shortLabel: "Conversor",
      subLabel: "Pulgadas, mm, Pies, Peso",
      icon: ArrowRightLeft
    },
    {
      id: "cnc",
      label: "Visor CNC",
      shortLabel: "CNC",
      subLabel: "DXF & NC1/DSTV, Plano y 3D",
      icon: FileBox
    },
    {
      id: "catalog",
      label: "Catálogo & Precios",
      shortLabel: "Catálogo",
      subLabel: "Identificación en Taller, Precios",
      icon: ShoppingBag
    },
    {
      id: "icha",
      label: "Catálogo ICHA",
      shortLabel: "ICHA",
      subLabel: "309 perfiles, doble designación, J y Cw",
      icon: BookMarked
    },
    {
      id: "cubicacion",
      label: "Cubicación & Bodega",
      shortLabel: "Cubicación",
      subLabel: "BOM, Empalmes, Anidado, Compras",
      icon: Warehouse
    },
    {
      id: "projects",
      label: "Proyectos & Historial",
      shortLabel: "Proyectos",
      subLabel: "Presupuestos y Cálculos Guardados",
      icon: FolderKanban,
      badge: projectsCount > 0 ? projectsCount : (historyCount > 0 ? historyCount : undefined)
    },
    {
      id: "reports",
      label: "Reportes",
      shortLabel: "Reportes",
      subLabel: "Inventario, Cubicación y Softland",
      icon: BarChart3
    }
  ];

  return (
    <>
      {/* Desktop & Tablet Top Navigation Bar */}
      <nav className="bg-slate-900 border-b border-slate-800 shadow-sm sticky top-[60px] z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="flex space-x-1 py-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-medium transition-all whitespace-nowrap cursor-pointer relative select-none ${
                    isActive
                      ? "bg-sky-500 text-slate-950 font-bold shadow-md ring-1 ring-sky-400"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-slate-950" : "text-sky-400"}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                        isActive
                          ? "bg-slate-950 text-sky-300"
                          : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (Optimized for Touch) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-safe shadow-2xl">
        <div className="flex overflow-x-auto no-scrollbar h-16 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                type="button"
                onClick={() => handleTabClick(item.id)}
                className={`flex flex-col items-center justify-center min-w-[62px] px-1 relative py-1 transition-all cursor-pointer select-none active:scale-95 flex-shrink-0 ${
                  isActive
                    ? "text-sky-400 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? "text-sky-400 scale-110 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]" : "text-slate-400"}`} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center ring-2 ring-slate-900">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] mt-1 truncate max-w-[58px] text-center leading-tight tracking-tight ${isActive ? "font-bold text-sky-300" : "text-slate-400"}`}>
                  {item.shortLabel}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 w-8 h-1 bg-sky-400 rounded-t-full shadow-[0_-1px_6px_rgba(56,189,248,0.8)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
