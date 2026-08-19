import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { CustomPiecesCalculator } from "./components/calculators/CustomPiecesCalculator";
import { PlateCalculator } from "./components/calculators/PlateCalculator";
import { LinearWeightCalculator } from "./components/calculators/LinearWeightCalculator";
import { ChannelFoldingCalculator } from "./components/calculators/ChannelFoldingCalculator";
import { InteractiveProfileManual } from "./components/manual/InteractiveProfileManual";
import { UnitConverter } from "./components/calculators/UnitConverter";
import { lazy, Suspense } from "react";
const CncViewer = lazy(() => import("./components/cnc/CncViewer").then((m) => ({ default: m.CncViewer })));
import { SteelCatalogAndPrices } from "./components/catalog/SteelCatalogAndPrices";
import { ProjectsAndHistory } from "./components/history/ProjectsAndHistory";
import { ThemeStudioModal, VisualThemePreset, UIDensity } from "./components/ThemeStudioModal";
import { InstallModal } from "./components/InstallModal";
import { UserManagementModal } from "./components/admin/UserManagementModal";
import { 
  getProjects, 
  saveProject, 
  deleteProject as deleteProjectStorage, 
  getHistory, 
  saveHistoryItem, 
  deleteHistoryItem as deleteHistoryItemStorage, 
  clearHistory as clearHistoryStorage, 
  syncWithCloud 
} from "./utils/syncStorage";
import { authFetch } from "./utils/authToken";
import { useAuth } from "./context/AuthContext";
import { CalculationHistoryItem, NavigationTab, SteelProject, SteelProjectItem } from "./types";

export function AuthenticatedApp() {
  const { user, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<NavigationTab>("plates");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [visualTheme, setVisualTheme] = useState<VisualThemePreset>("titanium-dark");
  const [uiDensity, setUiDensity] = useState<UIDensity>("compact");
  const [basePriceKgCLP, setBasePriceKgCLP] = useState<number>(1420);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState<boolean>(false);
  
  // Storage & Sync State
  const [projects, setProjects] = useState<SteelProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline" | "error">("synced");

  // Initialize Theme, Density & Load Initial Data
  useEffect(() => {
    const savedTheme = localStorage.getItem("aceros_chile_visual_theme") as VisualThemePreset || "titanium-dark";
    setVisualTheme(savedTheme);

    const savedDensity = localStorage.getItem("aceros_chile_density") as UIDensity || "compact";
    setUiDensity(savedDensity);

    const savedPrice = localStorage.getItem("aceros_chile_base_price");
    if (savedPrice) {
      setBasePriceKgCLP(parseInt(savedPrice) || 1420);
    }

    if (savedTheme === "clean-light") {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    // Load projects and history from local storage
    const loadedProjects = getProjects();
    setProjects(loadedProjects);
    if (loadedProjects.length > 0) {
      setActiveProjectId(loadedProjects[0].id);
    }

    const loadedHistory = getHistory();
    setHistory(loadedHistory);

    // Load the shared base price from the server (admin-controlled setting)
    authFetch("/api/settings/base-price")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.basePriceKgCLP) {
          setBasePriceKgCLP(data.basePriceKgCLP);
          localStorage.setItem("aceros_chile_base_price", String(data.basePriceKgCLP));
        }
      })
      .catch(() => {
        // Si falla, se mantiene el valor guardado localmente
      });

    // Initial background cloud sync
    triggerCloudSync();
  }, []);

  const handleSelectVisualTheme = (theme: VisualThemePreset) => {
    setVisualTheme(theme);
    localStorage.setItem("aceros_chile_visual_theme", theme);
    if (theme === "clean-light") {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  };

  const handleSelectDensity = (density: UIDensity) => {
    setUiDensity(density);
    localStorage.setItem("aceros_chile_density", density);
  };

  const handleUpdateBasePrice = (price: number) => {
    setBasePriceKgCLP(price);
    localStorage.setItem("aceros_chile_base_price", price.toString());
    if (isAdmin) {
      authFetch("/api/settings/base-price", {
        method: "PUT",
        body: JSON.stringify({ basePriceKgCLP: price })
      }).catch((err) => console.warn("No se pudo guardar el precio base en el servidor:", err));
    }
  };

  const toggleDarkMode = () => {
    if (isDarkMode) {
      handleSelectVisualTheme("clean-light");
    } else {
      handleSelectVisualTheme("titanium-dark");
    }
  };

  const triggerCloudSync = async () => {
    setSyncStatus("syncing");
    try {
      const result = await syncWithCloud();
      setProjects(result.projects);
      setHistory(result.history);
      if (result.projects.length > 0 && !activeProjectId) {
        setActiveProjectId(result.projects[0].id);
      }
      setSyncStatus("synced");
    } catch (e) {
      console.warn("Cloud sync fallback to local mode:", e);
      setSyncStatus("offline");
    }
  };

  // Add Item to Active Project
  const handleAddItemToProject = (itemData: Omit<SteelProjectItem, "id" | "createdAt">) => {
    handleAddMultipleItemsToProject([itemData]);
  };

  // Bulk-add many items at once to the active project (used by Excel cubicación imports)
  const handleAddMultipleItemsToProject = (
    itemsData: Omit<SteelProjectItem, "id" | "createdAt">[],
    targetProjectId?: string
  ) => {
    if (itemsData.length === 0) return;

    let currentProjects = [...projects];
    let activeProj = currentProjects.find((p) => p.id === (targetProjectId || activeProjectId));

    if (!activeProj) {
      // Create default project if none exists
      activeProj = {
        id: `proj-${Date.now()}`,
        name: "Cubicación de Obra 1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
        totalWeightKg: 0,
        totalPriceCLP: 0
      };
      currentProjects.push(activeProj);
      setActiveProjectId(activeProj.id);
    }

    const newItems: SteelProjectItem[] = itemsData.map((itemData, idx) => ({
      ...itemData,
      id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString()
    }));

    activeProj.items.push(...newItems);
    activeProj.totalWeightKg = Number(activeProj.items.reduce((sum, it) => sum + it.totalWeightKg, 0).toFixed(2));
    activeProj.totalPriceCLP = Math.round(activeProj.items.reduce((sum, it) => sum + it.totalPriceCLP, 0));
    activeProj.updatedAt = new Date().toISOString();

    saveProject(activeProj);
    setProjects(getProjects());

    // Background cloud sync
    triggerCloudSync();
  };

  // Save Record to History
  const handleSaveToHistory = (itemData: Omit<CalculationHistoryItem, "id" | "timestamp">) => {
    saveHistoryItem(itemData);
    setHistory(getHistory());
    triggerCloudSync();
  };

  // Project Creation
  const handleCreateProject = (name: string, client?: string, notes?: string) => {
    const newProj: SteelProject = {
      id: `proj-${Date.now()}`,
      name,
      client,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      totalWeightKg: 0,
      totalPriceCLP: 0
    };
    saveProject(newProj);
    const updated = getProjects();
    setProjects(updated);
    setActiveProjectId(newProj.id);
    triggerCloudSync();
  };

  const handleDeleteProject = (projectId: string) => {
    deleteProjectStorage(projectId);
    const updated = getProjects();
    setProjects(updated);
    if (updated.length > 0) {
      setActiveProjectId(updated[0].id);
    } else {
      setActiveProjectId(null);
    }
    triggerCloudSync();
  };

  const handleDeleteItemFromProject = (projectId: string, itemId: string) => {
    const target = projects.find((p) => p.id === projectId);
    if (!target) return;

    target.items = target.items.filter((i) => i.id !== itemId);
    target.totalWeightKg = Number(target.items.reduce((sum, it) => sum + it.totalWeightKg, 0).toFixed(2));
    target.totalPriceCLP = Math.round(target.items.reduce((sum, it) => sum + it.totalPriceCLP, 0));
    target.updatedAt = new Date().toISOString();

    saveProject(target);
    setProjects(getProjects());
    triggerCloudSync();
  };

  const handleClearHistory = () => {
    clearHistoryStorage();
    setHistory([]);
    triggerCloudSync();
  };

  const handleDeleteHistoryItem = (id: string) => {
    deleteHistoryItemStorage(id);
    setHistory(getHistory());
    triggerCloudSync();
  };

  const handleAddHistoryItemToProject = (hItem: CalculationHistoryItem) => {
    const itemType: "placa" | "perfil" | "plegado" | "personalizado" = 
      hItem.category === "conversion" ? "personalizado" : hItem.category;
    handleAddItemToProject({
      type: itemType,
      description: hItem.title,
      dimensions: hItem.summary,
      quantity: hItem.details?.quantity || 1,
      unitWeightKg: hItem.weightKg || 0,
      totalWeightKg: hItem.weightKg || 0,
      unitPriceCLP: hItem.priceCLP || 0,
      totalPriceCLP: hItem.priceCLP || 0,
      notes: `Importado desde historial`
    });
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Theme-specific container background styling
  const getThemeContainerClass = () => {
    switch (visualTheme) {
      case "clean-light":
        return "bg-slate-100 text-slate-900";
      case "blueprint-cad":
        return "dark bg-[#031926] text-sky-100";
      case "obsidian-pro":
        return "dark bg-[#07090e] text-zinc-100";
      case "titanium-dark":
      default:
        return "dark bg-slate-950 text-slate-100";
    }
  };

  return (
    <div className={`min-h-screen ${getThemeContainerClass()} flex flex-col font-sans transition-colors duration-200 relative`}>
      
      {/* Blueprint grid effect overlay if in CAD blueprint mode */}
      {visualTheme === "blueprint-cad" && (
        <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] z-0" />
      )}

      {/* Top Header */}
      <Header
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        syncStatus={syncStatus}
        onManualSync={triggerCloudSync}
        activeProjectName={activeProject?.name}
        projectItemsCount={activeProject?.items.length || 0}
        onOpenProjects={() => setActiveTab("projects")}
        currentTheme={visualTheme}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        basePriceKgCLP={basePriceKgCLP}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        currentUser={user}
        isAdmin={isAdmin}
        onLogout={logout}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
      />

      {/* Main Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        projectsCount={projects.length}
        historyCount={history.length}
      />

      {/* Main App Content View Container */}
      <main className={`flex-1 max-w-7xl w-full mx-auto relative z-10 ${uiDensity === "compact" ? "p-2.5 sm:p-4 lg:p-6" : "p-4 sm:p-6 lg:p-8"} pb-24 md:pb-8`}>
        {activeTab === "pieces" && (
          <CustomPiecesCalculator
            onAddToProject={handleAddItemToProject}
            onSaveToHistory={handleSaveToHistory}
            activeProject={projects.find((p) => p.id === activeProjectId)}
          />
        )}

        {activeTab === "plates" && (
          <PlateCalculator
            onAddToProject={handleAddItemToProject}
            onSaveToHistory={handleSaveToHistory}
          />
        )}

        {activeTab === "profiles" && (
          <LinearWeightCalculator
            onAddToProject={handleAddItemToProject}
            onSaveToHistory={handleSaveToHistory}
            onSelectForManual={(p) => setActiveTab("manual")}
          />
        )}

        {activeTab === "folding" && (
          <ChannelFoldingCalculator
            onAddToProject={handleAddItemToProject}
            onSaveToHistory={handleSaveToHistory}
          />
        )}

        {activeTab === "manual" && (
          <InteractiveProfileManual
            onAddToProject={handleAddItemToProject}
            onSaveToHistory={handleSaveToHistory}
          />
        )}

        {activeTab === "converter" && (
          <UnitConverter />
        )}

        {activeTab === "cnc" && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-24 text-slate-500 text-sm gap-2">
                <span className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                Cargando visor 3D...
              </div>
            }
          >
            <CncViewer
              onAddToProject={handleAddItemToProject}
              onSaveToHistory={handleSaveToHistory}
              basePriceKgCLP={basePriceKgCLP}
            />
          </Suspense>
        )}

        {activeTab === "catalog" && (
          <SteelCatalogAndPrices />
        )}

        {activeTab === "projects" && (
          <ProjectsAndHistory
            projects={projects}
            activeProjectId={activeProjectId}
            history={history}
            syncStatus={syncStatus}
            basePriceKgCLP={basePriceKgCLP}
            onSelectProject={setActiveProjectId}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onDeleteItemFromProject={handleDeleteItemFromProject}
            onClearHistory={handleClearHistory}
            onDeleteHistoryItem={handleDeleteHistoryItem}
            onAddMultipleItemsToProject={handleAddMultipleItemsToProject}
            onTriggerSync={triggerCloudSync}
            onAddHistoryItemToProject={handleAddHistoryItemToProject}
          />
        )}
      </main>

      {/* Theme Studio Customizer Modal */}
      <ThemeStudioModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={visualTheme}
        onSelectTheme={handleSelectVisualTheme}
        density={uiDensity}
        onSelectDensity={handleSelectDensity}
        basePriceKgCLP={basePriceKgCLP}
        onUpdateBasePriceKg={handleUpdateBasePrice}
        canEditPrice={isAdmin}
      />

      {/* PWA & Mobile Phone Install Modal */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Admin: User Management Modal */}
      {isAdmin && (
        <UserManagementModal
          isOpen={isUserManagementOpen}
          onClose={() => setIsUserManagementOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-sm py-3.5 text-center text-xs text-slate-500 hidden md:block relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Aceros Chile — Normas NCh 203, NCh 204, ICHA, ASTM A6 / A500 / A53</span>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-amber-500/80">Planchas: 8.0 kg/dm³</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400/90">Base Mercado: ${basePriceKgCLP.toLocaleString("es-CL")}/kg</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
