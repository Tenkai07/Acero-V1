import { useEffect, useMemo, useState } from "react";
import { Plus, Search, PackagePlus, ClipboardList, CheckCircle2, RefreshCw } from "lucide-react";
import { authFetch } from "../utils/authToken";
import { MaterialStockItem, BOMProject, MaterialUnitType, ProjectMaterialConsumption, PlateBatch } from "../inventario/types";
import { persistInventory, persistBomProject } from "../inventario/utils/cloudSync";
import { fetchSoftlandCatalog, searchSoftlandCatalog } from "../utils/softlandCatalogStorage";
import { SoftlandCatalogProduct } from "../utils/softlandCatalogImporter";

const INPUT_CLS = "bg-slate-950 border border-slate-700 rounded-lg text-xs px-2 py-1.5 text-slate-200 w-full";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Reglas de negocio confirmadas con el usuario (no son suposiciones):
 * - Pernos/conexiones: se descuentan por UNIDAD ENTERA.
 * - Perfiles (barras): se descuentan por UNIDAD ENTERA (ya cubierto por el
 *   flujo de Pre-anidado/Compras existente, no se toca aquí).
 * - Planchas: se descuentan por FRACCIÓN de plancha completa (ej. usar 30%
 *   de una plancha descuenta 0.3), y cada ingreso de plancha se registra
 *   con su número de COLADA/TALLA para trazabilidad de certificado de
 *   material — igual a la columna "Partida o Talla" de la Guía de Entrada
 *   real de Softland.
 * - Retazos (offcuts): son un concepto 100% interno de la app. Softland no
 *   los conoce, así que NUNCA deben incluirse en un archivo/reporte
 *   generado para subir a Softland.
 */
export function SoftlandMaterialsSection() {
  const [inventory, setInventory] = useState<MaterialStockItem[]>([]);
  const [bomProjects, setBomProjects] = useState<BOMProject[]>([]);
  const [catalog, setCatalog] = useState<SoftlandCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [invRes, bomRes, cat] = await Promise.all([
          authFetch("/api/inventory"),
          authFetch("/api/bom-projects"),
          fetchSoftlandCatalog()
        ]);
        const invData = await invRes.json();
        const bomData = await bomRes.json();
        if (invData.success) setInventory(invData.inventory || []);
        if (bomData.success) setBomProjects(bomData.bomProjects || []);
        setCatalog(cat);
      } catch (e) {
        console.error("Error cargando materiales especiales", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const especiales = useMemo(
    () => inventory.filter((m) => m.unitType === "plancha" || m.unitType === "unidad"),
    [inventory]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Cargando planchas y pernos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AgregarMaterialForm
        catalog={catalog}
        onAdd={(newItem) => {
          const updated = [...inventory, newItem];
          setInventory(updated);
          persistInventory(updated);
        }}
      />

      <ListaEspeciales especiales={especiales} />

      <ConsumoPorProyecto
        inventory={inventory}
        bomProjects={bomProjects}
        onConsumoRegistrado={(updatedInventory, updatedProject) => {
          setInventory(updatedInventory);
          persistInventory(updatedInventory);
          setBomProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
          persistBomProject(updatedProject);
        }}
      />
    </div>
  );
}

function AgregarMaterialForm({
  catalog,
  onAdd
}: {
  catalog: SoftlandCatalogProduct[];
  onAdd: (item: MaterialStockItem) => void;
}) {
  const [unitType, setUnitType] = useState<MaterialUnitType>("plancha");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SoftlandCatalogProduct | null>(null);
  const [cantidad, setCantidad] = useState(0);
  const [colada, setColada] = useState("");
  const [costo, setCosto] = useState(0);
  const [stockMinimo, setStockMinimo] = useState(1);
  const [ubicacion, setUbicacion] = useState("");

  const suggestions = useMemo(() => (selected ? [] : searchSoftlandCatalog(catalog, query)), [catalog, query, selected]);

  const handleSubmit = () => {
    const code = selected?.code || query.trim();
    const description = selected?.description || query.trim();
    if (!code || !description) {
      alert("Busca y selecciona el material del catálogo Softland, o escribe al menos un código/nombre.");
      return;
    }
    if (unitType === "plancha" && cantidad > 0 && !colada.trim()) {
      alert('Las planchas necesitan su número de colada/talla (columna "Partida o Talla" en Softland) para trazabilidad.');
      return;
    }

    const plateBatches: PlateBatch[] | undefined =
      unitType === "plancha" && cantidad > 0
        ? [{ id: uid("lote"), colada: colada.trim(), cantidadPlanchas: cantidad, fechaIngreso: new Date().toISOString() }]
        : undefined;

    const newItem: MaterialStockItem = {
      id: uid("mat"),
      code,
      name: description,
      category: unitType === "plancha" ? "plancha" : "perno_conexion",
      dimensions: description,
      grade: "",
      theoreticalWeightPerMeter: 0,
      costPerMeter: costo,
      standardBarLengthMm: 0,
      standardBarsCount: cantidad,
      offcuts: [],
      minStockBars: stockMinimo,
      location: ubicacion || "Bodega General",
      lastUpdated: new Date().toISOString(),
      unitType,
      plateBatches,
      softlandCode: selected?.code
    };
    onAdd(newItem);
    setQuery("");
    setSelected(null);
    setCantidad(0);
    setColada("");
    setCosto(0);
    alert(`"${description}" agregado al inventario.`);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <PackagePlus className="w-5 h-5 text-teal-400" />
        <h3 className="font-semibold text-slate-100">Agregar Plancha o Perno a Bodega</h3>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Busca en el catálogo de Softland para traer el código exacto sin tipearlo a mano. Si el catálogo aún no se ha
        importado, sube el "Informe de Productos Paramétrico" en la sección de arriba primero.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="text-[11px] text-slate-500 flex flex-col gap-1">
          Tipo de material
          <select className={INPUT_CLS} value={unitType} onChange={(e) => setUnitType(e.target.value as MaterialUnitType)}>
            <option value="plancha">Plancha</option>
            <option value="unidad">Perno / Conexión</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-500 flex flex-col gap-1 relative">
          Buscar en catálogo Softland (código o descripción)
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className={`${INPUT_CLS} pl-7`}
              placeholder="ej. PL 1000x4 o perno hex 1/4"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-slate-950 border border-slate-700 rounded-lg max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    setSelected(s);
                    setQuery(s.description);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 border-b border-slate-800 last:border-0"
                >
                  <span className="text-teal-400">{s.code}</span> — {s.description}
                </button>
              ))}
            </div>
          )}
        </label>
      </div>

      <div className={`grid grid-cols-2 ${unitType === "plancha" ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-3 mb-4`}>
        <label className="text-[11px] text-slate-500 flex flex-col gap-1">
          {unitType === "plancha" ? "Planchas en stock" : "Unidades en stock"}
          <input
            type="number"
            step={unitType === "plancha" ? "0.01" : "1"}
            className={INPUT_CLS}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
        </label>
        {unitType === "plancha" && (
          <label className="text-[11px] text-slate-500 flex flex-col gap-1">
            N° Colada / Talla *
            <input className={INPUT_CLS} placeholder="ej. 25A4409001" value={colada} onChange={(e) => setColada(e.target.value)} />
          </label>
        )}
        <label className="text-[11px] text-slate-500 flex flex-col gap-1">
          Costo {unitType === "plancha" ? "por plancha" : "por unidad"} (CLP)
          <input type="number" className={INPUT_CLS} value={costo} onChange={(e) => setCosto(Number(e.target.value))} />
        </label>
        <label className="text-[11px] text-slate-500 flex flex-col gap-1">
          Stock mínimo (alerta)
          <input type="number" className={INPUT_CLS} value={stockMinimo} onChange={(e) => setStockMinimo(Number(e.target.value))} />
        </label>
        <label className="text-[11px] text-slate-500 flex flex-col gap-1">
          Ubicación
          <input className={INPUT_CLS} placeholder="Bodega General" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
        </label>
      </div>

      <button
        onClick={handleSubmit}
        className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-teal-700 bg-teal-950/40 text-teal-300 hover:bg-teal-900/50 transition"
      >
        <Plus className="w-4 h-4" /> Agregar a inventario
      </button>
    </section>
  );
}

function ListaEspeciales({ especiales }: { especiales: MaterialStockItem[] }) {
  if (especiales.length === 0) return null;
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="font-semibold text-slate-100 mb-3">Planchas y Pernos en Bodega</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-right px-3 py-2">Stock</th>
              <th className="text-left px-3 py-2">Coladas</th>
              <th className="text-right px-3 py-2">Mínimo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {especiales.map((m) => (
              <tr key={m.id} className={m.standardBarsCount < m.minStockBars ? "bg-amber-950/20" : ""}>
                <td className="px-3 py-2 text-slate-300">{m.code}</td>
                <td className="px-3 py-2 text-slate-400">{m.name}</td>
                <td className="px-3 py-2 text-slate-500">{m.unitType === "plancha" ? "Plancha" : "Unidad"}</td>
                <td className="px-3 py-2 text-right text-slate-300">
                  {m.unitType === "plancha" ? m.standardBarsCount.toFixed(2) : m.standardBarsCount}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {m.plateBatches && m.plateBatches.length > 0
                    ? m.plateBatches.map((b) => `${b.colada} (${b.cantidadPlanchas.toFixed(2)})`).join(", ")
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right text-slate-500">{m.minStockBars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConsumoPorProyecto({
  inventory,
  bomProjects,
  onConsumoRegistrado
}: {
  inventory: MaterialStockItem[];
  bomProjects: BOMProject[];
  onConsumoRegistrado: (inventory: MaterialStockItem[], project: BOMProject) => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [coladaSeleccionada, setColadaSeleccionada] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [ultimoRegistro, setUltimoRegistro] = useState<string | null>(null);

  const materialesEspeciales = inventory.filter((m) => m.unitType === "plancha" || m.unitType === "unidad");
  const proyecto = bomProjects.find((p) => p.id === projectId);
  const material = inventory.find((m) => m.id === materialId);
  const esPlancha = material?.unitType === "plancha";
  const tieneBatches = esPlancha && material?.plateBatches && material.plateBatches.length > 0;

  const handleRegistrar = () => {
    if (!proyecto || !material || cantidad <= 0) {
      alert("Elige un proyecto, un material y una cantidad válida.");
      return;
    }
    if (esPlancha && cantidad > 1) {
      // No es un error duro (podrían gastarse varias planchas), pero se confirma
      // porque lo normal es ingresar una fracción (ej. 0.3), no un entero.
      if (!confirm(`Vas a descontar ${cantidad} planchas completas (no una fracción). ¿Es correcto?`)) return;
    }
    if (tieneBatches && !coladaSeleccionada) {
      alert("Esta plancha tiene más de una colada en bodega — elige de cuál se descuenta, para no perder la trazabilidad.");
      return;
    }
    if (cantidad > material.standardBarsCount) {
      if (!confirm(`Solo hay ${material.standardBarsCount} en stock. ¿Descontar igual (quedaría negativo)?`)) return;
    }

    const updatedInventory = inventory.map((m) => {
      if (m.id !== material.id) return m;
      const updated: MaterialStockItem = {
        ...m,
        standardBarsCount: Math.max(0, Number((m.standardBarsCount - cantidad).toFixed(4))),
        lastUpdated: new Date().toISOString()
      };
      if (esPlancha && m.plateBatches) {
        updated.plateBatches = m.plateBatches.map((b) =>
          b.colada === coladaSeleccionada
            ? { ...b, cantidadPlanchas: Math.max(0, Number((b.cantidadPlanchas - cantidad).toFixed(4))) }
            : b
        );
      }
      return updated;
    });

    const registro: ProjectMaterialConsumption = {
      id: uid("cons"),
      materialId: material.id,
      materialCode: material.code,
      materialName: material.name,
      unitType: material.unitType || "unidad",
      quantity: cantidad,
      colada: esPlancha ? coladaSeleccionada || material.plateBatches?.[0]?.colada : undefined,
      registeredAt: new Date().toISOString(),
      notes: nota || undefined
    };
    const updatedProject: BOMProject = {
      ...proyecto,
      additionalConsumption: [...(proyecto.additionalConsumption || []), registro]
    };

    onConsumoRegistrado(updatedInventory, updatedProject);
    setUltimoRegistro(
      `${esPlancha ? cantidad.toFixed(2) + " plancha(s)" : cantidad + " unidad(es)"} de ${material.name} descontado de "${proyecto.name}"`
    );
    setCantidad(esPlancha ? 0.1 : 1);
    setColadaSeleccionada("");
    setNota("");
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-5 h-5 text-indigo-400" />
        <h3 className="font-semibold text-slate-100">Registrar Consumo por Proyecto</h3>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Pernos se descuentan por unidad entera. Planchas se descuentan por fracción de plancha completa (ej. usar un
        30% de una plancha = 0.3). El consumo de perfiles sigue descontándose automáticamente desde Pre-anidado →
        Compras — no se repite aquí.
      </p>

      {bomProjects.length === 0 ? (
        <p className="text-sm text-slate-500">No hay proyectos de cubicación guardados todavía.</p>
      ) : materialesEspeciales.length === 0 ? (
        <p className="text-sm text-slate-500">Agrega al menos una plancha o perno a bodega para poder registrar consumo.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <label className="text-[11px] text-slate-500 flex flex-col gap-1">
              Proyecto
              <select className={INPUT_CLS} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Selecciona...</option>
                {bomProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-slate-500 flex flex-col gap-1">
              Material
              <select
                className={INPUT_CLS}
                value={materialId}
                onChange={(e) => {
                  setMaterialId(e.target.value);
                  setColadaSeleccionada("");
                  const m = inventory.find((mm) => mm.id === e.target.value);
                  setCantidad(m?.unitType === "plancha" ? 0.1 : 1);
                }}
              >
                <option value="">Selecciona...</option>
                {materialesEspeciales.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name} (stock: {m.unitType === "plancha" ? m.standardBarsCount.toFixed(2) : m.standardBarsCount})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-slate-500 flex flex-col gap-1">
              {esPlancha ? "Fracción de plancha consumida (ej. 0.3 = 30%)" : "Cantidad consumida (unidades)"}
              <input
                type="number"
                step={esPlancha ? "0.01" : "1"}
                min="0"
                className={INPUT_CLS}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
              />
            </label>
          </div>

          {tieneBatches && (
            <label className="text-[11px] text-slate-500 flex flex-col gap-1 mb-3">
              Colada / Talla de la que se descuenta *
              <select className={INPUT_CLS} value={coladaSeleccionada} onChange={(e) => setColadaSeleccionada(e.target.value)}>
                <option value="">Selecciona la colada...</option>
                {material?.plateBatches?.map((b) => (
                  <option key={b.id} value={b.colada}>
                    {b.colada} — disponible: {b.cantidadPlanchas.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-[11px] text-slate-500 flex flex-col gap-1 mb-3">
            Nota (opcional)
            <input className={INPUT_CLS} placeholder="ej. placas base columnas eje A" value={nota} onChange={(e) => setNota(e.target.value)} />
          </label>

          <button
            onClick={handleRegistrar}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-indigo-700 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 transition"
          >
            <CheckCircle2 className="w-4 h-4" /> Registrar consumo
          </button>

          {ultimoRegistro && <p className="text-xs text-emerald-400 mt-2">✓ {ultimoRegistro}</p>}

          {proyecto && proyecto.additionalConsumption && proyecto.additionalConsumption.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-2">Consumo ya registrado en "{proyecto.name}":</p>
              <ul className="text-xs text-slate-300 divide-y divide-slate-800 border border-slate-800 rounded-lg">
                {proyecto.additionalConsumption.map((c) => (
                  <li key={c.id} className="px-3 py-1.5 flex justify-between">
                    <span>
                      {c.unitType === "plancha" ? c.quantity.toFixed(2) + " plancha(s)" : c.quantity + " unidad(es)"} de{" "}
                      {c.materialName} ({c.materialCode}){c.colada ? ` — colada ${c.colada}` : ""}
                    </span>
                    <span className="text-slate-500">{new Date(c.registeredAt).toLocaleDateString("es-CL")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
