"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileVideo2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { apiFetch, formatBytes } from "@/lib/api";
import type { DriveAccount } from "@/lib/types";

interface LocalFile { id: string; file: File; progress: number; status: "PENDING" | "IN_PROGRESS" | "COMPLETED_CLIENT" | "FAILED"; error?: string }
interface SessionsResponse { batchId: string; sessions: { transferId: string; clientId: string; sessionUrl: string; chunkSizeBytes: number }[] }

async function uploadInChunks(local: LocalFile, session: SessionsResponse["sessions"][number], update: (progress: number, status: LocalFile["status"], error?: string) => void) {
  let offset = 0;
  let driveFileId: string | undefined;
  update(0, "IN_PROGRESS");
  while (offset < local.file.size) {
    const endExclusive = Math.min(offset + session.chunkSizeBytes, local.file.size);
    const response = await fetch(session.sessionUrl, {
      method: "PUT",
      headers: { "content-type": local.file.type || "application/octet-stream", "content-range": `bytes ${offset}-${endExclusive - 1}/${local.file.size}` },
      body: local.file.slice(offset, endExclusive),
    });
    if (response.status !== 308 && !response.ok) throw new Error(`O Drive recusou um bloco (${response.status})`);
    offset = endExclusive;
    update(Math.round((offset / local.file.size) * 100), "IN_PROGRESS");
    if (response.ok && response.status !== 308) {
      const payload = await response.json() as { id?: string };
      driveFileId = payload.id;
    }
  }
  if (!driveFileId) throw new Error("O Drive não confirmou o arquivo enviado");
  await apiFetch(`/uploads/${session.transferId}/complete`, { method: "POST", body: JSON.stringify({ driveFileId }) });
  update(100, "COMPLETED_CLIENT");
}

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [accountId, setAccountId] = useState("");
  const [dragging, setDragging] = useState(false);
  const accounts = useQuery({ queryKey: ["drive-accounts"], queryFn: () => apiFetch<{ items: DriveAccount[] }>("/drive/accounts") });

  function addFiles(list: FileList | File[]) {
    const accepted = [...list].filter((file) => file.type.startsWith("video/"));
    setFiles((current) => [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), file, progress: 0, status: "PENDING" as const }))]);
  }
  function updateFile(id: string, progress: number, status: LocalFile["status"], error?: string) {
    setFiles((current) => current.map((item) => item.id === id ? { ...item, progress, status, error } : item));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const pending = files.filter((item) => item.status === "PENDING" || item.status === "FAILED");
      const result = await apiFetch<SessionsResponse>("/uploads/sessions", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ accountId, files: pending.map((item) => ({ clientId: item.id, name: item.file.name, sizeBytes: item.file.size, mimeType: item.file.type || "application/octet-stream" })) }),
      });
      const queue = [...result.sessions];
      const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
        while (queue.length) {
          const session = queue.shift()!;
          const local = pending.find((item) => item.id === session.clientId)!;
          try { await uploadInChunks(local, session, (progress, status, error) => updateFile(local.id, progress, status, error)); }
          catch (error) { updateFile(local.id, local.progress, "FAILED", error instanceof Error ? error.message : "Falha no upload"); }
        }
      });
      await Promise.all(workers);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ["transfers"] }); void queryClient.invalidateQueries({ queryKey: ["videos"] }); },
  });

  if (accounts.isLoading) return <LoadingState />;
  if (accounts.error) return <ErrorState message={accounts.error instanceof Error ? accounts.error.message : "Falha ao consultar contas"} />;
  const connected = accounts.data?.items.filter((account) => account.status === "CONNECTED") ?? [];
  const totalSize = files.reduce((sum, item) => sum + item.file.size, 0);
  const canStart = files.length > 0 && Boolean(accountId) && !mutation.isPending;

  return <>
    <PageHeader eyebrow="Transferência para o Drive" title="Novo upload" description="Envie vários vídeos com blocos retomáveis. A aba precisa permanecer aberta durante a transferência." actions={<button className="button primary" disabled={!canStart} onClick={() => mutation.mutate()}><UploadCloud size={17} />{mutation.isPending ? "Enviando…" : "Iniciar uploads"}</button>} />
    <div className="content-grid">
      <article className="panel">
        <div className="panel-header"><div><h2>Arquivos</h2><p>{files.length ? `${files.length} arquivos · ${formatBytes(totalSize)}` : "Selecione os vídeos para enviar"}</p></div></div>
        <div className="panel-body">
          <input ref={inputRef} type="file" accept="video/*" multiple hidden onChange={(event) => event.target.files && addFiles(event.target.files)} />
          <button className={`upload-dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
            <span className="upload-illustration"><UploadCloud size={28} /></span><strong>Arraste os vídeos para cá</strong><small>ou clique para escolher arquivos do computador</small><span>MP4, WebM e outros formatos de vídeo</span>
          </button>
          {files.length > 0 && <div className="upload-list">{files.map((item) => <div className="upload-item" key={item.id}><span className="file-icon">{item.status === "COMPLETED_CLIENT" ? <CheckCircle2 size={17} /> : <FileVideo2 size={17} />}</span><div className="upload-file-copy"><strong>{item.file.name}</strong><small>{formatBytes(item.file.size)} {item.error ? `· ${item.error}` : ""}</small><div className="progress-track"><span style={{ width: `${item.progress}%` }} /></div></div><StatusBadge status={item.status} /><button className="icon-button" disabled={item.status === "IN_PROGRESS"} onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}><Trash2 size={16} /></button></div>)}</div>}
        </div>
      </article>
      <aside className="panel" style={{ alignSelf: "start" }}>
        <div className="panel-header"><div><h2>Destino</h2><p>Conta e pasta do Google Drive</p></div></div>
        <div className="panel-body form-stack"><label>Conta conectada<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Selecione uma conta</option>{connected.map((account) => <option key={account.id} value={account.id}>{account.displayName || account.email}</option>)}</select></label>{!connected.length && <div className="form-alert error">Nenhuma conta do Drive está conectada. Conecte uma conta antes de enviar arquivos.</div>}<div className="info-box"><strong>Como funciona</strong><p>Até dois arquivos são enviados ao mesmo tempo. Falhas ficam registradas e podem ser tentadas novamente.</p></div></div>
      </aside>
    </div>
  </>;
}
