import React, { useState } from "react";
import { 
  ShieldCheck, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Moon, 
  Sun, 
  FolderKanban,
  Palette,
  Sliders,
  DollarSign,
  Smartphone,
  UserCircle,
  LogOut,
  Users
} from "lucide-react";
import { VisualThemePreset } from "./ThemeStudioModal";

interface HeaderUser {
  username: string;
  fullName: string;
  role: "admin" | "operador";
}

interface HeaderProps {
  isDarkMode?: boolean;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  setDarkMode?: (val: boolean) => void;
  syncStatus?: string | { status: string; isSyncing?: boolean };
  onManualSync?: () => void;
  activeProjectName?: string;
  projectItemsCount?: number;
  activeProjectCount?: number;
  onOpenProjects: () => void;
  currentTheme?: VisualThemePreset;
  onOpenThemeModal?: () => void;
  basePriceKgCLP?: number;
  onOpenInstallModal?: () => void;
  currentUser?: HeaderUser | null;
  isAdmin?: boolean;
  onLogout?: () => void;
  onOpenUserManagement?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDarkMode,
  darkMode,
  onToggleDarkMode,
  setDarkMode,
  syncStatus = "synced",
  onManualSync,
  activeProjectName,
  projectItemsCount = 0,
  activeProjectCount = 0,
  onOpenProjects,
  currentTheme = "titanium-dark",
  onOpenThemeModal,
  basePriceKgCLP = 1420,
  onOpenInstallModal,
  currentUser,
  isAdmin,
  onLogout,
  onOpenUserManagement
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const currentDarkMode = isDarkMode ?? darkMode ?? true;
  const toggleTheme = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else if (setDarkMode) {
      setDarkMode(!currentDarkMode);
    }
  };

  let statusStr = "synced";
  let isSyncing = false;
  if (typeof syncStatus === "string") {
    statusStr = syncStatus;
    isSyncing = syncStatus === "syncing";
  } else if (syncStatus && typeof syncStatus === "object") {
    statusStr = (syncStatus as { status: string }).status || "synced";
    isSyncing = statusStr === "syncing" || Boolean((syncStatus as { isSyncing?: boolean }).isSyncing);
  }
  const itemsCount = projectItemsCount || activeProjectCount;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        
        {/* Brand & App Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-sky-400 via-blue-600 to-slate-900 flex items-center justify-center shadow-lg shadow-sky-950/40 text-white font-black text-lg tracking-tighter border border-sky-400/30 shrink-0">
            <span className="text-xs sm:text-sm font-black">CL</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-white leading-tight flex items-center gap-1.5">
                Aceros Chile
                <span className="text-[10px] uppercase font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded">
                  NCh 203 / 204
                </span>
              </h1>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block">
              Calculadoras Técnicas, Manual de Perfiles HEA & Cubicaciones
            </p>
          </div>
        </div>

        {/* Action Controls, Theme Customizer & Sync */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Base Price Badge */}
          {basePriceKgCLP && (
            <div 
              onClick={onOpenThemeModal}
              title="Click para ajustar precio base referencial"
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono cursor-pointer hover:border-sky-500/50 transition-colors"
            >
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span>Base: <strong className="text-emerald-400">${basePriceKgCLP}</strong>/kg</span>
            </div>
          )}

          {/* Admin: User Management */}
          {isAdmin && onOpenUserManagement && (
            <button
              type="button"
              onClick={onOpenUserManagement}
              title="Gestión de Usuarios"
              className="hidden sm:flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 hover:border-amber-400 transition-all cursor-pointer shadow-sm"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Usuarios</span>
            </button>
          )}

          {/* Install on Mobile App Button */}
          {onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              title="Instalar como Aplicación en Celular Android"
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 hover:border-sky-300 transition-all cursor-pointer shadow-sm"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span>Instalar en Celular</span>
            </button>
          )}

          {/* Theme Studio / Visual Style Trigger */}
          {onOpenThemeModal && (
            <button
              type="button"
              onClick={onOpenThemeModal}
              title="Cambiar apariencia visual, tema y densidad"
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-sky-400 border border-sky-500/30 hover:border-sky-400 transition-all cursor-pointer shadow-sm"
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Estilo Visual</span>
            </button>
          )}

          {/* Cloud Sync Indicator & Trigger */}
          <button
            type="button"
            onClick={onManualSync}
            disabled={isSyncing}
            title={statusStr === "synced" ? "Sincronizado con la nube" : "Click para sincronizar con la nube"}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              statusStr === "synced"
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50"
                : isSyncing
                ? "bg-sky-950/50 text-sky-300 border-sky-800 animate-pulse"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
            ) : statusStr === "synced" ? (
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden md:inline">
              {isSyncing
                ? "Sincronizando..."
                : statusStr === "synced"
                ? "Nube OK"
                : "Sincronizar"}
            </span>
          </button>

          {/* Active Project Quick Button */}
          <button
            type="button"
            onClick={onOpenProjects}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md transition-all cursor-pointer"
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {activeProjectName ? activeProjectName : "Cubicación"}
            </span>
            {itemsCount > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-950 text-sky-300 text-[10px] font-black rounded-full">
                {itemsCount}
              </span>
            )}
          </button>

          {/* Current User & Logout */}
          {currentUser && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((v) => !v)}
                title={currentUser.fullName || currentUser.username}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all cursor-pointer shadow-sm"
              >
                <UserCircle className="w-4 h-4 text-sky-400" />
                <span className="hidden lg:inline max-w-[100px] truncate">
                  {currentUser.fullName || currentUser.username}
                </span>
              </button>
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-slate-800">
                      <p className="text-xs font-bold text-white truncate">
                        {currentUser.fullName || currentUser.username}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        @{currentUser.username} · {currentUser.role === "admin" ? "Administrador" : "Operador"}
                      </p>
                    </div>
                    {isAdmin && onOpenUserManagement && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserManagement();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer sm:hidden"
                      >
                        <Users className="w-3.5 h-3.5 text-amber-400" /> Gestión de Usuarios
                      </button>
                    )}
                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

      </div>
    </header>
  );
};
