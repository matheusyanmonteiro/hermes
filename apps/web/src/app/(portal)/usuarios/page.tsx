"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, History, KeyRound, MailPlus, Pencil, Shield, UserRound } from "lucide-react";
import { useState } from "react";
import { CustomSelect } from "@/components/controls";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { apiFetch, apiUrl, formatDate } from "@/lib/api";
import type { UserStatus } from "@/lib/types";

interface Role { id: string; name: string }
interface PortalUser { id: string; name: string; email: string; status: UserStatus; lastLoginAt?: string; createdAt: string; roles: { role: Role }[] }
interface AuditEvent { id: string; action: string; actionLabel: string; resourceType: string; resourceLabel: string; resourceName?: string | null; resourceId?: string | null; occurredAt: string; correlationId: string }
const generate = () => `H!${crypto.getRandomValues(new Uint32Array(3)).reduce((value, item) => value + item.toString(36), "").slice(0, 12)}9`;

function UserAudit({ user }: { user: PortalUser }) {
  const [error, setError] = useState<string | null>(null);
  const audit = useQuery({ queryKey: ["user-audit", user.id], queryFn: () => apiFetch<{ items: AuditEvent[] }>(`/users/${user.id}/audit`) });
  const exportPdf = async () => {
    try {
      setError(null);
      const response = await fetch(apiUrl(`/users/${user.id}/audit/export`), { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível gerar o PDF de auditoria.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `auditoria-${user.name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`; link.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao exportar auditoria."); }
  };
  return <article className="panel" style={{ marginBottom: 18 }}>
    <div className="panel-header"><div><h2>Auditoria de {user.name}</h2><p>Histórico das ações executadas e alterações relacionadas a esta conta.</p></div><button className="button secondary" onClick={exportPdf}><Download size={15}/>Exportar PDF</button></div>
    {error && <div className="form-alert">{error}</div>}
    <div className="panel-body">{audit.isLoading ? <LoadingState/> : audit.error ? <ErrorState message="Não foi possível carregar a auditoria deste usuário."/> : !audit.data?.items.length ? <EmptyState title="Sem eventos registrados" description="As próximas ações dessa conta aparecerão aqui."/> : <div className="table-wrap"><table><thead><tr><th>Data e hora</th><th>Evento</th><th>Recurso</th><th>ID da operação</th></tr></thead><tbody>{audit.data.items.map((event) => <tr key={event.id}><td>{formatDate(event.occurredAt)}</td><td><span className="tag"><History size={11}/>{event.actionLabel}</span></td><td><strong>{event.resourceName ?? event.resourceLabel}</strong>{event.resourceName ? <small className="muted">{event.resourceLabel}</small> : event.resourceId ? <small className="muted"> · {event.resourceId.slice(0, 8)}</small> : null}</td><td className="muted">{event.correlationId.slice(0, 12)}</td></tr>)}</tbody></table></div>}</div>
  </article>;
}

export default function UsersPage() {
  const qc = useQueryClient(); const [createOpen, setCreateOpen] = useState(false); const [editing, setEditing] = useState<PortalUser | null>(null); const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [roleId, setRoleId] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState<string | null>(null);
  const users = useQuery({ queryKey: ["users"], queryFn: () => apiFetch<{ items: PortalUser[] }>("/users") }); const roles = useQuery({ queryKey: ["roles"], queryFn: () => apiFetch<{ items: Role[] }>("/roles") }); const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });
  const create = useMutation({ mutationFn: () => apiFetch("/users", { method: "POST", body: JSON.stringify({ name, email, roleIds: [roleId], password }) }), onSuccess: () => { setMessage("Usuário criado. Copie a senha e envie por um canal seguro."); setCreateOpen(false); setName(""); setEmail(""); setPassword(""); void refresh(); }, onError: (reason) => setMessage(reason instanceof Error ? reason.message : "Falha ao criar usuário") });
  const update = useMutation({ mutationFn: (body: { password?: string; status?: "ACTIVE" | "INACTIVE" }) => apiFetch(`/users/${editing?.id}`, { method: "PATCH", body: JSON.stringify(body) }), onSuccess: () => { setMessage("Usuário atualizado."); setPassword(""); void refresh(); }, onError: (reason) => setMessage(reason instanceof Error ? reason.message : "Falha ao atualizar usuário") });
  const passwordField = <label>Senha temporária<div style={{ display: "flex", gap: 8 }}><input minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite ou gere uma senha"/><button className="button secondary" type="button" onClick={() => setPassword(generate())}><KeyRound size={15}/>Gerar</button><button className="icon-button" type="button" disabled={!password} onClick={() => navigator.clipboard.writeText(password)} title="Copiar senha"><Copy size={16}/></button></div><small>Use pelo menos 12 caracteres. Copie antes de salvar; ela não será exibida novamente.</small></label>;
  return <><PageHeader eyebrow="Acesso e responsabilidade" title="Usuários" description="Crie contas, redefina senhas e controle quem pode acessar o portal." actions={<button className="button primary" onClick={() => { setCreateOpen(!createOpen); setEditing(null); }}><MailPlus size={16}/>Novo usuário</button>}/>{message && <div className="form-alert">{message}</div>}
    {createOpen && <article className="panel" style={{ marginBottom: 18 }}><div className="panel-header"><div><h2>Novo usuário</h2><p>Defina uma senha temporária para o primeiro acesso.</p></div></div><form className="panel-body form-grid" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}><label>Nome<input required value={name} onChange={(event) => setName(event.target.value)}/></label><label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)}/></label><label>Perfil<CustomSelect value={roleId} onChange={setRoleId} placeholder="Selecione um perfil" options={(roles.data?.items ?? []).map((role) => ({ value: role.id, label: role.name }))}/></label>{passwordField}<button className="button primary" disabled={!roleId || password.length < 12 || create.isPending}>Criar usuário</button></form></article>}
    {editing && <><article className="panel" style={{ marginBottom: 18 }}><div className="panel-header"><div><h2>Editar acesso</h2><p>{editing.name} · {editing.email}</p></div><button className="button secondary" onClick={() => setEditing(null)}>Fechar</button></div><div className="panel-body form-grid">{passwordField}<label>Status<CustomSelect value={editing.status} onChange={(value) => update.mutate({ status: value as "ACTIVE" | "INACTIVE" })} placeholder="Status" options={[{ value: "ACTIVE", label: "Ativo" }, { value: "INACTIVE", label: "Inativo" }]}/><small>Uma conta inativa não consegue entrar no portal.</small></label><div style={{ display: "flex", alignItems: "end", gap: 9 }}><button className="button primary" disabled={password.length < 12 || update.isPending} onClick={() => update.mutate({ password })}>Salvar nova senha</button></div></div></article><UserAudit user={editing}/></>}
    <article className="panel">{users.isLoading ? <LoadingState/> : users.error ? <ErrorState message="Não foi possível carregar usuários."/> : !users.data?.items.length ? <EmptyState title="Nenhum usuário" description="Crie a primeira conta para acessar o portal."/> : <div className="table-wrap"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>{users.data.items.map((user) => <tr key={user.id}><td><div className="table-primary"><span className="avatar"><UserRound size={16}/></span><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td><td>{user.roles.map(({ role }) => <span className="tag" style={{ color: "var(--blue)" }} key={role.id}><Shield size={10}/> {role.name}</span>)}</td><td><StatusBadge status={user.status}/></td><td className="muted">{formatDate(user.lastLoginAt)}</td><td><button className="button secondary" onClick={() => { setEditing(user); setPassword(""); }}><Pencil size={14}/>Editar</button></td></tr>)}</tbody></table></div>}</article>
  </>;
}
