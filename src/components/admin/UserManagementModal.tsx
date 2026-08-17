import React, { useEffect, useState, useCallback } from "react";
import { X, UserPlus, Shield, ShieldCheck, KeyRound, Trash2, Loader2, AlertCircle, CheckCircle2, EyeOff, Eye } from "lucide-react";
import { authFetch } from "../../utils/authToken";
import { useAuth } from "../../context/AuthContext";

interface ManagedUser {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "operador";
  active: boolean;
  createdAt: string;
}

export const UserManagementModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "operador">("operador");
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || "No se pudo cargar la lista de usuarios");
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setSuccessMsg(null);
      setError(null);
    }
  }, [isOpen, loadUsers]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      setError("Usuario y contraseña son obligatorios");
      return;
    }
    setIsCreating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await authFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          fullName: newFullName.trim(),
          role: newRole
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Usuario "${data.user.username}" creado. Comparte estas credenciales con la persona.`);
        setNewUsername("");
        setNewFullName("");
        setNewPassword("");
        setNewRole("operador");
        loadUsers();
      } else {
        setError(data.error || "No se pudo crear el usuario");
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (u: ManagedUser) => {
    setError(null);
    const res = await authFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !u.active })
    });
    const data = await res.json();
    if (data.success) {
      loadUsers();
    } else {
      setError(data.error || "No se pudo actualizar el usuario");
    }
  };

  const handleToggleRole = async (u: ManagedUser) => {
    setError(null);
    const nextRole = u.role === "admin" ? "operador" : "admin";
    const res = await authFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: nextRole })
    });
    const data = await res.json();
    if (data.success) {
      loadUsers();
    } else {
      setError(data.error || "No se pudo actualizar el rol");
    }
  };

  const handleResetPassword = async (u: ManagedUser) => {
    const newPass = window.prompt(`Nueva contraseña para "${u.username}" (mínimo 4 caracteres):`);
    if (!newPass) return;
    setError(null);
    const res = await authFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword: newPass })
    });
    const data = await res.json();
    if (data.success) {
      setSuccessMsg(`Contraseña de "${u.username}" actualizada.`);
    } else {
      setError(data.error || "No se pudo cambiar la contraseña");
    }
  };

  const handleDelete = async (u: ManagedUser) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.username}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    const res = await authFetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      loadUsers();
    } else {
      setError(data.error || "No se pudo eliminar el usuario");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-sky-500/40 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-white">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-400" />
            Gestión de Usuarios
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-900/60 rounded-lg px-3 py-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Create user form */}
          <form onSubmit={handleCreateUser} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Crear nuevo usuario
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Usuario (para iniciar sesión)</label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  placeholder="jperez"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Nombre completo</label>
                <input
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  placeholder="Juan Pérez"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Contraseña inicial</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    placeholder="mínimo 4 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Rol</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "operador")}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                >
                  <option value="operador">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/50 text-slate-950 font-bold py-2 rounded-lg transition-all text-sm"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Crear usuario
            </button>
          </form>

          {/* User list */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Usuarios ({users.length})
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                      u.active ? "bg-slate-950 border-slate-800" : "bg-slate-950/50 border-slate-800/50 opacity-60"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold truncate">{u.username}</span>
                        {u.id === currentUser?.id && (
                          <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 rounded-full">
                            Tú
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            u.role === "admin"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-slate-700/50 text-slate-300 border border-slate-600/50"
                          }`}
                        >
                          {u.role === "admin" ? "Admin" : "Operador"}
                        </span>
                        {!u.active && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                            Desactivado
                          </span>
                        )}
                      </div>
                      {u.fullName && <p className="text-[11px] text-slate-500 truncate">{u.fullName}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        title="Restablecer contraseña"
                        onClick={() => handleResetPassword(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title={u.role === "admin" ? "Quitar rol de administrador" : "Hacer administrador"}
                        onClick={() => handleToggleRole(u)}
                        disabled={u.id === currentUser?.id}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title={u.active ? "Desactivar acceso" : "Activar acceso"}
                        onClick={() => handleToggleActive(u)}
                        disabled={u.id === currentUser?.id}
                        className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {u.active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        title="Eliminar usuario"
                        onClick={() => handleDelete(u)}
                        disabled={u.id === currentUser?.id}
                        className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
