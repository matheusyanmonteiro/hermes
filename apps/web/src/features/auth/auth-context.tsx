"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, clearToken, saveToken, storedToken } from "@/lib/api";
import type { CurrentUser } from "@/lib/types";

interface AuthContextValue {
  currentUser: CurrentUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
let supabase: SupabaseClient | null = null;

function supabaseClient(): SupabaseClient {
  if (supabase) return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth não foi configurado");
  supabase = createClient(url, key);
  return supabase;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!storedToken()) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }
    try {
      setCurrentUser(await apiFetch<CurrentUser>("/auth/me"));
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      if (!storedToken()) {
        if (active) setLoading(false);
        return;
      }
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
    if (process.env.NEXT_PUBLIC_AUTH_MODE === "supabase") {
      const { data, error } = await supabaseClient().auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new Error(error?.message ?? "Login não autorizado");
      saveToken(data.session.access_token);
    } else {
      const result = await apiFetch<{ accessToken: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      saveToken(result.accessToken);
    }
    setLoading(true);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === "supabase") await supabaseClient().auth.signOut();
    clearToken();
    setCurrentUser(null);
  }, []);

  const value = useMemo(() => ({ currentUser, loading, login, logout, refresh }), [currentUser, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return value;
}
