# Deploy do Hermes na Vercel

O Hermes é um monorepo com duas aplicações Next.js. Na Vercel ele deve ser importado duas vezes, criando um projeto para a API e outro para a interface. Os dois projetos apontam para o mesmo repositório e usam diretórios raiz diferentes.

Nenhum segredo deve ser salvo em `.env`, commit, captura de tela ou conversa. Cadastre os valores sensíveis como variáveis do tipo **Secret** na Vercel.

## 1. Preparar o Supabase

No painel do Supabase:

1. em **Project Settings > Database**, copie a conexão **Transaction pooler** para uso em runtime;
2. copie também a conexão **Session pooler** ou a conexão direta para executar migrations;
3. em **Authentication > Users**, crie o primeiro usuário administrador e copie o UUID dele;
4. anote a URL do projeto, a chave publicável e a chave secreta em **Project Settings > API Keys**.

Use a conexão Transaction pooler como `DATABASE_URL` da API. Ela normalmente usa a porta `6543`; mantenha `sslmode=require` e acrescente `pgbouncer=true` na query string. Use a conexão Session pooler ou direta como `DIRECT_URL` somente no terminal que executará migrations e bootstrap.

Antes do primeiro deploy, em um clone confiável do repositório, execute:

```powershell
$env:DIRECT_URL = "COLE_A_CONEXAO_SESSION_POOLER_OU_DIRETA"
$env:BOOTSTRAP_ADMIN_AUTH_ID = "UUID_DO_USUARIO_DO_SUPABASE_AUTH"
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@seu-dominio.org.br"
$env:BOOTSTRAP_ADMIN_NAME = "Nome do administrador"

pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm db:bootstrap

Remove-Item Env:DIRECT_URL
Remove-Item Env:BOOTSTRAP_ADMIN_AUTH_ID
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL
Remove-Item Env:BOOTSTRAP_ADMIN_NAME
```

No Linux, macOS ou WSL, defina as mesmas variáveis com `export`, execute os três comandos e depois remova-as com `unset`.

`pnpm db:bootstrap` é idempotente: cria ou atualiza permissões, perfis e o primeiro administrador. Não execute `pnpm db:seed` em produção, pois o seed contém dados demonstrativos.

## 2. Criar o projeto da API

Na conta Vercel:

1. clique em **Add New > Project**;
2. importe o repositório `matheusyanmonteiro/hermes`;
3. use um nome como `hermes-api`;
4. em **Root Directory**, selecione `apps/api`;
5. mantenha **Framework Preset: Next.js**;
6. habilite a inclusão de arquivos externos ao Root Directory, pois a API usa os pacotes compartilhados do monorepo;
7. em **Settings > General**, escolha Node.js `24.x`;
8. não altere o Install Command nem o Build Command detectados pela Vercel.

Cadastre estas variáveis para **Production**:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL do Transaction pooler do Supabase; tipo Secret |
| `AUTH_MODE` | `supabase` |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | chave publicável do Supabase |
| `SUPABASE_SECRET_KEY` | chave secreta do Supabase; tipo Secret |
| `WEB_URL` | URL HTTPS exata do projeto Web |
| `API_URL` | URL HTTPS exata deste projeto API |
| `TOKEN_ENCRYPTION_KEY` | chave Base64 de 32 bytes, exclusiva; tipo Secret |
| `OAUTH_STATE_SECRET` | segredo aleatório com pelo menos 32 caracteres; tipo Secret |
| `PORTAL_TIMEZONE` | `America/Sao_Paulo` |
| `UPLOAD_CHUNK_SIZE_BYTES` | `8388608` |
| `UPLOAD_CONCURRENCY` | `2` |
| `DOWNLOAD_CONCURRENCY` | `3` |

Não cadastre `DIRECT_URL`, `DEV_AUTH_SECRET`, `DEV_LOGIN_PASSWORD`, `POSTGRES_*` ou as variáveis `BOOTSTRAP_*` no projeto Vercel. As credenciais Google também não ficam no ambiente: o administrador as informa de forma criptografada pelo próprio portal.

Para gerar os dois segredos operacionais sem instalar ferramentas adicionais:

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Use uma saída diferente em cada variável e guarde uma cópia segura. Alterar `TOKEN_ENCRYPTION_KEY` depois de conectar contas Google torna os tokens já armazenados indecifráveis e exige reconexão.

## 3. Criar o projeto Web

Importe o mesmo repositório novamente:

1. use um nome como `hermes-web`;
2. selecione `apps/web` como **Root Directory**;
3. mantenha **Framework Preset: Next.js**;
4. habilite a inclusão de arquivos externos ao Root Directory;
5. selecione Node.js `24.x`;
6. mantenha os comandos detectados automaticamente.

Cadastre para **Production**:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://URL-DA-API/api/v1` |
| `NEXT_PUBLIC_AUTH_MODE` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável do Supabase |

Variáveis `NEXT_PUBLIC_*` fazem parte do bundle do navegador; nunca coloque nelas a chave secreta do Supabase ou qualquer outro segredo.

## 4. Fechar as URLs e publicar

Em cada projeto, abra **Settings > Domains** e confirme o domínio de produção. Domínios próprios são recomendados porque não mudam entre deploys. Depois:

1. corrija `WEB_URL` e `API_URL` na API com os domínios finais;
2. corrija `NEXT_PUBLIC_API_URL` no Web;
3. faça **Redeploy** dos dois projetos, começando pela API;
4. no Supabase, configure **Authentication > URL Configuration > Site URL** com a URL do Web;
5. adicione a URL do Web à lista de Redirect URLs do Supabase.

A API aceita uma origem Web exata por segurança. Deploys de Preview possuem domínios variáveis e, por padrão, não acessam a API de produção. Para a primeira publicação, valide o ambiente Production.

## 5. Configurar o Google Drive

No Google Cloud:

1. ative a Google Drive API;
2. configure a tela de consentimento OAuth;
3. crie um cliente OAuth do tipo **Web application**;
4. cadastre como URI autorizada `https://URL-DA-API/api/v1/drive/oauth/callback`.

Depois entre no Hermes com o administrador, abra **Contas Drive**, informe o Client ID, Client Secret e a mesma URI de callback, salve e conecte a conta Google.

Os uploads grandes são enviados pelo navegador diretamente à sessão retomável do Google Drive, evitando o limite de corpo das Functions. Os downloads continuam em streaming pela API; faça uma prova de conceito com os maiores arquivos esperados antes de abrir a operação.

## 6. Conferência final

Verifique nesta ordem:

1. `https://URL-DA-API/api/v1/health` responde com `status: ok` e `database: connected`;
2. a tela Web abre sem erro de CORS;
3. o primeiro administrador entra com a conta criada no Supabase;
4. uma campanha ativa foi configurada no portal;
5. o OAuth Google retorna ao domínio da API;
6. a sincronização lista um vídeo real;
7. upload e download funcionam com um arquivo pequeno e depois com um arquivo grande;
8. os relatórios e a auditoria registram as transferências.

Quando uma variável for alterada, gere um novo deploy: variáveis da Vercel não modificam deploys que já foram construídos.
