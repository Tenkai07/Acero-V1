import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/auth/LoginScreen";
import { AuthenticatedApp } from "./AuthenticatedApp";

function AppGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 via-blue-600 to-slate-900 flex items-center justify-center shadow-lg text-white font-black text-sm border border-sky-400/30 animate-pulse">
          CL
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
