import { authFetch } from "../../utils/authToken";
import { BOMProject, MaterialStockItem } from "../types";

// Mismas claves de localStorage que usaba la app "Inventario y Cubicación"
// original, para que si alguien ya la usaba en este navegador, sus datos no
// se pierdan al fusionarla dentro de Acero-V1 (se toman como semilla local y
// luego se sincronizan a la nube).
const LOCAL_KEY_INVENTORY = "maestranza_inventory_v2";
const LOCAL_KEY_BOM_PROJECTS = "maestranza_saved_bom_projects_v2";

// ---------------------------------------------------------------------------
// Inventario de bodega
// ---------------------------------------------------------------------------
export function getLocalInventory(): MaterialStockItem[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_INVENTORY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Error leyendo inventario local", e);
    return null;
  }
}

export function saveLocalInventory(inventory: MaterialStockItem[]): void {
  try {
    localStorage.setItem(LOCAL_KEY_INVENTORY, JSON.stringify(inventory));
  } catch (e) {
    console.error("Error guardando inventario local", e);
  }
}

/** Guarda el inventario completo: local al instante + nube en segundo plano. */
export function persistInventory(inventory: MaterialStockItem[]): void {
  saveLocalInventory(inventory);
  authFetch("/api/inventory", {
    method: "POST",
    body: JSON.stringify({ inventory })
  }).catch((err) => console.warn("Sincronización de inventario en segundo plano falló (guardado local ok):", err));
}

// ---------------------------------------------------------------------------
// Proyectos de cubicación (BOM / nesting / compras)
// ---------------------------------------------------------------------------
export function getLocalBomProjects(): BOMProject[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_BOM_PROJECTS);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Error leyendo proyectos de cubicación locales", e);
    return null;
  }
}

export function saveLocalBomProjects(projects: BOMProject[]): void {
  try {
    localStorage.setItem(LOCAL_KEY_BOM_PROJECTS, JSON.stringify(projects));
  } catch (e) {
    console.error("Error guardando proyectos de cubicación locales", e);
  }
}

export function persistBomProject(project: BOMProject): void {
  authFetch("/api/bom-projects", {
    method: "POST",
    body: JSON.stringify(project)
  }).catch((err) => console.warn("Sincronización de proyecto de cubicación falló (guardado local ok):", err));
}

export function deleteBomProjectRemote(projectId: string): void {
  authFetch(`/api/bom-projects/${projectId}`, { method: "DELETE" }).catch((err) =>
    console.warn("No se pudo eliminar el proyecto de cubicación en el servidor:", err)
  );
}

// ---------------------------------------------------------------------------
// Sincronización bidireccional al recuperar conexión / al cargar la app
// ---------------------------------------------------------------------------
export async function syncCubicacionWithCloud(
  localInventory: MaterialStockItem[],
  localBomProjects: BOMProject[]
): Promise<{ inventory: MaterialStockItem[]; bomProjects: BOMProject[]; success: boolean }> {
  try {
    const res = await authFetch("/api/sync", {
      method: "POST",
      body: JSON.stringify({
        localInventory,
        localBomProjects,
        clientTimestamp: Date.now()
      })
    });
    if (!res.ok) throw new Error("Error en servidor al sincronizar cubicación");
    const data = await res.json();
    if (data.success) {
      if (Array.isArray(data.inventory)) saveLocalInventory(data.inventory);
      if (Array.isArray(data.bomProjects)) saveLocalBomProjects(data.bomProjects);
      return {
        inventory: data.inventory || localInventory,
        bomProjects: data.bomProjects || localBomProjects,
        success: true
      };
    }
  } catch (err) {
    console.warn("Offline o modo local activo, cubicación sincronizada solo localmente", err);
  }
  return { inventory: localInventory, bomProjects: localBomProjects, success: false };
}
