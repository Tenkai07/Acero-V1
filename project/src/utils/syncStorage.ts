import { SteelProject, CalculationHistoryItem } from "../types";
import { authFetch } from "./authToken";

const LOCAL_STORAGE_PROJECTS_KEY = "aceros_chile_projects_v2";
const LOCAL_STORAGE_HISTORY_KEY = "aceros_chile_history_v2";

export interface SyncStatus {
  isSyncing: boolean;
  lastSynced: number | null;
  status: "synced" | "offline" | "syncing" | "error";
  message?: string;
}

export function getProjects(): SteelProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading local projects", e);
    return [];
  }
}

export const getLocalProjects = getProjects;

export function saveLocalProjects(projects: SteelProject[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("Error saving local projects", e);
  }
}

export function saveProject(project: SteelProject): void {
  const current = getProjects();
  const index = current.findIndex((p) => p.id === project.id);
  let updated: SteelProject[];
  const withTimestamp = { ...project, updatedAt: Date.now() };
  if (index >= 0) {
    updated = [...current];
    updated[index] = withTimestamp;
  } else {
    updated = [withTimestamp, ...current];
  }
  saveLocalProjects(updated);

  authFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(withTimestamp)
  }).catch((err) => console.warn("Sincronización en segundo plano falló (guardado local ok):", err));
}

export function deleteProject(projectId: string): void {
  const current = getProjects();
  const filtered = current.filter((p) => p.id !== projectId);
  saveLocalProjects(filtered);

  authFetch(`/api/projects/${projectId}`, { method: "DELETE" }).catch((err) =>
    console.warn("No se pudo eliminar el proyecto en el servidor:", err)
  );
}

export function getHistory(): CalculationHistoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading local history", e);
    return [];
  }
}

export const getLocalHistory = getHistory;

export function saveLocalHistory(history: CalculationHistoryItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Error saving local history", e);
  }
}

export function saveHistoryItem(
  item: Omit<CalculationHistoryItem, "id" | "timestamp"> | CalculationHistoryItem
): CalculationHistoryItem {
  const fullItem: CalculationHistoryItem = {
    ...item,
    id: "id" in item && item.id ? item.id : `calc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: "timestamp" in item && item.timestamp ? item.timestamp : Date.now()
  };

  const current = getHistory();
  const updated = [fullItem, ...current].slice(0, 300);
  saveLocalHistory(updated);

  authFetch("/api/history", {
    method: "POST",
    body: JSON.stringify({ item: fullItem })
  }).catch((err) => console.warn("Sincronización de historial en segundo plano falló:", err));

  return fullItem;
}

export const addHistoryEntry = saveHistoryItem;

export function deleteHistoryItem(id: string): void {
  const current = getHistory();
  const filtered = current.filter((item) => item.id !== id);
  saveLocalHistory(filtered);

  authFetch(`/api/history/${id}`, { method: "DELETE" }).catch((err) =>
    console.warn("No se pudo eliminar el ítem del historial en el servidor:", err)
  );
}

export function clearHistory(): void {
  saveLocalHistory([]);
  authFetch("/api/history", { method: "DELETE" }).catch((err) =>
    console.warn("No se pudo limpiar el historial en el servidor:", err)
  );
}

export async function syncDataWithCloud(): Promise<{
  projects: SteelProject[];
  history: CalculationHistoryItem[];
  success: boolean;
}> {
  const localProjects = getProjects();
  const localHistory = getHistory();

  try {
    const res = await authFetch("/api/sync", {
      method: "POST",
      body: JSON.stringify({
        localProjects,
        localHistory,
        clientTimestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error("Error en servidor al sincronizar");
    const data = await res.json();

    if (data.success) {
      if (Array.isArray(data.projects)) {
        saveLocalProjects(data.projects);
      }
      if (Array.isArray(data.history)) {
        saveLocalHistory(data.history);
      }
      return {
        projects: data.projects || localProjects,
        history: data.history || localHistory,
        success: true
      };
    }
  } catch (err) {
    console.warn("Offline o modo local activo, sincronizado localmente", err);
  }

  return {
    projects: localProjects,
    history: localHistory,
    success: false
  };
}

export const syncWithCloud = syncDataWithCloud;
