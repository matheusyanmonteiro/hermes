"use client";

import {
  BarChart3,
  ChevronDown,
  Cloud,
  FileVideo2,
  Gauge,
  LogOut,
  Menu,
  PanelLeftClose,
  Search,
  SendHorizontal,
  Settings,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "./ui";
import { useAuth } from "@/features/auth/auth-context";

const navigation = [
  { href: "/dashboard", label: "Visão geral", icon: Gauge },
  { href: "/biblioteca", label: "Biblioteca", icon: FileVideo2 },
  { href: "/upload", label: "Novo upload", icon: UploadCloud },
  { href: "/transferencias", label: "Transferências", icon: Zap },
  { href: "/contas", label: "Contas Drive", icon: Cloud },
  { href: "/usuarios", label: "Usuários", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !currentUser) router.replace(`/login?retorno=${encodeURIComponent(pathname)}`);
  }, [currentUser, loading, pathname, router]);

  if (loading || !currentUser) return <main className="fullscreen-state"><LoadingState label="Validando sua sessão" /></main>;

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const initials = currentUser.user.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className={`app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && <button className="sidebar-overlay" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><SendHorizontal size={22} /></span>
          <span className="brand-copy"><strong>Hermes</strong><small>Acervo educacional</small></span>
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          <span className="nav-label">Operação</span>
          {navigation.slice(0, 4).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={pathname.startsWith(href) ? "active" : ""} title={collapsed ? label : undefined}>
              <Icon size={19} /><span>{label}</span>
            </Link>
          ))}
          <span className="nav-label">Gestão</span>
          {navigation.slice(4).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={pathname.startsWith(href) ? "active" : ""} title={collapsed ? label : undefined}>
              <Icon size={19} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link href="/configuracoes" onClick={() => setMobileOpen(false)} className={pathname.startsWith("/configuracoes") ? "active" : ""}><Settings size={19} /><span>Configurações</span></Link>
          <button onClick={() => setCollapsed((value) => !value)} className="collapse-button"><PanelLeftClose size={18} /><span>Recolher menu</span></button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <div className="global-search"><Search size={18} /><input aria-label="Busca rápida" placeholder="Buscar vídeos, usuários…" onKeyDown={(event) => { if (event.key === "Enter") router.push(`/biblioteca?search=${encodeURIComponent(event.currentTarget.value)}`); }} /></div>
          <div className="user-menu">
            <span className="avatar">{initials}</span>
            <span className="user-copy"><strong>{currentUser.user.name}</strong><small>{currentUser.roles.join(" · ")}</small></span>
            <ChevronDown size={16} />
            <button onClick={handleLogout} className="logout-button" title="Sair"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
