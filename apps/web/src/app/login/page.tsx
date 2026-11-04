"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@hermes/contracts";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, SendHorizontal } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/features/auth/auth-context";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { currentUser, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDevelopment = process.env.NEXT_PUBLIC_AUTH_MODE === "development";
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: isDevelopment ? { email: "admin@hermes.local", password: "hermes-dev" } : { email: "", password: "" },
  });

  useEffect(() => {
    if (currentUser) router.replace(params.get("retorno") || "/dashboard");
  }, [currentUser, params, router]);

  async function onSubmit(input: LoginInput) {
    setError(null);
    try {
      await login(input.email, input.password);
      router.replace(params.get("retorno") || "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar");
    }
  }

  return (
    <main className="login-layout">
      <section className="login-story">
        <div className="story-grid" />
        <div className="story-brand"><span className="brand-mark"><SendHorizontal size={22} /></span><strong>Hermes</strong></div>
        <div className="story-copy">
          <span className="eyebrow light">Acervo educacional seguro</span>
          <h1>Conteúdo que chega.<br /><em>Confiança que fica.</em></h1>
          <p>Distribua mídias educacionais com controle de acesso, rastreabilidade e relatórios claros.</p>
          <ul>
            <li><CheckCircle2 size={18} /> Auditoria detalhada por arquivo e usuário</li>
            <li><CheckCircle2 size={18} /> Transferências grandes, retomáveis e seguras</li>
            <li><CheckCircle2 size={18} /> Campanhas com encerramento automático</li>
          </ul>
        </div>
        <small className="story-footnote">Instituto Sagres · Tecnologia a serviço da educação</small>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-heading">
            <span className="login-icon"><LockKeyhole size={22} /></span>
            <h2>Bem-vindo de volta</h2>
            <p>Entre com sua conta para acessar o portal.</p>
          </div>
          {params.get("expirada") && <div className="form-alert">Sua sessão expirou. Entre novamente.</div>}
          {error && <div className="form-alert error">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)} className="form-stack">
            <label>E-mail institucional<input type="email" autoComplete="email" placeholder="nome@instituicao.org" {...register("email")} />{errors.email && <small>{errors.email.message}</small>}</label>
            <label>Senha<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" {...register("password")} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password && <small>{errors.password.message}</small>}</label>
            <button className="button primary wide" type="submit" disabled={isSubmitting}>{isSubmitting ? "Entrando…" : <>Entrar no portal <ArrowRight size={18} /></>}</button>
          </form>
          {isDevelopment && <div className="dev-access"><strong>Acesso local de desenvolvimento</strong><span>admin@hermes.local · senha hermes-dev</span></div>}
          <p className="login-help">Problemas para acessar? Procure o administrador do portal.</p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="fullscreen-state">Carregando…</main>}><LoginForm /></Suspense>;
}
