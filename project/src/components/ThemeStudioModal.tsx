import React from "react";
import { 
  Palette, 
  Sun, 
  Moon, 
  Check, 
  Layers, 
  Monitor, 
  Sparkles, 
  Compass, 
  X,
  Sliders,
  DollarSign
} from "lucide-react";

export type VisualThemePreset = "titanium-dark" | "clean-light" | "blueprint-cad" | "obsidian-pro";
export type UIDensity = "compact" | "comfortable";

interface ThemeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: VisualThemePreset;
  onSelectTheme: (theme: VisualThemePreset) => void;
  density: UIDensity;
  onSelectDensity: (density: UIDensity) => void;
  basePriceKgCLP: number;
  onUpdateBasePriceKg: (price: number) => void;
  canEditPrice?: boolean;
}

export const THEME_PRESETS: {
  id: VisualThemePreset;
  name: string;
  subtitle: string;
  tag: string;
  previewBg: string;
  accentColor: string;
  textColor: string;
  description: string;
}[] = [
  {
    id: "titanium-dark",
    name: "Titanium Industrial & Sky",
    subtitle: "Pizarra Oscura & Celeste Acero",
    tag: "Estándar Pro",
    previewBg: "bg-slate-900 border-slate-700",
    accentColor: "bg-sky-500 text-slate-950",
    textColor: "text-white",
    description: "Modo oscuro profesional con tonos titanio, acentos celestes y contraste balanceado para talleres y oficinas técnicas."
  },
  {
    id: "clean-light",
    name: "Ingeniería & Proyectos",
    subtitle: "Clean Studio Light (Alto Contraste)",
    tag: "Sin Reflejos",
    previewBg: "bg-slate-100 border-slate-300",
    accentColor: "bg-blue-600 text-white",
    textColor: "text-slate-900",
    description: "Fondo claro nítido y descansado con tipografía grafito de alta legibilidad para revisión de cubicaciones y planos en oficinas luminosas."
  },
  {
    id: "blueprint-cad",
    name: "Plano Técnico CAD",
    subtitle: "Cyan Blueprint Milimétrico",
    tag: "Modo Dibujo",
    previewBg: "bg-sky-950 border-cyan-700",
    accentColor: "bg-cyan-400 text-slate-950",
    textColor: "text-cyan-100",
    description: "Estética de plano de taller con fondo azul rey profundo, cuadrícula de ingeniería y cotas cian luminosas."
  },
  {
    id: "obsidian-pro",
    name: "Obsidian Slate & Emerald",
    subtitle: "OLED Ultra Dark & Verde Esmeralda",
    tag: "Alto Contraste",
    previewBg: "bg-zinc-950 border-zinc-800",
    accentColor: "bg-emerald-500 text-slate-950",
    textColor: "text-zinc-100",
    description: "Negro absoluto para pantallas OLED y condiciones de baja luz, con acentos metálicos en verde esmeralda y gris grafito."
  }
];

export const ThemeStudioModal: React.FC<ThemeStudioModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
  density,
  onSelectDensity,
  basePriceKgCLP,
  onUpdateBasePriceKg,
  canEditPrice = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Personalizador Visual & Estilos de la Aplicación
              </h2>
              <p className="text-xs text-slate-400">
                Selecciona la apariencia que mejor se adapte a tu entorno de trabajo (Taller, Oficina, Terreno o CAD)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto">
          
          {/* Section 1: Themes Grid */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-sky-400 block">
              1. Selecciona un Estilo Visual / Tema:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {THEME_PRESETS.map((t) => {
                const isSelected = currentTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectTheme(t.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "bg-slate-800 border-sky-500 ring-2 ring-sky-500/60 shadow-lg"
                        : "bg-slate-950/70 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          {t.tag}
                        </span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/30">
                            <Check className="w-3.5 h-3.5" /> Activo
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-white mb-0.5">
                        {t.name}
                      </div>
                      <div className="text-xs text-sky-400/90 font-medium mb-1.5">
                        {t.subtitle}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                        {t.description}
                      </p>
                    </div>

                    {/* Visual Color Swatch Strip */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
                      <span className={`w-5 h-5 rounded-md border ${t.previewBg}`} />
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.accentColor}`}>
                        Color Acento
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Density Options */}
          <div className="space-y-2 pt-4 border-t border-slate-800">
            <label className="text-xs font-bold uppercase tracking-wider text-sky-400 block">
              2. Densidad de Información en Pantalla:
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onSelectDensity("compact")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  density === "compact"
                    ? "bg-sky-500/15 border-sky-500 text-white font-bold"
                    : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">Modo Compacto Maestranza</span>
                  {density === "compact" && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  Ideal para ver más perfiles, cotas y precios simultáneamente sin necesidad de desplazarse tanto.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onSelectDensity("comfortable")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  density === "comfortable"
                    ? "bg-sky-500/15 border-sky-500 text-white font-bold"
                    : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">Modo Espacioso / Estudio</span>
                  {density === "comfortable" && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  Espaciado generoso y descansado para pantallas de alta resolución y revisión pausada.
                </p>
              </button>
            </div>
          </div>

          {/* Section 3: Global Base Price $/kg */}
          <div className="space-y-2 pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                <span>3. Precio Base Global Referencial ($ CLP / kg):</span>
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                ${basePriceKgCLP.toLocaleString("es-CL")} CLP/kg
              </span>
            </div>
            
            <p className="text-[11px] text-slate-400">
              Este valor actualiza automáticamente los precios de todas las barras (6m y 12m) y planchas en todas las calculadoras y manuales.
            </p>

            {canEditPrice ? (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1000"
                  max="2500"
                  step="25"
                  value={basePriceKgCLP}
                  onChange={(e) => onUpdateBasePriceKg(parseInt(e.target.value) || 1420)}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex gap-1.5 shrink-0">
                  {[1350, 1420, 1550, 1750].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onUpdateBasePriceKg(preset)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                        basePriceKgCLP === preset
                          ? "bg-sky-500 text-slate-950 border-sky-400"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-amber-400/80 bg-amber-950/20 border border-amber-900/40 rounded-lg px-3 py-2">
                Solo un administrador puede modificar el precio base.
              </p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
          >
            Aplicar y Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
