import React, { useMemo, useState } from "react";
import { BookMarked, Search, ArrowLeftRight, Ruler, Sigma, Layers } from "lucide-react";
import { ICHA_PROFILES } from "../../data/ichaProfiles";
import { IchaFamily, IchaManual, IchaProfile } from "../../types";
import { normalizeDesignation } from "../../utils/ichaDesignation";

const FAMILY_OPTIONS: { id: IchaFamily | "ALL"; label: string }[] = [
  { id: "ALL", label: "Todas las familias" },
  { id: "C", label: "Canales plegadas (C)" },
  { id: "CA", label: "Canales atiesadas / costaneras (CA)" },
  { id: "IN", label: "Vigas soldadas serie IN" },
  { id: "HN", label: "Columnas soldadas serie HN" },
  { id: "L", label: "Ángulos L" },
  { id: "CAJON", label: "Cajones tubulares" },
  { id: "TUBO", label: "Tubos circulares" }
];

const MANUAL_OPTIONS: { id: IchaManual | "ALL"; label: string }[] = [
  { id: "ALL", label: "Ambos manuales" },
  { id: "TRAD", label: "ICHA Tradicional / NCh427" },
  { id: "2001", label: "ICHA 2001" }
];

/** Espesor de pared a mostrar: los soldados usan alma+ala, el resto uno solo. */
function wallThicknessLabel(p: IchaProfile): string {
  if (p.tw !== undefined && p.tf !== undefined) return `alma ${p.tw} · ala ${p.tf} mm`;
  return p.t !== undefined ? `${p.t} mm` : "—";
}

/**
 * Croquis acotado de la sección. Se dibuja a escala real entre sí (la
 * proporción alto/ancho es la del perfil), pero encajado en un lienzo fijo:
 * lo que importa acá es reconocer la forma y leer las cotas, no medir sobre
 * la pantalla. Los espesores tienen un mínimo en píxeles para que una pared
 * de 2mm en un perfil de 300mm no desaparezca.
 */
const ProfileSketch: React.FC<{ profile: IchaProfile }> = ({ profile: p }) => {
  const W = 300;
  const H = 300;
  const margin = 52;
  const dw = W - 2 * margin;
  const dh = H - 2 * margin;

  const bReal = p.b || p.h;
  const scale = Math.min(dw / bReal, dh / p.h);
  const pw = bReal * scale;
  const ph = p.h * scale;
  const ox = margin + (dw - pw) / 2;
  const oy = margin + (dh - ph) / 2;
  const t = Math.max((p.t ?? p.tw ?? 3) * scale, 3);
  const tf = Math.max((p.tf ?? p.t ?? 4) * scale, 4);

  let d = "";
  if (p.type === "C") {
    d = `M ${ox + pw} ${oy} L ${ox} ${oy} L ${ox} ${oy + ph} L ${ox + pw} ${oy + ph} L ${ox + pw} ${oy + ph - t} L ${ox + t} ${oy + ph - t} L ${ox + t} ${oy + t} L ${ox + pw} ${oy + t} Z`;
  } else if (p.type === "CA") {
    const pc = Math.min((p.c ?? 20) * scale, ph * 0.28);
    d = `M ${ox + pw} ${oy + pc} L ${ox + pw} ${oy} L ${ox} ${oy} L ${ox} ${oy + ph} L ${ox + pw} ${oy + ph} L ${ox + pw} ${oy + ph - pc} L ${ox + pw - t} ${oy + ph - pc} L ${ox + pw - t} ${oy + ph - t} L ${ox + t} ${oy + ph - t} L ${ox + t} ${oy + t} L ${ox + pw - t} ${oy + t} L ${ox + pw - t} ${oy + pc} Z`;
  } else if (p.type === "IN" || p.type === "HN") {
    const wx = ox + (pw - t) / 2;
    d = `M ${ox} ${oy} L ${ox + pw} ${oy} L ${ox + pw} ${oy + tf} L ${wx + t} ${oy + tf} L ${wx + t} ${oy + ph - tf} L ${ox + pw} ${oy + ph - tf} L ${ox + pw} ${oy + ph} L ${ox} ${oy + ph} L ${ox} ${oy + ph - tf} L ${wx} ${oy + ph - tf} L ${wx} ${oy + tf} L ${ox} ${oy + tf} Z`;
  } else if (p.type === "L") {
    d = `M ${ox} ${oy} L ${ox + t} ${oy} L ${ox + t} ${oy + ph - t} L ${ox + pw} ${oy + ph - t} L ${ox + pw} ${oy + ph} L ${ox} ${oy + ph} Z`;
  } else if (p.type === "CAJON") {
    d = `M ${ox} ${oy} L ${ox + pw} ${oy} L ${ox + pw} ${oy + ph} L ${ox} ${oy + ph} Z M ${ox + t} ${oy + t} L ${ox + t} ${oy + ph - t} L ${ox + pw - t} ${oy + ph - t} L ${ox + pw - t} ${oy + t} Z`;
  } else {
    const r = pw / 2;
    const cx = ox + r;
    const cy = oy + r;
    d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} M ${cx} ${cy - r + t} A ${r - t} ${r - t} 0 1 1 ${cx} ${cy + r - t} A ${r - t} ${r - t} 0 1 1 ${cx} ${cy - r + t}`;
  }

  const label = { fill: "#94a3b8", fontSize: 12, fontFamily: "ui-monospace, monospace" } as const;

  return (
    <svg viewBox="0 0 300 300" className="w-full h-auto max-h-[340px]" role="img" aria-label={`Croquis de ${p.name}`}>
      <path d={d} fill="#0ea5e922" stroke="#38bdf8" strokeWidth={2} fillRule="evenodd" />
      <text x={ox - 14} y={oy + ph / 2} textAnchor="middle" transform={`rotate(-90 ${ox - 14} ${oy + ph / 2})`} {...label}>
        H = {p.h} mm
      </text>
      <text x={ox + pw / 2} y={oy + ph + 24} textAnchor="middle" {...label}>
        B = {bReal} mm
      </text>
      <text x={ox + pw / 2} y={oy - 14} textAnchor="middle" {...label}>
        e = {wallThicknessLabel(p)}
      </text>
      {p.c ? (
        <text x={ox + pw + 16} y={oy + ph - (p.c * scale) / 2} textAnchor="middle" transform={`rotate(-90 ${ox + pw + 16} ${oy + ph - (p.c * scale) / 2})`} {...label}>
          c = {p.c} mm
        </text>
      ) : null}
    </svg>
  );
};

const PropertyRow: React.FC<{ label: string; value?: number; unit: string; hint?: string }> = ({
  label,
  value,
  unit,
  hint
}) => (
  <div className="flex items-baseline justify-between gap-3 py-2 border-b border-slate-800 last:border-0">
    <span className="text-xs text-slate-400">
      {label}
      {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
    </span>
    <span className="font-mono text-sm text-slate-100 whitespace-nowrap">
      {value === undefined ? "—" : `${value.toLocaleString("es-CL")} ${unit}`}
    </span>
  </div>
);

export const IchaCatalogView: React.FC = () => {
  const [manual, setManual] = useState<IchaManual | "ALL">("ALL");
  const [family, setFamily] = useState<IchaFamily | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string>(ICHA_PROFILES[0]?.name ?? "");

  const filtered = useMemo(() => {
    const q = normalizeDesignation(search);
    return ICHA_PROFILES.filter((p) => {
      if (manual !== "ALL" && p.man !== manual) return false;
      if (family !== "ALL" && p.type !== family) return false;
      if (!q) return true;
      return normalizeDesignation(p.name).includes(q) || normalizeDesignation(p.mm).includes(q);
    });
  }, [manual, family, search]);

  // La ficha sigue al filtro: si el perfil elegido quedó fuera de la
  // búsqueda actual, se muestra el primer resultado en vez de dejar a la
  // vista un perfil que ya no aparece en la lista. Si la búsqueda no
  // devuelve nada, se conserva el último elegido para no dejar el panel en
  // blanco.
  const selected = useMemo(() => {
    const inFiltered = filtered.find((p) => p.name === selectedName);
    if (inFiltered) return inFiltered;
    return filtered[0] ?? ICHA_PROFILES.find((p) => p.name === selectedName) ?? ICHA_PROFILES[0];
  }, [selectedName, filtered]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 dark:bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <BookMarked className="w-5 h-5" />
          </span>
          <h2 className="text-xl font-bold text-white">Catálogo ICHA</h2>
          <span className="ml-auto text-xs font-bold bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full">
            {ICHA_PROFILES.length} perfiles
          </span>
        </div>
        <p className="text-sm text-slate-300 mt-2">
          Manuales ICHA Tradicional (NCh427) e ICHA 2001. Cada perfil trae su designación de plano y su
          designación en medidas — la app reconoce las dos al importar una cubicación.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
        {/* Panel de búsqueda */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 h-fit">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Manual de origen
            </label>
            <select
              value={manual}
              onChange={(e) => setManual(e.target.value as IchaManual | "ALL")}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              {MANUAL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Familia estructural
            </label>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value as IchaFamily | "ALL")}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              {FAMILY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Buscar por nombre o medidas
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="C 25x17.9, C 250x75x6, IN 70x232…"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Da lo mismo si escribes con coma, espacios o asterisco: <code className="text-slate-400">c25*17,9</code> también
              encuentra el perfil.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resultados</span>
              <span className="text-[11px] text-slate-500">{filtered.length}</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
              {filtered.length === 0 && (
                <p className="text-xs text-slate-500 p-3">Ningún perfil ICHA coincide con esa búsqueda.</p>
              )}
              {filtered.map((p) => {
                const isActive = p.name === selected?.name;
                return (
                  <button
                    key={`${p.type}-${p.name}`}
                    onClick={() => setSelectedName(p.name)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      isActive ? "bg-sky-500/15 border-l-2 border-sky-400" : "hover:bg-slate-800/60 border-l-2 border-transparent"
                    }`}
                  >
                    <div className={`text-sm font-bold ${isActive ? "text-sky-300" : "text-slate-200"}`}>{p.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{p.mm}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ficha técnica */}
        {selected && (
          <div className="space-y-5">
            {/* La doble designación es lo que más se consulta, va primero */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ArrowLeftRight className="w-4 h-4 text-sky-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Doble designación — el mismo perfil, dos nombres
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Como viene en planos</div>
                  <div className="text-lg font-bold text-white font-mono">{selected.name}</div>
                </div>
                <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-sky-400/80 mb-1">Como se pide a bodega</div>
                  <div className="text-lg font-bold text-sky-300 font-mono">{selected.mm}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  {selected.man === "TRAD" ? "ICHA Tradicional / NCh427" : "ICHA 2001"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" />
                  {selected.h} × {selected.b || selected.h} mm · e = {wallThicknessLabel(selected)}
                </span>
                <span className="font-bold text-amber-300">{selected.W} kgf/m</span>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Croquis acotado</h3>
                <div className="bg-slate-950 border border-dashed border-slate-700 rounded-xl p-3 flex items-center justify-center">
                  <ProfileSketch profile={selected} />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sigma className="w-4 h-4 text-sky-400" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Propiedades para el diseño
                  </h3>
                </div>
                <div className="space-y-0">
                  <PropertyRow label="Área total (A)" value={selected.A} unit="cm²" />
                  <PropertyRow label="Peso nominal" value={selected.W} unit="kgf/m" />
                  <PropertyRow label="Inercia eje fuerte (Ix)" value={selected.Ix} unit="cm⁴" />
                  <PropertyRow label="Módulo elástico (Wx)" value={selected.Wx} unit="cm³" />
                  <PropertyRow label="Radio de giro (rx)" value={selected.rx} unit="cm" />
                  <PropertyRow label="Inercia eje débil (Iy)" value={selected.Iy} unit="cm⁴" />
                  <PropertyRow label="Módulo elástico (Wy)" value={selected.Wy} unit="cm³" />
                  <PropertyRow label="Radio de giro (ry)" value={selected.ry} unit="cm" />
                  <PropertyRow
                    label="Torsión de St. Venant (J)"
                    value={selected.J}
                    unit="cm⁴"
                    hint="Rigidez torsional pura"
                  />
                  <PropertyRow
                    label="Alabeo (Cw)"
                    value={selected.Cw}
                    unit="cm⁶"
                    hint="Necesaria para pandeo lateral-torsional"
                  />
                  <PropertyRow label="Centro de gravedad (x)" value={selected.x} unit="cm" />
                  <PropertyRow label="Centro de corte (x₀)" value={selected.xo} unit="cm" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
