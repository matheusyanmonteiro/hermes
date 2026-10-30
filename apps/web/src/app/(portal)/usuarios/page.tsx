"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, Shield, UserRound } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { apiFetch, formatDate } from "@/lib/api";
import type { UserStatus } from "@/lib/types";

interface Role { id: string; code: string; name: string; description?: string; _count: { users: number } }
interface PortalUser { id: string; name: string; email: string; status: UserStatus; lastLoginAt?: string; createdAt: string; roles: { role: Role }[] }

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const users = useQuery({ queryKey: ["users"], queryFn: () => apiFetch<{ items: PortalUser[] }>("/users") });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => apiFetch<{ items: Role[] }>("/roles") });
  const invite = useMutation({ mutationFn: () => apiFetch("/users", { method: "POST", body: JSON.stringify({ name, email, roleIds: [roleId] }) }), onSuccess: () => { setMessage("Convite registrado com sucesso."); setInviteOpen(false); setName(""); setEmail(""); void queryClient.invalidateQueries({ queryKey: ["users"] }); }, onError: (error) => setMessage(error instanceof Error ? error.message : "Falha ao convidar") });
  return <>
    <PageHeader eyebrow="Acesso e responsabilidade" title="Usuários" description="Gerencie convites, perfis e o estado das pessoas autorizadas a usar o portal." actions={<button className="button primary" onClick={() => setInviteOpen((value) => !value)}><MailPlus size={16} /> Convidar usuário</button>} />
    {message && <div className={`form-alert ${invite.isError ? "error" : ""}`}>{message}</div>}
    {inviteOpen && <article className="panel" style={{ marginBottom: 18 }}><div className="panel-header"><div><h2>Novo convite</h2><p>O perfil pode ser alterado posteriormente.</p></div></div><form className="panel-body form-grid" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}><label>Nome completo<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></label><label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Perfil<select required value={roleId} onChange={(event) => setRoleId(event.target.value)}><option value="">Selecione</option>{roles.data?.items.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label><div style={{ display: "flex", alignItems: "end", gap: 9 }}><button className="button primary" disabled={invite.isPending}>Enviar convite</button><button type="button" className="button secondary" onClick={() => setInviteOpen(false)}>Cancelar</button></div></form></article>}
    <article className="panel">{users.isLoading ? <LoadingState /> : users.error ? <ErrorState message={users.error instanceof Error ? users.error.message : "Falha ao consultar usuários"} /> : !users.data?.items.length ? <EmptyState title="Nenhum usuário" description="Convide a primeira pessoa para acessar o portal." /> : <div className="table-wrap"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th>Cadastrado</th></tr></thead><tbody>{users.data.items.map((user) => <tr key={user.id}><td><div className="table-primary"><span className="avatar"><UserRound size={16} /></span><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td><td><div style={{ display: "flex", gap: 5 }}>{user.roles.map(({ role }) => <span className="tag" style={{ color: "var(--blue)" }} key={role.id}><Shield size={10} /> {role.name}</span>)}</div></td><td><StatusBadge status={user.status} /></td><td className="muted">{formatDate(user.lastLoginAt)}</td><td className="muted">{formatDate(user.createdAt, false)}</td></tr>)}</tbody></table></div>}</article>
  </>;
}
