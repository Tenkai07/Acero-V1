import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Warehouse,
  Boxes,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,
  Scissors,
  RefreshCw,
  Lock
} from "lucide-react";
import { authFetch } from "../utils/authToken";
import { MaterialStockItem, BOMProject } from "../inventario/types";
import { SteelProject } from "../types";
import { computeProjectProfitability, ProjectProfitability } from "../utils/profitabilityReport";
import { getReservedBarsCount } from "../inventario/utils/stockReservations";

function fmtCLP(n: number): string {
  return `$${Math.round(n || 0).toLocaleString("es-CL")}`;
}

function materialValorized(m: MaterialStockItem): number {
  const barLenM = (m.standardBarLengthMm || 0) / 1000;
  const barsValue = m.standardBarsCount * barLenM * (m.costPerMeter || 0);
  const offcutsValue = m.offcuts.reduce((s, o) => s + (o.lengthMm / 1000) * (m.costPerMeter || 0), 0);
  return barsValue + offcutsValue;
}

interface StatTileProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel?: string;
  accent: "blue" | "emerald" | "amber" | "rose" | "slate";
}

const ACCENT_CLASSES: Record<StatTileProps["accent"], { bg: string; border: string; text: string; icon: string }> = {
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-300", icon: "text-blue-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", icon: "text-emerald-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-300", icon: "text-amber-400" },
  rose: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-300", icon: "text-rose-400" },
  slate: { bg: "bg-slate-800/60", border: "border-slate-700", text: "text-slate-200", icon: "text-slate-400" }
};

const StatTile = ({ icon: Icon, label, value, sublabel, accent }: StatTileProps) => {
  const c = ACCENT_CLASSES[accent];
  return (
    <div className={`p-4 rounded-2xl border ${c.bg} ${c.border} space-y-1`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${c.icon}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className={`text-2xl font-black ${c.text}`}>{value}</div>
      {sublabel && <div className="text-[11px] text-slate-500">{sublabel}</div>}
    </div>
  );
};

/** Barra horizontal simple (un solo hue secuencial, sin doble eje) */
const HBar: React.FC<{ label: string; value: number; max: number; formatValue: (n: number) => string; color?: string }> = ({
  label,
  value,
  max,
  formatValue,
  color = "bg-sky-500"
}) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium truncate pr-2">{label}</span>
        <span className="text-slate-400 font-mono shrink-0">{formatValue(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

interface SectionCardProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const SectionCard = ({ icon: Icon, title, subtitle, children }: SectionCardProps) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-sky-400" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

export const DashboardView = () => {
  const [inventory, setInventory] = useState<MaterialStockItem[]>([]);
  const [bomProjects, setBomProjects] = useState<BOMProject[]>([]);
  const [steelProjects, setSteelProjects] = useState<SteelProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, bomRes, projRes] = await Promise.all([
        authFetch("/api/inventory"),
        authFetch("/api/bom-projects"),
        authFetch("/api/projects")
      ]);
      const invData = await invRes.json();
      const bomData = await bomRes.json();
      const projData = await projRes.json();
      if (invData.success) setInventory(invData.inventory || []);
      if (bomData.success) setBomProjects(bomData.bomProjects || []);
      if (projData.success) setSteelProjects(projData.projects || []);
    } catch (e) {
      setError("No se pudo cargar el dashboard. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ---------------------------------------------------------------------
  // Inventario
  // ---------------------------------------------------------------------
  const totalValorizado = useMemo(() => inventory.reduce((s, m) => s + materialValorized(m), 0), [inventory]);
  const bajoMinimo = useMemo(() => inventory.filter((m) => m.standardBarsCount < m.minStockBars), [inventory]);
  const totalRetazos = useMemo(() => inventory.reduce((s, m) => s + m.offcuts.length, 0), [inventory]);
  const materialesConReserva = useMemo(
    () => inventory.filter((m) => getReservedBarsCount(m) > 0 || m.offcuts.some((o) => o.reservedForProject)),
    [inventory]
  );
  const topValorizados = useMemo(
    () =>
      [...inventory]
        .map((m) => ({ code: m.code, value: materialValorized(m) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    [inventory]
  );
  const maxValorizado = Math.max(1, ...topValorizados.map((m) => m.value));

  // ---------------------------------------------------------------------
  // Cubicación
  // ---------------------------------------------------------------------
  const activosBomProjects = useMemo(
    () => bomProjects.filter((p) => p.status !== "completado"),
    [bomProjects]
  );
  const totalBarrasPendientes = useMemo(
    () => activosBomProjects.reduce((s, p) => s + (p.totalBarsToBuy || 0), 0),
    [activosBomProjects]
  );
  const avgAprovechamiento = useMemo(() => {
    const withData = bomProjects.filter((p) => p.totalBarsTheoretical > 0);
    if (withData.length === 0) return 0;
    const sum = withData.reduce((s, p) => {
      const netMeters = p.groups.reduce((gs, g) => gs + g.totalLengthMm, 0) / 1000;
      const grossMeters = (p.totalBarsTheoretical * (p.groups[0]?.commercialBarLengthMm || 6000)) / 1000;
      return s + (grossMeters > 0 ? (netMeters / grossMeters) * 100 : 0);
    }, 0);
    return sum / withData.length;
  }, [bomProjects]);
  const deficitPorPerfil = useMemo(() => {
    const map = new Map<string, number>();
    activosBomProjects.forEach((p) => {
      p.groups.forEach((g) => {
        const buy = g.stockComparison?.barsToBuy || 0;
        if (buy <= 0) return;
        map.set(g.cleanProfileCode, (map.get(g.cleanProfileCode) || 0) + buy);
      });
    });
    return Array.from(map.entries())
      .map(([code, bars]) => ({ code, bars }))
      .sort((a, b) => b.bars - a.bars)
      .slice(0, 6);
  }, [activosBomProjects]);
  const maxDeficit = Math.max(1, ...deficitPorPerfil.map((d) => d.bars));

  // ---------------------------------------------------------------------
  // Rentabilidad
  // ---------------------------------------------------------------------
  const profitabilities = useMemo<ProjectProfitability[]>(
    () =>
      bomProjects
        .filter((p) => p.esReal && p.linkedSteelProjectId)
        .map((p) => computeProjectProfitability(p, steelProjects, inventory)),
    [bomProjects, steelProjects, inventory]
  );
  const conMargen = profitabilities.filter((p) => p.margenPct !== null);
  const margenPromedio = conMargen.length > 0 ? conMargen.reduce((s, p) => s + (p.margenPct || 0), 0) / conMargen.length : null;
  const proyectosConPerdida = conMargen.filter((p) => (p.margenPct || 0) < 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Cargando dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Dashboard General</h2>
            <p className="text-xs sm:text-sm text-slate-400">Resumen ejecutivo de bodega, cubicaciones y rentabilidad.</p>
          </div>
        </div>
        <button
          onClick={loadAll}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Resumen ejecutivo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={Warehouse}
          label="Valor de Bodega"
          value={fmtCLP(totalValorizado)}
          sublabel={`${inventory.length} materiales`}
          accent="blue"
        />
        <StatTile
          icon={AlertTriangle}
          label="Bajo Stock Mínimo"
          value={String(bajoMinimo.length)}
          sublabel={bajoMinimo.length > 0 ? "Requiere reposición" : "Todo en orden"}
          accent={bajoMinimo.length > 0 ? "rose" : "emerald"}
        />
        <StatTile
          icon={Boxes}
          label="Cubicaciones Activas"
          value={String(activosBomProjects.length)}
          sublabel={`${totalBarrasPendientes} barras pendientes de comprar`}
          accent="amber"
        />
        <StatTile
          icon={TrendingUp}
          label="Margen Promedio"
          value={margenPromedio !== null ? `${margenPromedio.toFixed(1)}%` : "—"}
          sublabel={conMargen.length > 0 ? `${conMargen.length} proyecto(s) con presupuesto vinculado` : "Sin proyectos vinculados"}
          accent={margenPromedio === null ? "slate" : margenPromedio >= 0 ? "emerald" : "rose"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Inventario */}
        <SectionCard icon={Warehouse} title="Inventario / Bodega" subtitle="Estado general de existencias">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800">
              <div className="text-lg font-black text-white">{inventory.reduce((s, m) => s + m.standardBarsCount, 0)}</div>
              <div className="text-[10px] text-slate-500 uppercase">Barras/Planchas</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800">
              <div className="text-lg font-black text-white">{totalRetazos}</div>
              <div className="text-[10px] text-slate-500 uppercase">Retazos</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2.5 border border-amber-800/60">
              <div className="text-lg font-black text-amber-300 flex items-center justify-center gap-1">
                <Lock className="w-3.5 h-3.5" /> {materialesConReserva.length}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">Con Reservas</div>
            </div>
          </div>

          {topValorizados.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Top Materiales por Valor</span>
              {topValorizados.map((m) => (
                <HBar key={m.code} label={m.code} value={m.value} max={maxValorizado} formatValue={fmtCLP} color="bg-blue-500" />
              ))}
            </div>
          )}

          {bajoMinimo.length > 0 && (
            <div className="pt-1 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Bajo Stock Mínimo
              </span>
              <div className="flex flex-wrap gap-1.5">
                {bajoMinimo.slice(0, 8).map((m) => (
                  <span key={m.id} className="bg-rose-950/50 border border-rose-900/60 text-rose-300 text-[11px] font-mono px-2 py-1 rounded-lg">
                    {m.code}: {m.standardBarsCount}/{m.minStockBars}
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Cubicación */}
        <SectionCard icon={Scissors} title="Cubicación / GoNest 1D" subtitle="Proyectos activos y déficit de compra">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800">
              <div className="text-lg font-black text-white">{bomProjects.length}</div>
              <div className="text-[10px] text-slate-500 uppercase">Guardadas</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800">
              <div className="text-lg font-black text-white">{avgAprovechamiento.toFixed(0)}%</div>
              <div className="text-[10px] text-slate-500 uppercase">Aprov. Promedio</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2.5 border border-amber-800/60">
              <div className="text-lg font-black text-amber-300">{totalBarrasPendientes}</div>
              <div className="text-[10px] text-slate-500 uppercase">Barras a Comprar</div>
            </div>
          </div>

          {deficitPorPerfil.length > 0 ? (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mayor Déficit por Perfil (barras)</span>
              {deficitPorPerfil.map((d) => (
                <HBar key={d.code} label={d.code} value={d.bars} max={maxDeficit} formatValue={(n) => `${n} b.`} color="bg-amber-500" />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-3">No hay proyectos activos con material pendiente de comprar.</p>
          )}
        </SectionCard>
      </div>

      {/* Rentabilidad */}
      <SectionCard icon={ShoppingCart} title="Rentabilidad de Proyectos" subtitle="Costo real de materiales vs. presupuesto vinculado">
        {profitabilities.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">
            No hay cubicaciones marcadas como "reales" y vinculadas a un presupuesto todavía.
          </p>
        ) : (
          <div className="space-y-2">
            {profitabilities
              .sort((a, b) => (a.margenPct ?? 0) - (b.margenPct ?? 0))
              .map((p) => {
                const positive = (p.margenPct ?? 0) >= 0;
                return (
                  <div
                    key={p.bomProjectId}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                      positive ? "bg-emerald-950/30 border-emerald-900/50" : "bg-rose-950/30 border-rose-900/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {positive ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-200 truncate">{p.bomProjectName}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          Costo real: {fmtCLP(p.costoRealTotalCLP)} · Presupuesto: {fmtCLP(p.presupuestadoCLP || 0)}
                        </div>
                      </div>
                    </div>
                    <span className={`font-mono font-black shrink-0 ml-2 ${positive ? "text-emerald-300" : "text-rose-300"}`}>
                      {p.margenPct !== null ? `${p.margenPct > 0 ? "+" : ""}${p.margenPct}%` : "—"}
                    </span>
                  </div>
                );
              })}
            {proyectosConPerdida > 0 && (
              <p className="text-[11px] text-rose-400 pt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {proyectosConPerdida} proyecto(s) con margen negativo.
              </p>
            )}
          </div>
        )}
      </SectionCard>

      <p className="text-[11px] text-slate-600 text-center flex items-center justify-center gap-1.5">
        <Package className="w-3 h-3" /> Datos en vivo desde bodega, cubicaciones guardadas y proyectos con presupuesto.
      </p>
    </div>
  );
};
