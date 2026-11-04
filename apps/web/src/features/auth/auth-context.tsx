"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/lib/types";

interface AuthContextValue {
  currentUser: CurrentUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCurrentUser(await apiFetch<CurrentUser>("/auth/me"));
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.localStorage.removeItem("hermes.accessToken");
    let active = true;
    async function loadSession() {
      try {
        const user = await apiFetch<CurrentUser>("/auth/me");
        if (active) setCurrentUser(user);
      } catch {
        if (active) setCurrentUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSession();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setLoading(true);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
    }
  }, []);

  const value = useMemo(() => ({ currentUser, loading, login, logout, refresh }), [currentUser, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return value;
}
