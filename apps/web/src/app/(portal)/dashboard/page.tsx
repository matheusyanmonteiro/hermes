"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, CheckCircle2, Cloud, FileVideo2, ShieldCheck, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { ErrorState, LoadingState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import type { Campaign, DriveAccount, Transfer } from "@/lib/types";

interface DashboardData {
  metrics: { videoCount: number; userCount: number; batchCount: number; completedCount: number; failedCount: number };
  campaign: Campaign | null;
  driveAccounts: DriveAccount[];
  recentTransfers: (Transfer & { batch: { type: "UPLOAD" | "DOWNLOAD"; user: { name: string } } })[];
}

export default function DashboardPage() {
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/dashboard") });
  if (query.isLoading) return <LoadingState label="Montando sua visão geral" />;
  if (query.error || !query.data) return <ErrorState message={query.error instanceof Error ? query.error.message : "Não foi possível carregar o painel"} />;
  const { metrics, campaign, driveAccounts, recentTransfers } = query.data;
  const now = query.dataUpdatedAt;
  const totalOutcomes = metrics.completedCount + metrics.failedCount;
  const successRate = totalOutcomes ? Math.round((metrics.completedCount / totalOutcomes) * 100) : 0;
  const duration = campaign ? new Date(campaign.endsAt).getTime() - new Date(campaign.startsAt).getTime() : 0;
  const elapsed = campaign ? now - new Date(campaign.startsAt).getTime() : 0;
  const campaignProgress = duration > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100))) : 0;
  const daysLeft = campaign ? Math.max(0, Math.ceil((new Date(campaign.endsAt).getTime() - now) / 86_400_000)) : 0;

  return (
    <>
      <PageHeader eyebrow="Centro de operações" title="Visão geral" description="Acompanhe a campanha, o acervo e as transferências mais recentes em um só lugar." actions={<Link href="/biblioteca" className="button primary">Abrir biblioteca <ArrowRight size={16} /></Link>} />
      <section className="stats-grid">
        <StatCard label="Vídeos disponíveis" value={metrics.videoCount} hint="Arquivos ativos no acervo" icon={FileVideo2} />
        <StatCard label="Usuários ativos" value={metrics.userCount} hint="Com acesso ao portal" icon={Users} tone="violet" />
        <StatCard label="Transferências" value={metrics.batchCount} hint="Lotes registrados" icon={Activity} tone="amber" />
        <StatCard label="Taxa de conclusão" value={`${successRate}%`} hint={`${metrics.completedCount} confirmadas · ${metrics.failedCount} falhas`} icon={ShieldCheck} tone="green" />
      </section>
      <section className="content-grid">
        <article className="panel">
          <div className="panel-header"><div><h2>Atividade recente</h2><p>Eventos atualizados por ordem de ocorrência</p></div><Link href="/transferencias" className="button ghost">Ver todas</Link></div>
          <div className="table-wrap">
            <table><thead><tr><th>Arquivo</th><th>Tipo</th><th>Usuário</th><th>Volume</th><th>Status</th><th>Atualização</th></tr></thead>
              <tbody>{recentTransfers.map((transfer) => <tr key={transfer.id}>
                <td><div className="table-primary"><span className="file-icon"><FileVideo2 size={17} /></span><div><strong>{transfer.fileNameSnapshot}</strong><small>{transfer.id.slice(0, 8)}</small></div></div></td>
                <td><StatusBadge status={transfer.batch.type} /></td><td>{transfer.batch.user.name}</td><td>{formatBytes(transfer.fileSizeSnapshot)}</td><td><StatusBadge status={transfer.status} /></td><td className="muted">{formatDate(transfer.updatedAt)}</td>
              </tr>)}</tbody></table>
          </div>
        </article>
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <article className="panel">
            <div className="panel-header"><div><h2>Campanha atual</h2><p>Período operacional</p></div>{campaign && <StatusBadge status={campaign.status} />}</div>
            <div className="panel-body">
              {campaign ? <><strong style={{ display: "block", marginBottom: 7 }}>{campaign.name}</strong><span className="muted" style={{ fontSize: 11 }}>{formatDate(campaign.startsAt, false)} — {formatDate(campaign.endsAt, false)}</span><div className="progress-track" style={{ margin: "19px 0 8px" }}><span style={{ width: `${campaignProgress}%` }} /></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span className="muted">{campaignProgress}% do período</span><strong>{daysLeft} dias restantes</strong></div></> : <span className="muted">Nenhuma campanha configurada.</span>}
            </div>
          </article>
          <article className="panel">
            <div className="panel-header"><div><h2>Contas conectadas</h2><p>Saúde das origens</p></div><Link href="/contas" className="button ghost"><Cloud size={15} /> Gerenciar</Link></div>
            <div className="panel-body" style={{ display: "grid", gap: 12 }}>
              {driveAccounts.map((account) => <div key={account.id} style={{ display: "flex", alignItems: "center", gap: 10 }}><span className={`stat-icon ${account.status === "CONNECTED" ? "green" : "amber"}`} style={{ width: 34, height: 34 }}>{account.status === "CONNECTED" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}</span><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", overflow: "hidden", fontSize: 11, textOverflow: "ellipsis" }}>{account.displayName || account.email}</strong><small className="muted">{formatDate(account.lastSyncedAt)}</small></div></div>)}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
