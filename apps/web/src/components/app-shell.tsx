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
  Settings,
  Tags,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { LoadingState } from "./ui";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Gauge;
  permission?: string;
  anyPermission?: string[];
};
const navigation: NavItem[] = [
  {
    href: "/dashboard",
    label: "Visão geral",
    icon: Gauge,
    permission: "dashboard:view",
  },
  {
    href: "/biblioteca",
    label: "Biblioteca",
    icon: FileVideo2,
    permission: "videos:view",
  },
  {
    href: "/upload",
    label: "Novo upload",
    icon: UploadCloud,
    permission: "uploads:create",
  },
  {
    href: "/transferencias",
    label: "Transferências",
    icon: Zap,
    anyPermission: ["transfers:view-own", "transfers:view-all"],
  },
  {
    href: "/tags",
    label: "Etiquetas",
    icon: Tags,
    permission: "videos:manage",
  },
  {
    href: "/contas",
    label: "Contas Drive",
    icon: Cloud,
    permission: "drive:manage",
  },
  {
    href: "/usuarios",
    label: "Usuários",
    icon: Users,
    permission: "users:view",
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    icon: BarChart3,
    permission: "reports:view",
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!loading && !currentUser)
      router.replace(`/login?retorno=${encodeURIComponent(pathname)}`);
  }, [currentUser, loading, pathname, router]);
  if (loading || !currentUser)
    return (
      <main className="fullscreen-state">
        <LoadingState label="Validando sua sessão" />
      </main>
    );
  const allowed = (item: NavItem) =>
    item.permission
      ? currentUser.permissions.includes(item.permission)
      : item.anyPermission?.some((permission) =>
          currentUser.permissions.includes(permission),
        );
  const operation = navigation.slice(0, 4).filter(allowed);
  const management = navigation.slice(4).filter(allowed);
  const initials = currentUser.user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const renderItem = ({ href, label, icon: Icon }: NavItem) => (
    <Link
      key={href}
      href={href}
      onClick={() => setMobileOpen(false)}
      className={pathname.startsWith(href) ? "active" : ""}
      title={collapsed ? label : undefined}
    >
      <Icon size={19} />
      <span>{label}</span>
    </Link>
  );
  return (
    <div className={`app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <img className="brand-logo" src="/edumidia-logo.svg" alt="EduMídia" />
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {operation.length > 0 && <span className="nav-label">Operação</span>}
          {operation.map(renderItem)}
          {management.length > 0 && <span className="nav-label">Gestão</span>}
          {management.map(renderItem)}
        </nav>
        <div className="sidebar-footer">
          {currentUser.permissions.includes("campaign:manage") && (
            <Link
              href="/configuracoes"
              onClick={() => setMobileOpen(false)}
              className={pathname.startsWith("/configuracoes") ? "active" : ""}
            >
              <Settings size={19} />
              <span>Configurações</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed((value) => !value)}
            className="collapse-button"
          >
            <PanelLeftClose size={18} />
            <span>Recolher menu</span>
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={21} />
          </button>
          <div className="global-search">
            <Search size={18} />
            <input
              aria-label="Busca rápida"
              placeholder="Buscar vídeos, usuários…"
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  router.push(
                    `/biblioteca?search=${encodeURIComponent(event.currentTarget.value)}`,
                  );
              }}
            />
          </div>
          <div className="user-menu">
            <span className="avatar">{initials}</span>
            <span className="user-copy">
              <strong>{currentUser.user.name}</strong>
              <small>{currentUser.roles.join(" · ")}</small>
            </span>
            <ChevronDown size={16} />
            <button
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
              className="logout-button"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
