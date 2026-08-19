import React, { useState, useEffect } from "react";
import { Download, Smartphone, CheckCircle, Share2, Globe, QrCode, X, ArrowRight, ShieldCheck } from "lucide-react";

export const InstallModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [appUrl, setAppUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppUrl(window.location.href);

      // Listen for PWA beforeinstallprompt
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      // Check if already running in standalone mode (installed app)
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
      if (isStandalone) {
        setIsInstalled(true);
      }

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("appinstalled", () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const copyUrlToClipboard = () => {
    if (navigator.clipboard && appUrl) {
      navigator.clipboard.writeText(appUrl);
      alert("¡Enlace copiado al portapapeles! Envíatelo a tu WhatsApp o correo para abrirlo en el celular.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-sky-500/40 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-white">
        
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Instalar App en Celular Android</h3>
              <p className="text-xs text-slate-400">Instalación real como App nativa (PWA)</p>
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
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Quick Install button if supported by browser */}
          {deferredPrompt && (
            <div className="bg-sky-950/60 border border-sky-500 p-4 rounded-xl text-center space-y-2">
              <span className="text-xs font-bold text-sky-300 uppercase tracking-wider block">¡Instalador Directo Detectado!</span>
              <button
                onClick={handleNativeInstall}
                className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Instalar Aplicación en este Dispositivo</span>
              </button>
            </div>
          )}

          {/* Ayuda Paso a Paso Detallada */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              Guía paso a paso para abrir e instalar en tu Android:
            </h4>

            {/* Paso 1 */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div className="space-y-1 text-xs">
                <span className="font-bold text-white block">Envía el enlace a tu celular</span>
                <p className="text-slate-400 leading-relaxed">
                  Copia el enlace de la aplicación y envíatelo por <strong>WhatsApp</strong>, Telegram o correo electrónico.
                </p>
                <div className="pt-1.5 flex gap-2">
                  <button
                    onClick={copyUrlToClipboard}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-[11px] border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copiar Enlace Web</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-sky-500/50 bg-sky-950/20 flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-sky-300 block">Abre el enlace en Google Chrome</span>
                <p className="text-slate-300 leading-relaxed">
                  Toca el enlace desde tu celular para que se abra en el navegador <strong>Google Chrome</strong> (o Brave/Samsung Internet).
                </p>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-sky-300 select-all break-all">
                  {appUrl || "https://ais-pre-23vrxvzxiueopqp24ltkch-391549214460.us-east1.run.app"}
                </div>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <div className="space-y-1 text-xs">
                <span className="font-bold text-white block">Toca el menú de 3 puntos (⋮) en Chrome</span>
                <p className="text-slate-400 leading-relaxed">
                  En la esquina superior derecha de Google Chrome, presiona el icono de los <strong>tres puntos verticales (⋮)</strong>.
                </p>
              </div>
            </div>

            {/* Paso 4 */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                4
              </div>
              <div className="space-y-1 text-xs">
                <span className="font-bold text-white block">Selecciona "Instalar aplicación"</span>
                <p className="text-slate-400 leading-relaxed">
                  En el menú desplegable busca y presiona <strong>"Instalar aplicación"</strong> (o <strong>"Agregar a la pantalla principal"</strong>) y confirma presionando <strong>"Instalar"</strong>.
                </p>
              </div>
            </div>

            {/* Paso 5 */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/40 flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                ✓
              </div>
              <div className="space-y-1 text-xs">
                <span className="font-bold text-emerald-400 block">¡Listo! Quedará instalada como App</span>
                <p className="text-slate-400 leading-relaxed">
                  Verás el ícono de <strong>Aceros Chile</strong> en tu lista de aplicaciones de Android. Se abrirá a pantalla completa sin barra de navegador, guardará tus cubicaciones y funcionará ultra rápido.
                </p>
              </div>
            </div>

          </div>

          {/* Ventajas PWA */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 block flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              Ventajas de la instalación:
            </span>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
              <li>No ocupa gigabytes de memoria como una app pesada de Play Store.</li>
              <li>Actualizaciones automáticas instantáneas cada vez que se agreguen nuevos perfiles.</li>
              <li>Almacena tus proyectos y cálculos localmente en la memoria de tu teléfono.</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
