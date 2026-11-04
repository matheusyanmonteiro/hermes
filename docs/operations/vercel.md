# Deploy do Hermes na Vercel

O Hermes usa Vercel Services para publicar as duas aplicações Next.js do monorepo como um único projeto e domínio:

- `web`: interface em `/`;
- `api`: backend público em `/api/*`;
- bindings internos: nenhum, pois as chamadas atuais partem do navegador para a API pública.

A configuração está em `vercel.json`. A regra mais específica da API vem antes do catch-all do Web, e a API recebe o caminho original completo, como `/api/v1/health`.

## 1. Preparar o Supabase PostgreSQL

No painel do Supabase:

1. em **Project Settings > Database**, copie a conexão **Transaction pooler** para uso em runtime;
2. copie também a conexão **Session pooler** ou a conexão direta para executar migrations;

Use a conexão Transaction pooler como `DATABASE_URL`. Ela normalmente usa a porta `6543`; mantenha `sslmode=require` e acrescente `pgbouncer=true` na query string. Use a conexão Session pooler ou direta como `DIRECT_URL` somente no terminal que executará migrations e bootstrap.

O Hermes não usa o Supabase Auth nem as chaves da API do Supabase. Contas, hashes de senha, perfis e sessões pertencem à aplicação e ficam no PostgreSQL.

Antes do primeiro deploy, em um clone confiável do repositório, execute:

```powershell
$env:DIRECT_URL = "COLE_A_CONEXAO_SESSION_POOLER_OU_DIRETA"
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@seu-dominio.org.br"
$env:BOOTSTRAP_ADMIN_NAME = "Nome do administrador"
$env:BOOTSTRAP_ADMIN_PASSWORD = "UMA_SENHA_FORTE_COM_PELO_MENOS_12_CARACTERES"

pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm db:bootstrap

Remove-Item Env:DIRECT_URL
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL
Remove-Item Env:BOOTSTRAP_ADMIN_NAME
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD
```

No Linux, macOS ou WSL, defina as mesmas variáveis com `export`, execute os comandos e depois remova-as com `unset`.

`pnpm db:bootstrap` é idempotente: cria ou atualiza permissões, perfis e o primeiro administrador. Se for repetido, a senha informada substitui a anterior e as sessões antigas desse administrador são invalidadas. Não execute `pnpm db:seed` em produção, pois o seed contém dados demonstrativos.

## 2. Importar o projeto

Na conta Vercel:

1. clique em **Add New > Project**;
2. importe `matheusyanmonteiro/hermes`;
3. mantenha a raiz do projeto na raiz do repositório; não selecione `apps/api` nem `apps/web`;
4. selecione **Framework Preset: Services**, caso não seja detectado automaticamente;
5. escolha Node.js `24.x`;
6. mantenha os comandos de instalação e build detectados pela Vercel;
7. confirme que o painel mostra os serviços `api` e `web`.

Os serviços são construídos separadamente, mas compartilham o deploy, o domínio e a configuração do projeto. A API é exposta somente pela rewrite `/api/(.*)`; o Web recebe as demais rotas.

## 3. Variáveis de ambiente

Cadastre em **Settings > Environment Variables**, inicialmente para Production:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL do Transaction pooler do Supabase; tipo Secret |
| `AUTH_MODE` | `local` |
| `AUTH_SECRET` | segredo aleatório com pelo menos 32 caracteres; tipo Secret |
| `WEB_URL` | domínio final, por exemplo `https://hermes.vercel.app` |
| `API_URL` | o mesmo domínio final, sem `/api/v1` |
| `NEXT_PUBLIC_API_URL` | `/api/v1` |
| `NEXT_PUBLIC_AUTH_MODE` | `local`; tipo Config, pois é incluída no navegador |
| `TOKEN_ENCRYPTION_KEY` | chave Base64 de 32 bytes, exclusiva; tipo Secret |
| `OAUTH_STATE_SECRET` | segredo aleatório com pelo menos 32 caracteres; tipo Secret |
| `PORTAL_TIMEZONE` | `America/Sao_Paulo` |
| `UPLOAD_CHUNK_SIZE_BYTES` | `8388608` |
| `UPLOAD_CONCURRENCY` | `2` |
| `DOWNLOAD_CONCURRENCY` | `3` |

Como Web e API compartilham a origem, `NEXT_PUBLIC_API_URL=/api/v1` funciona em Production, Preview e domínio próprio sem CORS entre os serviços.

Não cadastre `DIRECT_URL`, `DEV_AUTH_SECRET`, `DEV_LOGIN_PASSWORD`, `POSTGRES_*` ou as variáveis `BOOTSTRAP_*` na Vercel. Também remova quaisquer variáveis antigas `SUPABASE_URL`, `SUPABASE_*_KEY` e `NEXT_PUBLIC_SUPABASE_*`: elas não são usadas. As credenciais Google também não ficam no ambiente; o administrador as informa de forma criptografada pelo portal.

Variáveis `NEXT_PUBLIC_*` fazem parte do bundle do navegador. Na Vercel, use visibilidade **Config** para elas; nunca configure uma variável pública como **Secret**.

Para gerar os segredos operacionais:

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Use a primeira saída em `TOKEN_ENCRYPTION_KEY`. Gere duas saídas independentes com o segundo comando para `AUTH_SECRET` e `OAUTH_STATE_SECRET`, e guarde cópias seguras. Alterar `AUTH_SECRET` encerra todas as sessões. Alterar `TOKEN_ENCRYPTION_KEY` depois de conectar contas Google torna os tokens armazenados indecifráveis e exige reconexão.

## 4. Fechar o domínio e publicar

Depois que a Vercel mostrar o domínio de produção:

1. defina esse endereço completo em `WEB_URL` e `API_URL`;
2. mantenha `NEXT_PUBLIC_API_URL=/api/v1`;
3. confira `AUTH_MODE=local` e `NEXT_PUBLIC_AUTH_MODE=local`;
4. faça **Redeploy** do projeto.

Para Preview, cadastre também as variáveis no ambiente Preview. O caminho relativo `/api/v1` acompanha automaticamente o domínio temporário do deploy.

## 5. Configurar o Google Drive

No Google Cloud:

1. ative a Google Drive API;
2. configure a tela de consentimento OAuth;
3. crie um cliente OAuth do tipo **Web application**;
4. cadastre `https://DOMINIO-DO-HERMES/api/v1/drive/oauth/callback` como URI autorizada.

Depois entre no Hermes como administrador, abra **Contas Drive**, informe Client ID e Client Secret e confirme a URI sugerida pelo portal. Esses dados ficam criptografados no banco.

Os uploads grandes são enviados pelo navegador diretamente à sessão retomável do Google Drive, evitando o limite de corpo das Functions. Os downloads continuam em streaming pela API; faça uma prova de conceito com os maiores arquivos esperados antes de abrir a operação.

## 6. Desenvolvimento e conferência

O Docker Compose continua sendo o fluxo local principal. Para reproduzir especificamente o roteamento da Vercel Services, use:

```text
vercel dev --local
```

No deploy, verifique nesta ordem:

1. `/api/v1/health` responde com `status: ok` e `database: connected`;
2. `/login` e `/dashboard` são entregues pelo serviço Web;
3. o administrador criado pelo `pnpm db:bootstrap` consegue entrar;
4. uma campanha ativa foi configurada;
5. o OAuth Google retorna para `/api/v1/drive/oauth/callback`;
6. sincronização, upload e download funcionam com arquivos reais;
7. relatórios e auditoria registram as transferências.

Quando uma variável for alterada, gere um novo deploy: variáveis da Vercel não modificam builds já concluídos.
