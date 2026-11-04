"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, ShieldCheck, UserRound, Video, XCircle } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingState, PageHeader, StatCard } from "@/components/ui";
import { apiFetch, apiUrl, formatDate } from "@/lib/api";

interface ReportData {
  summary: { users: number; videos: number; requested: number; completed: number; failed: number; unknown: number };
  users: { userId: string; name: string; email: string; requests: number; completions: number; distinctVideos: number; firstAt: string; lastAt: string }[];
  videos: { videoId: string; name: string; source: string; sizeBytes: string; requests: number; completions: number }[];
}

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false);
  const query = useQuery({ queryKey: ["download-report"], queryFn: () => apiFetch<ReportData>("/reports/downloads") });
  async function exportReport(format: "csv" | "xlsx") {
    setExporting(true);
    try {
      const response = await fetch(apiUrl(`/reports/downloads/export?format=${format}`), { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível exportar o relatório");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `relatorio-downloads.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally { setExporting(false); }
  }
  if (query.isLoading) return <LoadingState label="Consolidando o relatório" />;
  if (query.error || !query.data) return <ErrorState message={query.error instanceof Error ? query.error.message : "Falha ao gerar relatório"} />;
  const report = query.data;
  return <>
    <PageHeader eyebrow="Auditoria consolidada" title="Relatórios" description="Diferencie solicitações, recebimentos informados pelo cliente e resultados desconhecidos." actions={<><button className="button secondary" disabled={exporting} onClick={() => exportReport("csv")}><Download size={16} /> CSV</button><button className="button primary" disabled={exporting} onClick={() => exportReport("xlsx")}><FileSpreadsheet size={16} /> Excel completo</button></>} />
    <section className="stats-grid"><StatCard label="Usuários no relatório" value={report.summary.users} hint="Com eventos registrados" icon={UserRound} /><StatCard label="Vídeos movimentados" value={report.summary.videos} hint={`${report.summary.requested} solicitações`} icon={Video} tone="violet" /><StatCard label="Recebimentos informados" value={report.summary.completed} hint="Confirmação do navegador" icon={ShieldCheck} tone="green" /><StatCard label="Falhas e desconhecidos" value={report.summary.failed + report.summary.unknown} hint={`${report.summary.failed} falhas · ${report.summary.unknown} incertos`} icon={XCircle} tone="amber" /></section>
    <section className="content-grid"><article className="panel"><div className="panel-header"><div><h2>Downloads por usuário</h2><p>Consolidação baseada nos eventos brutos</p></div></div><div className="table-wrap"><table><thead><tr><th>Usuário</th><th>Solicitações</th><th>Conclusões</th><th>Vídeos</th><th>Última operação</th></tr></thead><tbody>{report.users.map((user) => <tr key={user.userId}><td><strong>{user.name}</strong><small className="muted" style={{ display: "block" }}>{user.email}</small></td><td>{user.requests}</td><td>{user.completions}</td><td>{user.distinctVideos}</td><td className="muted">{formatDate(user.lastAt)}</td></tr>)}</tbody></table></div></article><article className="panel"><div className="panel-header"><div><h2>Vídeos mais acessados</h2><p>Ordenação por conclusões</p></div></div><div className="panel-body report-ranking">{[...report.videos].sort((a, b) => b.completions - a.completions).slice(0, 6).map((video, index) => <div key={`${video.videoId}-${index}`}><span>{index + 1}</span><div><strong>{video.name}</strong><small>{video.source}</small><div className="progress-track"><span style={{ width: `${Math.max(8, (video.completions / Math.max(1, report.summary.completed)) * 100)}%` }} /></div></div><b>{video.completions}</b></div>)}</div></article></section>
  </>;
}
