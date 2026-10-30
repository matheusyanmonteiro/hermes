"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Link2, RefreshCw, Video } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { apiFetch, formatDate } from "@/lib/api";
import type { DriveAccount } from "@/lib/types";

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["drive-accounts"], queryFn: () => apiFetch<{ items: DriveAccount[] }>("/drive/accounts") });
  const connect = useMutation({ mutationFn: () => apiFetch<{ authorizationUrl: string }>("/drive/oauth/start", { method: "POST" }), onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl), onError: (error) => setMessage(error instanceof Error ? error.message : "Falha ao iniciar conexão") });
  const sync = useMutation({ mutationFn: (id: string) => apiFetch<{ filesFound: number; created: number; updated: number; removed: number }>(`/drive/accounts/${id}/sync`, { method: "POST" }), onSuccess: (result) => { setMessage(`Sincronização concluída: ${result.filesFound} arquivos encontrados.`); void queryClient.invalidateQueries({ queryKey: ["drive-accounts"] }); }, onError: (error) => setMessage(error instanceof Error ? error.message : "Falha na sincronização") });
  return <>
    <PageHeader eyebrow="Origens do acervo" title="Contas do Google Drive" description="Conecte contas, acompanhe a saúde da autorização e sincronize o catálogo." actions={<button className="button primary" onClick={() => connect.mutate()} disabled={connect.isPending}><Link2 size={16} /> Conectar conta</button>} />
    {message && <div className={`form-alert ${(connect.isError || sync.isError) ? "error" : ""}`}>{message}</div>}
    {query.isLoading ? <LoadingState /> : query.error ? <ErrorState message={query.error instanceof Error ? query.error.message : "Falha ao consultar contas"} /> : !query.data?.items.length ? <EmptyState title="Nenhuma conta conectada" description="Conecte uma conta Google com acesso aos vídeos do acervo." /> : <div className="cards-grid">{query.data.items.map((account) => <article className="account-card panel" key={account.id}><div className="account-card-top"><span className="account-icon"><Cloud size={23} /></span><StatusBadge status={account.status} /></div><h2>{account.displayName || "Conta Google Drive"}</h2><p>{account.email}</p><div className="account-metrics"><span><Video size={15} /><strong>{account._count?.videos ?? 0}</strong><small>vídeos</small></span><span><Cloud size={15} /><strong>{account._count?.folders ?? 0}</strong><small>pastas</small></span></div>{account.lastError && <div className="form-alert error">{account.lastError}</div>}<footer><span className="muted">Sincronizada {formatDate(account.lastSyncedAt)}</span><button className="button secondary" onClick={() => sync.mutate(account.id)} disabled={sync.isPending}><RefreshCw size={15} className={sync.isPending ? "spin" : ""} /> Sincronizar</button></footer></article>)}</div>}
  </>;
}
