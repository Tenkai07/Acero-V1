import { authFetch } from "./authToken";
import { SoftlandCatalogProduct } from "./softlandCatalogImporter";

const LOCAL_KEY = "acero_softland_catalog_cache_v1";

export function getLocalSoftlandCatalog(): SoftlandCatalogProduct[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSoftlandCatalog(catalog: SoftlandCatalogProduct[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(catalog));
  } catch (e) {
    console.error("Error guardando caché local del catálogo Softland", e);
  }
}

/** Trae el catálogo guardado en la nube (compartido por toda la maestranza). */
export async function fetchSoftlandCatalog(): Promise<SoftlandCatalogProduct[]> {
  try {
    const res = await authFetch("/api/settings/softland-catalog");
    if (!res.ok) throw new Error("Error de servidor");
    const data = await res.json();
    const catalog = data.success ? data.catalog || [] : [];
    if (catalog.length > 0) saveLocalSoftlandCatalog(catalog);
    return catalog.length > 0 ? catalog : getLocalSoftlandCatalog();
  } catch (e) {
    console.warn("No se pudo traer el catálogo Softland de la nube, usando copia local si existe", e);
    return getLocalSoftlandCatalog();
  }
}

/** Guarda el catálogo recién importado, local al instante + nube en segundo plano. */
export function persistSoftlandCatalog(catalog: SoftlandCatalogProduct[]) {
  saveLocalSoftlandCatalog(catalog);
  authFetch("/api/settings/softland-catalog", {
    method: "PUT",
    body: JSON.stringify({ catalog })
  }).catch((err) => console.warn("No se pudo guardar el catálogo Softland en la nube (queda guardado local):", err));
}

/** Búsqueda simple por texto en código o descripción, para autocompletar. */
export function searchSoftlandCatalog(catalog: SoftlandCatalogProduct[], query: string, limit = 15): SoftlandCatalogProduct[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return catalog
    .filter((p) => p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    .slice(0, limit);
}
