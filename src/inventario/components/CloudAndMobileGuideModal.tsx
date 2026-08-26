import { useState } from 'react';
import {
  Smartphone,
  Monitor,
  Cloud,
  X,
  Share2,
  Download,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Layers,
  Sparkles,
  Wifi,
  Database,
  Copy,
  Check
} from 'lucide-react';

interface CloudAndMobileGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudAndMobileGuideModal = ({
  isOpen,
  onClose
}: CloudAndMobileGuideModalProps) => {
  const [activeTab, setActiveTab] = useState<'celular' | 'pc_nube' | 'sincronizacion'>('celular');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Guía de Acceso en la Nube & Móvil
              </h2>
              <p className="text-xs text-slate-500">
                Cómo instalar y usar MaestranzaNest 1D en celulares de taller y en computadores vía web.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="p-2 border-b border-slate-200 bg-slate-100/80 grid grid-cols-3 gap-1.5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('celular')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'celular'
                ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. Instalar en Celular</span>
          </button>

          <button
            onClick={() => setActiveTab('pc_nube')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'pc_nube'
                ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>2. Ver en PC / Nube</span>
          </button>

          <button
            onClick={() => setActiveTab('sincronizacion')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'sincronizacion'
                ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>3. Datos & Respaldos</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-slate-800 text-sm leading-relaxed">
          {/* TAB 1: CELULAR */}
          {activeTab === 'celular' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-950 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-sm block mb-0.5">
                    Modo Aplicación PWA (Sin necesidad de Play Store / App Store)
                  </span>
                  Puedes agregar la app directamente a la pantalla de tu teléfono. Se abrirá a pantalla completa como una app nativa, ideal para el operador de sierra y el bodeguero en patio.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Android Chrome */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2.5">
                  <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                      Android
                    </span>
                    <span>En Google Chrome</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5">
                    <li>Abre el enlace de la aplicación en Chrome desde tu celular.</li>
                    <li>
                      Toca el menú de los <strong>tres puntos (⋮)</strong> en la esquina superior derecha.
                    </li>
                    <li>
                      Selecciona la opción <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
                    </li>
                    <li>Confirma haciendo clic en <strong>"Instalar"</strong>.</li>
                    <li>¡Listo! Aparecerá el ícono de <strong>MaestranzaNest 1D</strong> en tu menú de apps.</li>
                  </ol>
                </div>

                {/* iPhone Safari */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2.5">
                  <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                      iOS / iPhone
                    </span>
                    <span>En Safari</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5">
                    <li>Abre el enlace de la aplicación en el navegador Safari.</li>
                    <li>
                      Toca el botón central de <strong>Compartir (icono del cuadrado con flecha ↑)</strong>.
                    </li>
                    <li>
                      Baja y selecciona <strong>"Agregar a inicio" (Add to Home Screen)</strong>.
                    </li>
                    <li>Toca <strong>"Agregar"</strong> en la esquina superior.</li>
                    <li>¡Listo! Ya tienes acceso directo en tu pantalla de inicio.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PC / NUBE */}
          {activeTab === 'pc_nube' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Enlace de Acceso en la Nube (URL Web)
                  </span>
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '¡Copiado!' : 'Copiar Enlace'}</span>
                  </button>
                </div>

                <div className="p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 break-all select-all">
                  {currentUrl}
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="font-bold text-slate-900 text-sm">
                  Recomendaciones para el uso en Computador / Oficina Técnica:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-bold text-slate-900 block">Guardar en Favoritos / Marcadores</span>
                    <p className="text-slate-500">
                      Presiona <kbd className="bg-slate-200 px-1 py-0.5 rounded font-mono">Ctrl + D</kbd> (Windows) o <kbd className="bg-slate-200 px-1 py-0.5 rounded font-mono">Cmd + D</kbd> (Mac) en tu navegador para tener acceso instantáneo en 1 clic.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-bold text-slate-900 block">Compartir con el Taller</span>
                    <p className="text-slate-500">
                      Envía el enlace por WhatsApp o correo a tus supervisores y operadores de corte para que revisen los diagramas en sus pantallas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SINCRONIZACIÓN Y RESPALDOS */}
          {activeTab === 'sincronizacion' && (
            <div className="space-y-4 text-xs text-slate-600">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-950 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-sm block mb-0.5">
                    Persistencia Automática Local & Exportación en Excel
                  </span>
                  Tus datos de inventario, retazos y proyectos se guardan automáticamente en la memoria del navegador.
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-900 text-sm">
                  ¿Cómo transferir tu inventario entre el PC de la oficina y el celular del taller?
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                  <li>
                    En el PC, ve a la pestaña <strong>"5. Base de Datos / Bodega"</strong> y presiona <strong>"Exportar Excel"</strong> o <strong>"Exportar JSON"</strong>.
                  </li>
                  <li>Envía el archivo descargado por WhatsApp o correo a tu celular.</li>
                  <li>
                    En el celular, abre la app, ve a <strong>"5. Base de Datos / Bodega"</strong>, presiona <strong>"Cargar Excel / CSV"</strong> y selecciona el archivo.
                  </li>
                  <li>¡Todo el inventario y retazos quedarán inmediatamente sincronizados!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Compatible con Google Chrome, Microsoft Edge, Safari, Firefox y Opera.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
