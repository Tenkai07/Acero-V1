import { useState, useEffect, useMemo } from "react";
import {
  MaterialStockItem,
  BOMProfileGroup,
  OptimizationSettings,
  OptimizationResult,
  BOMProject
} from "./types";
import { INITIAL_STOCK, SAMPLE_USER_BOM_TEXT } from "./data/initialStock";
import { parseMultiProfileBOM } from "./utils/multiProfileBOMParser";
import { runProjectPreNesting } from "./utils/multiNestingEngine";
import {
  getLocalInventory,
  saveLocalInventory,
  persistInventory,
  getLocalBomProjects,
  saveLocalBomProjects,
  persistBomProject,
  deleteBomProjectRemote,
  syncCubicacionWithCloud
} from "./utils/cloudSync";
import { Navbar } from "./components/Navbar";
import { BOMImportView } from "./components/BOMImportView";
import { SpliceManagerView } from "./components/SpliceManagerView";
import { PreNestingStockView } from "./components/PreNestingStockView";
import { PurchaseOrderView } from "./components/PurchaseOrderView";
import { InventoryView } from "./components/InventoryView";
import { BOMHistoryView } from "./components/BOMHistoryView";
import { SaveProjectModal } from "./components/SaveProjectModal";
import { StockLookupModal } from "./components/StockLookupModal";
import { CloudAndMobileGuideModal } from "./components/CloudAndMobileGuideModal";
import { OperatorGuideModal } from "./components/OperatorGuideModal";

// Borrador de trabajo en curso (planilla BOM que se está editando ahora
// mismo, antes de guardarla como proyecto). Es información transitoria, se
// mantiene solo local — lo que sí viaja a la nube es el inventario de bodega
// y los proyectos ya guardados (ver src/inventario/utils/cloudSync.ts).
const STORAGE_KEY_BOM_GROUPS_DRAFT = "maestranza_bom_groups_v2";

/**
 * Módulo "Cubicación y Bodega": importación de BOM, empalmes, pre-anidado de
 * cortes, órdenes de compra e inventario de bodega. Portado desde la app
 * independiente "Inventario y Cubicación" y fusionado dentro de Acero-V1,
 * reutilizando su login y su base de datos para que el inventario y los
 * proyectos de cubicación queden compartidos con el resto de la maestranza.
 */
export function CubicacionModule() {
  const [activeTab, setActiveTab] = useState<
    "importar" | "empalmes" | "preanidado" | "compras" | "historial" | "inventario"
  >("importar");

  const [settings, setSettings] = useState<OptimizationSettings>({
    kerfMm: 3,
    trimCutMm: 10,
    minUsableOffcutMm: 1000,
    prioritizeOffcuts: true,
    allowMultipleStandardLengths: true,
    // Solo aplica a perfiles que NO sean ángulo (los ángulos siempre usan
    // 90mm internamente, ver getSpliceFacingLossMm en commercialLengths.ts)
    spliceFacingLossMm: 5
  });

  const [showStockLookupModal, setShowStockLookupModal] = useState(false);
  const [showCloudGuideModal, setShowCloudGuideModal] = useState(false);
  const [showSaveProjectModal, setShowSaveProjectModal] = useState(false);

  const [inventory, setInventory] = useState<MaterialStockItem[]>(() => getLocalInventory() || INITIAL_STOCK);

  const [groups, setGroups] = useState<BOMProfileGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOM_GROUPS_DRAFT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Error cargando borrador de cubicación", e);
    }
    return parseMultiProfileBOM(SAMPLE_USER_BOM_TEXT, INITIAL_STOCK);
  });

  const [savedProjects, setSavedProjects] = useState<BOMProject[]>(() => getLocalBomProjects() || []);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");
  const [isDeducted, setIsDeducted] = useState(false);

  const [operatorGuideData, setOperatorGuideData] = useState<{
    result: OptimizationResult;
    material: MaterialStockItem;
  } | null>(null);

  // Sincronización inicial con la nube al entrar al módulo
  useEffect(() => {
    setSyncStatus("syncing");
    syncCubicacionWithCloud(inventory, savedProjects)
      .then((result) => {
        setInventory(result.inventory);
        setSavedProjects(result.bomProjects);
        setSyncStatus(result.success ? "synced" : "offline");
      })
      .catch(() => setSyncStatus("offline"));
    // Solo al montar el módulo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir borrador de trabajo (solo local)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BOM_GROUPS_DRAFT, JSON.stringify(groups));
    } catch (e) {
      console.error("Error guardando borrador de cubicación", e);
    }
  }, [groups]);

  const handleRunPreNesting = () => {
    if (groups.length === 0) return;
    const { updatedGroups } = runProjectPreNesting(groups, inventory, settings);
    setGroups(updatedGroups);
    setIsDeducted(false);
  };

  useEffect(() => {
    if (groups.length > 0 && (!groups[0].nestingResult || !groups[0].stockComparison)) {
      const { updatedGroups } = runProjectPreNesting(groups, inventory, settings);
      setGroups(updatedGroups);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalBarsToBuy = useMemo(() => {
    return groups.reduce((s, g) => s + (g.stockComparison?.barsToBuy || 0), 0);
  }, [groups]);

  const handleUpdateGroups = (newGroups: BOMProfileGroup[]) => {
    const { updatedGroups } = runProjectPreNesting(newGroups, inventory, settings);
    setGroups(updatedGroups);
    setIsDeducted(false);
  };

  const handleSaveProject = (newProject: BOMProject) => {
    const updated = [newProject, ...savedProjects.filter((p) => p.id !== newProject.id)];
    setSavedProjects(updated);
    saveLocalBomProjects(updated);
    persistBomProject(newProject);
    alert(`¡Proyecto "${newProject.name}" guardado exitosamente en el historial!`);
  };

  const handleLoadProject = (proj: BOMProject) => {
    if (
      groups.length > 0 &&
      !confirm(`¿Deseas cargar el proyecto "${proj.name}"? Se reemplazará la planilla actual en edición.`)
    ) {
      return;
    }
    setSettings(proj.settings || settings);
    const { updatedGroups } = runProjectPreNesting(proj.groups, inventory, proj.settings || settings);
    setGroups(updatedGroups);
    setIsDeducted(false);
    setActiveTab("preanidado");
  };

  const handleDeleteProject = (projectId: string) => {
    const updated = savedProjects.filter((p) => p.id !== projectId);
    setSavedProjects(updated);
    saveLocalBomProjects(updated);
    deleteBomProjectRemote(projectId);
  };

  const handleUpdateProjectStatus = (projectId: string, newStatus: BOMProject["status"]) => {
    const updated = savedProjects.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p));
    setSavedProjects(updated);
    saveLocalBomProjects(updated);
    const changed = updated.find((p) => p.id === projectId);
    if (changed) persistBomProject(changed);
  };

  const handleUpdateInventory = (newInventory: MaterialStockItem[]) => {
    setInventory(newInventory);
    persistInventory(newInventory);
  };

  const handleDeductFromInventory = () => {
    if (isDeducted) return;

    let updatedInventory = [...inventory];

    groups.forEach((group) => {
      if (!group.nestingResult) return;

      const matIndex = updatedInventory.findIndex((m) => m.id === group.matchedMaterialId);
      if (matIndex >= 0) {
        const mat = { ...updatedInventory[matIndex] };

        const barsUsed = group.nestingResult.stockStandardBarsUsed;
        mat.standardBarsCount = Math.max(0, mat.standardBarsCount - barsUsed);

        const usedOffcutIds = new Set(
          group.nestingResult.barPlans
            .filter((p) => p.sourceType === "stock_offcut" && p.sourceOffcutId)
            .map((p) => p.sourceOffcutId!)
        );
        mat.offcuts = mat.offcuts.filter((o) => !usedOffcutIds.has(o.id));

        group.nestingResult.generatedOffcuts.forEach((off, idx) => {
          mat.offcuts.push({
            id: `gen-off-${Date.now()}-${idx}`,
            lengthMm: off.lengthMm,
            location: "Bodega Retazos (Corte Nuevo)",
            tag: `RET-${group.cleanProfileCode}-${Math.floor(100 + Math.random() * 900)}`,
            notes: `Generado de OT ${group.profileName}`,
            createdAt: new Date().toISOString().split("T")[0]
          });
        });

        mat.lastUpdated = new Date().toISOString();
        updatedInventory[matIndex] = mat;
      }
    });

    setInventory(updatedInventory);
    persistInventory(updatedInventory);
    setIsDeducted(true);
    alert("¡Stock descontado exitosamente en bodega y nuevos retazos registrados!");
  };

  return (
    <div className="min-h-[70vh] bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-500 selection:text-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inventory={inventory}
        totalProfilesLoaded={groups.length}
        totalBarsToBuy={totalBarsToBuy}
        savedProjectsCount={savedProjects.length}
        onOpenStockLookup={() => setShowStockLookupModal(true)}
        onOpenCloudGuide={() => setShowCloudGuideModal(true)}
        onOpenSaveModal={() => setShowSaveProjectModal(true)}
      />

      {syncStatus !== "synced" && (
        <div
          className={`text-xs text-center py-1 ${
            syncStatus === "syncing" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {syncStatus === "syncing"
            ? "Sincronizando cubicación con la nube…"
            : "Sin conexión — inventario y proyectos guardados solo localmente por ahora."}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7">
        {activeTab === "importar" && (
          <BOMImportView
            groups={groups}
            onUpdateGroups={handleUpdateGroups}
            inventory={inventory}
            onProceedToSplice={() => setActiveTab("empalmes")}
            onProceedToPreNesting={() => {
              handleRunPreNesting();
              setActiveTab("preanidado");
            }}
          />
        )}

        {activeTab === "empalmes" && (
          <SpliceManagerView
            groups={groups}
            onUpdateGroups={handleUpdateGroups}
            inventory={inventory}
            onProceedToPreNesting={() => {
              handleRunPreNesting();
              setActiveTab("preanidado");
            }}
          />
        )}

        {activeTab === "preanidado" && (
          <PreNestingStockView
            groups={groups}
            inventory={inventory}
            settings={settings}
            onUpdateSettings={setSettings}
            onRunPreNesting={handleRunPreNesting}
            onProceedToPurchases={() => setActiveTab("compras")}
            onOpenOperatorGuide={(result, material) => setOperatorGuideData({ result, material })}
            onOpenSaveModal={() => setShowSaveProjectModal(true)}
            onOpenStockLookup={() => setShowStockLookupModal(true)}
            onProceedToSplice={() => setActiveTab("empalmes")}
          />
        )}

        {activeTab === "compras" && (
          <PurchaseOrderView
            groups={groups}
            inventory={inventory}
            onDeductFromInventory={handleDeductFromInventory}
            isDeducted={isDeducted}
          />
        )}

        {activeTab === "historial" && (
          <BOMHistoryView
            projects={savedProjects}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onOpenSaveModal={() => setShowSaveProjectModal(true)}
            currentGroupsCount={groups.length}
          />
        )}

        {activeTab === "inventario" && (
          <InventoryView inventory={inventory} onUpdateInventory={handleUpdateInventory} />
        )}
      </main>

      <StockLookupModal
        inventory={inventory}
        isOpen={showStockLookupModal}
        onClose={() => setShowStockLookupModal(false)}
      />

      <CloudAndMobileGuideModal isOpen={showCloudGuideModal} onClose={() => setShowCloudGuideModal(false)} />

      <SaveProjectModal
        isOpen={showSaveProjectModal}
        onClose={() => setShowSaveProjectModal(false)}
        groups={groups}
        settings={settings}
        onSave={handleSaveProject}
      />

      {operatorGuideData && (
        <OperatorGuideModal
          result={operatorGuideData.result}
          material={operatorGuideData.material}
          onClose={() => setOperatorGuideData(null)}
        />
      )}
    </div>
  );
}
