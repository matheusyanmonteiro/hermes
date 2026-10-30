import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "blue" }: { label: string; value: string | number; hint: string; icon: LucideIcon; tone?: "blue" | "green" | "amber" | "violet" }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={20} /></div>
      <div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>
    </article>
  );
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Ativa", CLOSED: "Encerrada", SCHEDULED: "Agendada", DRAFT: "Rascunho",
  CONNECTED: "Conectada", DISCONNECTED: "Desconectada", ERROR: "Com erro", PENDING: "Pendente",
  REQUESTED: "Solicitada", AUTHORIZED: "Autorizada", STARTED: "Iniciada", IN_PROGRESS: "Em andamento",
  COMPLETED_CLIENT: "Recebida", FAILED: "Falhou", CANCELLED: "Cancelada", UNKNOWN: "Sem confirmação",
  INACTIVE: "Inativo", BLOCKED: "Bloqueado", INVITED: "Convidado", UPLOAD: "Upload", DOWNLOAD: "Download",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll("_", "-")}`}>{statusLabels[status] ?? status}</span>;
}

export function LoadingState({ label = "Carregando dados" }: { label?: string }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={24} /><span>{label}</span></div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-panel error"><AlertCircle size={24} /><span>{message}</span></div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Inbox size={28} /><strong>{title}</strong><p>{description}</p></div>;
}
