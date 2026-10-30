"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckSquare2, Download, FileVideo2, Search, Square, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { apiFetch, apiUrl, formatBytes, formatDate, storedToken } from "@/lib/api";
import type { Video } from "@/lib/types";

interface VideoResponse { items: Video[]; pagination: { page: number; pageSize: number; total: number; pages: number } }
interface DownloadBatch { batch: { id: string; transfers: { id: string; fileNameSnapshot: string; fileSizeSnapshot: string }[] } }

async function receiveTransfer(transfer: DownloadBatch["batch"]["transfers"][number]) {
  const response = await fetch(apiUrl(`/downloads/${transfer.id}/content`), { headers: { authorization: `Bearer ${storedToken()}` } });
  if (!response.ok || !response.body) throw new Error(`Falha ao receber ${transfer.fileNameSnapshot}`);
  const picker = (window as Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable(): Promise<WritableStream> }> }).showSaveFilePicker;
  if (picker) {
    const handle = await picker({ suggestedName: transfer.fileNameSnapshot });
    const writable = await handle.createWritable();
    await response.body.pipeTo(writable);
  } else {
    if (Number(transfer.fileSizeSnapshot) > 128 * 1024 * 1024) throw new Error("Para arquivos grandes, use Chrome ou Edge e permita escolher o destino do arquivo.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = transfer.fileNameSnapshot; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  await apiFetch(`/downloads/${transfer.id}/events`, { method: "POST", body: JSON.stringify({ eventType: "COMPLETED_CLIENT", bytesTransferred: Number(transfer.fileSizeSnapshot) }) });
}

function LibraryContent() {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [appliedSearch, setAppliedSearch] = useState(params.get("search") ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["videos", appliedSearch], queryFn: () => apiFetch<VideoResponse>(`/videos?pageSize=50&search=${encodeURIComponent(appliedSearch)}`) });
  const selectedVideos = useMemo(() => query.data?.items.filter((video) => selected.has(video.id)) ?? [], [query.data, selected]);
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await apiFetch<DownloadBatch>("/downloads", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ videoIds: [...selected] }) });
      for (const transfer of result.batch.transfers) await receiveTransfer(transfer);
      return result;
    },
    onSuccess: () => { setNotice("Download concluído e registrado na auditoria."); setSelected(new Set()); },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Falha no download"),
  });

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function toggleAll() { const ids = query.data?.items.map((video) => video.id) ?? []; setSelected((current) => current.size === ids.length ? new Set() : new Set(ids)); }

  return <>
    <PageHeader eyebrow="Acervo unificado" title="Biblioteca" description="Localize, selecione e baixe os vídeos autorizados. Cada solicitação e resultado é auditado." />
    {notice && <div className={`form-alert ${mutation.isError ? "error" : ""}`} style={{ display: "flex", justifyContent: "space-between" }}>{notice}<button className="icon-button" onClick={() => setNotice(null)}><X size={16} /></button></div>}
    <div className="toolbar">
      <form className="toolbar-group" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search); }}><div className="input-shell"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome do vídeo" /></div><button className="button secondary" type="submit">Buscar</button></form>
      <div className="toolbar-group"><span className="muted" style={{ fontSize: 11 }}>{selected.size ? `${selected.size} selecionado(s) · ${formatBytes(selectedVideos.reduce((sum, video) => sum + Number(video.sizeBytes), 0))}` : `${query.data?.pagination.total ?? 0} vídeos`}</span><button className="button primary" disabled={!selected.size || mutation.isPending} onClick={() => mutation.mutate()}><Download size={16} />{mutation.isPending ? "Transferindo…" : "Baixar selecionados"}</button></div>
    </div>
    <article className="panel">
      {query.isLoading ? <LoadingState /> : query.error ? <ErrorState message={query.error instanceof Error ? query.error.message : "Falha ao carregar a biblioteca"} /> : !query.data?.items.length ? <EmptyState title="Nenhum vídeo encontrado" description="Altere a busca ou sincronize uma conta do Google Drive." /> : <div className="table-wrap"><table><thead><tr><th><button className="icon-button" onClick={toggleAll} aria-label="Selecionar todos">{selected.size === query.data.items.length ? <CheckSquare2 size={17} /> : <Square size={17} />}</button></th><th>Vídeo</th><th>Classificação</th><th>Origem</th><th>Tamanho</th><th>Modificado</th></tr></thead><tbody>{query.data.items.map((video) => <tr key={video.id} onClick={() => toggle(video.id)} style={{ cursor: "pointer" }}><td><button className="icon-button" onClick={(event) => { event.stopPropagation(); toggle(video.id); }}>{selected.has(video.id) ? <CheckSquare2 size={17} color="var(--blue)" /> : <Square size={17} />}</button></td><td><div className="table-primary"><span className="file-icon"><FileVideo2 size={17} /></span><div><strong title={video.name}>{video.name}</strong><small>{video.mimeType} {video.durationSeconds ? `· ${Math.round(video.durationSeconds / 60)} min` : ""}</small></div></div></td><td><div style={{ display: "flex", gap: 5 }}>{video.tags.map(({ tag }) => <span className="tag" style={{ color: tag.color }} key={tag.id}>{tag.name}</span>)}</div></td><td>{video.account.displayName || video.account.email}</td><td>{formatBytes(video.sizeBytes)}</td><td className="muted">{formatDate(video.driveModifiedAt)}</td></tr>)}</tbody></table></div>}
    </article>
  </>;
}

export default function LibraryPage() { return <Suspense fallback={<LoadingState />}><LibraryContent /></Suspense>; }
