import React, { useState } from "react";
import { Lock, User, LogIn, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Ingresa tu usuario y contraseña");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await login(username.trim(), password);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error || "No se pudo iniciar sesión");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] z-0" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-slate-900 flex items-center justify-center shadow-lg shadow-sky-950/40 text-white font-black text-2xl tracking-tighter border border-sky-400/30 mb-3">
            CL
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Aceros Chile</h1>
          <p className="text-xs text-slate-400 mt-1">Gestión de Materiales y Calculadoras Técnicas</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Usuario</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                placeholder="tu.usuario"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/50 text-slate-950 font-bold py-2.5 rounded-lg transition-all shadow-md"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="text-[11px] text-center text-slate-500 pt-1">
            Tu acceso es asignado por el administrador. Si no tienes usuario y contraseña, solicítalos a quien
            administra la aplicación.
          </p>
        </form>
      </div>
    </div>
  );
};
