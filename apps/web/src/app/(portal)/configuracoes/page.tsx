"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, LockKeyhole, Save, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { apiFetch, formatDate } from "@/lib/api";
import type { Campaign } from "@/lib/types";

function toLocalInput(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }

function CampaignSettings({ campaign }: { campaign: Campaign | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(campaign?.name ?? "");
  const [startsAt, setStartsAt] = useState(campaign ? toLocalInput(campaign.startsAt) : "");
  const [endsAt, setEndsAt] = useState(campaign ? toLocalInput(campaign.endsAt) : "");
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({ mutationFn: () => apiFetch<Campaign>("/campaign", { method: "PUT", body: JSON.stringify({ name, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), timezone: "America/Sao_Paulo" }) }), onSuccess: () => { setMessage("Configurações salvas."); void queryClient.invalidateQueries({ queryKey: ["campaign"] }); }, onError: (error) => setMessage(error instanceof Error ? error.message : "Falha ao salvar") });
  const close = useMutation({ mutationFn: () => apiFetch<Campaign>("/campaign/close", { method: "POST" }), onSuccess: () => { setMessage("Campanha encerrada. Novas transferências foram bloqueadas."); void queryClient.invalidateQueries({ queryKey: ["campaign"] }); }, onError: (error) => setMessage(error instanceof Error ? error.message : "Falha ao encerrar") });
  return <>
    <PageHeader eyebrow="Parâmetros operacionais" title="Configurações" description="Defina o período da campanha. A API aplica o encerramento mesmo sem agendamentos externos." />
    {message && <div className={`form-alert ${(save.isError || close.isError) ? "error" : ""}`}>{message}</div>}
    <div className="content-grid"><article className="panel"><div className="panel-header"><div><h2>Campanha de acesso</h2><p>Datas exibidas no fuso de São Paulo</p></div>{campaign && <StatusBadge status={campaign.status} />}</div><form className="panel-body form-grid" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}><label style={{ gridColumn: "1 / -1" }}>Nome da campanha<input required minLength={3} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Início<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><label>Encerramento<input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label><div style={{ gridColumn: "1 / -1", display: "flex", gap: 9 }}><button className="button primary" disabled={save.isPending}><Save size={16} /> Salvar período</button><button type="button" className="button danger" disabled={!campaign || campaign.status === "CLOSED" || close.isPending} onClick={() => { if (window.confirm("Encerrar agora? Novas transferências serão bloqueadas.")) close.mutate(); }}><LockKeyhole size={16} /> Encerrar agora</button></div></form></article><aside style={{ display: "grid", gap: 18, alignContent: "start" }}><article className="panel"><div className="panel-body info-feature"><span className="stat-icon amber"><CalendarClock size={20} /></span><div><strong>Regra no servidor</strong><p>O horário final é verificado pela API em toda nova solicitação de upload ou download.</p></div></div></article><article className="panel"><div className="panel-body info-feature"><span className="stat-icon violet"><ShieldAlert size={20} /></span><div><strong>Preservação da auditoria</strong><p>Encerrar a campanha não remove registros. O relatório continua disponível para conferência e exportação.</p></div></div></article>{campaign && <article className="panel"><div className="panel-body"><small className="muted">Período configurado</small><strong style={{ display: "block", marginTop: 7 }}>{formatDate(campaign.startsAt)}<br />até {formatDate(campaign.endsAt)}</strong></div></article>}</aside></div>
  </>;
}

export default function SettingsPage() {
  const query = useQuery({ queryKey: ["campaign"], queryFn: () => apiFetch<Campaign | null>("/campaign") });
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState message={query.error instanceof Error ? query.error.message : "Falha ao consultar configurações"} />;
  return <CampaignSettings key={`${query.data?.id ?? "new"}-${query.data?.endsAt ?? ""}`} campaign={query.data ?? null} />;
}
