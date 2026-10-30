# Hermes

Portal para catalogar, distribuir e auditar mídias educacionais armazenadas no Google Drive. O Hermes oferece controle de acesso por perfil, uploads retomáveis, downloads em streaming, acompanhamento de transferências, campanhas com período de funcionamento e relatórios em CSV/XLSX.

Este documento explica como instalar o ambiente de desenvolvimento e como operar o sistema. O caminho recomendado usa Docker e funciona no Windows, Linux e macOS.

## Sumário

- [Recursos principais](#recursos-principais)
- [Instalação com Docker](#instalação-com-docker)
- [Primeiro acesso](#primeiro-acesso)
- [Como operar o Hermes](#como-operar-o-hermes)
- [Perfis de acesso](#perfis-de-acesso)
- [Conectar o Google Drive](#conectar-o-google-drive)
- [Comandos de administração](#comandos-de-administração)
- [Backup e restauração](#backup-e-restauração)
- [Desenvolvimento sem Docker](#desenvolvimento-sem-docker)
- [Solução de problemas](#solução-de-problemas)
- [Preparação para ambientes reais](#preparação-para-ambientes-reais)

## Recursos principais

- Catálogo unificado de vídeos de uma ou mais contas Google Drive.
- Pesquisa, seleção e download de vários arquivos.
- Upload de arquivos grandes em blocos retomáveis.
- Histórico de uploads e downloads por usuário e arquivo.
- Exportação de relatórios em CSV e Excel.
- Perfis `Administrador`, `Operador` e `Leitor`.
- Autenticação local para desenvolvimento e Supabase Auth para ambientes reais.
- Controle de campanha por data de início e encerramento.
- Auditoria, idempotência, correlação de requisições e rate limiting persistente.
- Interface responsiva para desktop, tablet e celular.

## Instalação com Docker

### 1. Pré-requisitos

Instale:

- [Git](https://git-scm.com/downloads);
- Docker Desktop 4 ou superior no Windows/macOS, ou Docker Engine com Compose no Linux;
- no Windows, Docker Desktop com backend WSL 2 habilitado.

Confirme a instalação:

```text
git --version
docker --version
docker compose version
```

O Node.js não precisa estar instalado no computador quando todo o desenvolvimento é executado pelo Docker.

### 2. Obter o projeto

```text
git clone https://github.com/matheusyanmonteiro/hermes.git
cd hermes
```

### 3. Criar o arquivo de configuração

No PowerShell do Windows:

```powershell
Copy-Item .env.example .env
```

No Linux, macOS ou Git Bash:

```bash
cp .env.example .env
```

Abra o arquivo `.env` e defina pelo menos:

| Variável             | Uso                                                                |
| -------------------- | ------------------------------------------------------------------ |
| `POSTGRES_PASSWORD`  | Senha do PostgreSQL local. Defina antes da primeira inicialização. |
| `DEV_AUTH_SECRET`    | Segredo local com pelo menos 32 caracteres para assinar sessões.   |
| `DEV_LOGIN_PASSWORD` | Senha compartilhada pelas contas locais de demonstração.           |

Para gerar um segredo aleatório usando somente o Docker:

```text
docker run --rm node:24-alpine node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Use valores diferentes para `POSTGRES_PASSWORD` e `DEV_AUTH_SECRET`. O arquivo `.env` é ignorado pelo Git e não deve ser enviado ao repositório.

> A senha do PostgreSQL só é aplicada na criação inicial do volume. Se ela for alterada depois, consulte [Senha do banco alterada após a instalação](#senha-do-banco-alterada-após-a-instalação).

### 4. Iniciar o sistema

```text
docker compose up --build -d
```

Na primeira execução, o Docker:

1. cria o PostgreSQL 17;
2. instala as dependências em volumes isolados;
3. aplica as migrations;
4. executa a carga de demonstração;
5. inicia a API;
6. inicia a interface depois que a API estiver saudável.

O primeiro build pode demorar alguns minutos. Acompanhe o estado com:

```text
docker compose ps -a
```

O estado esperado é:

- `db`, `api` e `web`: `Up` e `healthy`;
- `dependencies`, `migrate` e `seed`: `Exited (0)`.

Os serviços `Exited (0)` são tarefas de preparação que terminam normalmente; não representam erro.

### 5. Verificar a instalação

- Portal: <http://localhost:3000>
- Saúde da API: <http://localhost:3001/api/v1/health>
- Especificação da API: <http://localhost:3001/api/v1/openapi>

A rota de saúde deve retornar um JSON semelhante a:

```json
{
  "status": "ok",
  "service": "hermes-api",
  "database": "connected"
}
```

Se algum serviço não iniciar, consulte primeiro os logs:

```text
docker compose logs --tail=200 db api web
```

### Observações para Windows

- Os comandos do Docker funcionam no PowerShell, Windows Terminal e Git Bash.
- Use `git config core.autocrlf false` neste repositório para evitar mudanças desnecessárias de final de linha.
- O projeto usa polling para detectar alterações em volumes do Docker Desktop.
- Para melhor desempenho com WSL 2, mantenha o repositório dentro do filesystem Linux, por exemplo `~/projetos/hermes`.
- Dependências, caches do Next.js e cache do Turborepo ficam em volumes Docker; eles não sobrescrevem os arquivos do Windows.

## Primeiro acesso

O seed local cria três contas. Todas usam o valor configurado em `DEV_LOGIN_PASSWORD`:

| Perfil        | E-mail                  | Senha inicial do exemplo |
| ------------- | ----------------------- | ------------------------ |
| Administrador | `admin@hermes.local`    | `hermes-dev`             |
| Operador      | `operador@hermes.local` | `hermes-dev`             |
| Leitor        | `leitor@hermes.local`   | `hermes-dev`             |

Se você mudou `DEV_LOGIN_PASSWORD` no `.env`, use o novo valor, mesmo que o formulário ainda apresente o valor de demonstração.

Para a primeira conferência:

1. abra <http://localhost:3000>;
2. entre como `admin@hermes.local`;
3. confira a campanha em **Configurações**;
4. confira o catálogo de demonstração em **Biblioteca**;
5. conecte uma conta real em **Contas Drive** antes de tentar transferir arquivos reais.

O catálogo inicial é demonstrativo. Seus registros permitem navegar e testar a interface, mas os arquivos fictícios não existem no Google Drive. Uploads e downloads reais exigem uma conta Google conectada.

> O seed foi criado para desenvolvimento e homologação local. Não execute `pnpm db:seed` em um banco de produção: ele recria contas demonstrativas e reposiciona a campanha local como ativa.

## Como operar o Hermes

### Visão geral

O painel mostra:

- quantidade de vídeos e usuários ativos;
- transferências registradas e taxa de conclusão;
- atividade recente;
- período e progresso da campanha;
- estado das contas Google Drive.

Use esta tela no início da operação diária para identificar contas desconectadas, falhas recentes ou campanha encerrada.

### Configurar a campanha

A API só autoriza novos uploads e downloads durante uma campanha ativa.

1. Entre como Administrador.
2. Abra **Configurações**.
3. Informe nome, início e encerramento.
4. Clique em **Salvar período**.

O fuso operacional é `America/Sao_Paulo`. O botão **Encerrar agora** bloqueia novas transferências imediatamente, mas preserva o catálogo, eventos e relatórios.

### Conectar e sincronizar uma conta Drive

Depois de configurar as credenciais Google descritas em [Conectar o Google Drive](#conectar-o-google-drive):

1. abra **Contas Drive**;
2. clique em **Conectar conta**;
3. autorize o acesso no Google;
4. aguarde o retorno ao Hermes;
5. clique em **Sincronizar** na conta adicionada.

A sincronização cria ou atualiza o catálogo e marca como removidos os arquivos que deixaram de existir na origem. Ela não apaga os históricos de transferência.

### Localizar e baixar vídeos

1. Abra **Biblioteca**.
2. Pesquise pelo nome do vídeo, se necessário.
3. Marque um ou mais itens.
4. Clique em **Baixar selecionados**.
5. Escolha o destino solicitado pelo navegador.

Para arquivos grandes, use Chrome ou Edge. Esses navegadores permitem gravar o stream diretamente no destino escolhido. Em navegadores sem a File System Access API, o fallback em memória é limitado a 128 MiB.

Mantenha a aba aberta até o término. O Hermes registra separadamente a autorização, o início, o progresso, a conclusão informada pelo navegador e possíveis falhas.

### Enviar vídeos

1. Conecte e sincronize uma conta Google Drive.
2. Confirme que a campanha está ativa.
3. Abra **Novo upload**.
4. Arraste os vídeos ou clique na área de seleção.
5. Selecione a conta de destino.
6. Clique em **Iniciar uploads**.
7. Mantenha a aba aberta até todos os itens terminarem.

Somente arquivos cujo tipo MIME começa com `video/` são aceitos pela interface. O envio ocorre em blocos e até dois arquivos são processados em paralelo. Itens com falha podem ser tentados novamente.

### Acompanhar transferências

Abra **Transferências** para consultar uploads e downloads. É possível filtrar por tipo e pelos principais estados:

- `Em andamento`: bytes ainda estão sendo transferidos;
- `Concluída`: o navegador informou o recebimento ou envio completo;
- `Falha`: houve erro conhecido;
- `Sem confirmação`: o resultado final não pôde ser determinado.

A tela é atualizada automaticamente a cada 15 segundos e também possui atualização manual.

### Convidar usuários

No modo Supabase, um Administrador pode:

1. abrir **Usuários**;
2. clicar em **Convidar usuário**;
3. informar nome e e-mail;
4. selecionar o perfil;
5. enviar o convite.

O Supabase envia o e-mail de ativação. No modo local, o cadastro fica registrado para testes, mas não há envio de e-mail nem definição individual de senha; as contas semeadas são a forma recomendada de testar os perfis.

### Consultar e exportar relatórios

Abra **Relatórios** para visualizar solicitações, conclusões informadas, falhas e resultados desconhecidos por usuário e vídeo.

- **CSV** gera um arquivo tabular simples.
- **Excel completo** gera uma planilha `.xlsx`.

Uma aplicação Web não consegue provar que o arquivo permaneceu no dispositivo depois da transferência. Por isso, o sistema usa a expressão “recebimento completo informado pelo cliente”, e não “arquivo definitivamente salvo”.

## Perfis de acesso

| Perfil        | Capacidades principais                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| Administrador | Acesso completo, usuários, perfis, Drive, campanha, relatórios e auditoria.       |
| Operador      | Catálogo, uploads, downloads, todas as transferências, contas Drive e relatórios. |
| Leitor        | Painel, biblioteca, downloads e apenas as próprias transferências.                |

A autorização é aplicada pela API, não apenas pela interface. Uma chamada direta continua sujeita às permissões do usuário.

## Conectar o Google Drive

### 1. Preparar o Google Cloud

1. Crie ou selecione um projeto no Google Cloud Console.
2. Ative a Google Drive API.
3. Configure a tela de consentimento OAuth.
4. Cadastre os usuários de teste, se o aplicativo ainda estiver em modo de teste.
5. Crie um cliente OAuth do tipo **Aplicação Web**.
6. Cadastre esta URI de redirecionamento no desenvolvimento:

```text
http://localhost:3001/api/v1/drive/oauth/callback
```

### 2. Configurar o `.env`

Preencha:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/drive/oauth/callback
TOKEN_ENCRYPTION_KEY=
OAUTH_STATE_SECRET=
```

Gere `TOKEN_ENCRYPTION_KEY` com exatamente 32 bytes em Base64:

```text
docker run --rm node:24-alpine node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Gere outro valor independente para `OAUTH_STATE_SECRET`:

```text
docker run --rm node:24-alpine node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Reinicie API e Web depois de alterar o `.env`:

```text
docker compose up --build -d
```

Os tokens Google são armazenados criptografados com AES-256-GCM e nunca são enviados ao frontend. Antes de uma campanha real, teste arquivos grandes, renovação de token, perda de rede, cotas e política de consentimento da organização.

## Comandos de administração

### Estado e logs

```text
docker compose ps -a
docker compose logs --tail=200 api web db
docker compose logs -f api web
```

Interrompa `docker compose logs -f` com `Ctrl+C`; isso não encerra os serviços.

### Parar e iniciar

Parar sem apagar dados:

```text
docker compose down
```

Iniciar novamente:

```text
docker compose up -d
```

### Aplicar alterações no código ou dependências

```text
docker compose up --build -d
```

### Atualizar a partir do Git

Confirme primeiro que não existem alterações locais que precisem ser preservadas:

```text
git status
git pull --ff-only
docker compose up --build -d
docker compose ps -a
```

As migrations pendentes são aplicadas automaticamente antes da API iniciar.

### Executar migrations e seed manualmente

```text
docker compose run --rm migrate
docker compose run --rm seed
```

O seed é somente para ambientes locais e redefine dados demonstrativos importantes, inclusive a campanha.

### Apagar todo o ambiente local

```text
docker compose down -v
```

Este comando remove também o volume do PostgreSQL e todos os dados locais. Use-o apenas quando houver certeza de que o banco pode ser recriado.

## Backup e restauração

### Criar backup

Com o banco em execução:

```text
docker compose exec -T db pg_dump -U hermes -d hermes -Fc -f /tmp/hermes.backup
docker compose cp db:/tmp/hermes.backup ../hermes.backup
```

O comando salva `hermes.backup` na pasta imediatamente acima do repositório. Proteja-o como dado institucional.

### Restaurar backup

A restauração abaixo substitui os objetos atuais do banco. Faça outro backup antes.

```text
docker compose stop api web
docker compose cp ../hermes.backup db:/tmp/hermes.backup
docker compose exec -T db pg_restore --clean --if-exists -U hermes -d hermes /tmp/hermes.backup
docker compose start api web
```

Depois, confira `docker compose ps -a` e a rota de saúde da API.

## Desenvolvimento sem Docker

O fluxo nativo exige:

- Node.js 24 ou superior;
- pnpm 10.17;
- PostgreSQL 17 acessível pela variável `DATABASE_URL`.

Prepare as dependências e mantenha apenas o banco no Docker:

```text
corepack enable
corepack prepare pnpm@10.17.0 --activate
pnpm install
docker compose up -d db
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

Antes dos comandos `pnpm`, carregue as variáveis do `.env` no processo do terminal. Como alternativa, configure as variáveis equivalentes no sistema operacional e use a conexão PostgreSQL com `localhost`, não com o hostname `db` do Compose.

Comandos de qualidade:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

O workflow `.github/workflows/ci.yml` executa verificações no Ubuntu e no Windows e valida migrations, seed e build com PostgreSQL 17.

## Solução de problemas

### Uma porta já está em uso

As portas padrão são:

- Web: `3000`;
- API: `3001`;
- PostgreSQL: `5432`.

Para mudar apenas a porta publicada do banco, altere `POSTGRES_PORT` no `.env`. Para Web e API, ajuste os mapeamentos e URLs correspondentes no Compose.

### Senha do banco alterada após a instalação

O PostgreSQL aplica `POSTGRES_PASSWORD` somente ao criar o volume. Alterar apenas o `.env` depois disso causa falha de autenticação.

Em um ambiente local descartável, recrie tudo:

```text
docker compose down -v
docker compose up --build -d
```

Isso apaga o banco. Se os dados precisarem ser preservados, restaure o valor antigo no `.env` ou altere a senha do usuário diretamente no PostgreSQL antes de mudar a aplicação.

### API ou Web não fica saudável

```text
docker compose ps -a
docker compose logs --tail=200 migrate seed api web db
```

Procure por migration com falha, senha divergente, porta ocupada ou variável ausente.

### Alterações no código não aparecem

```text
docker compose restart api web
```

Se houve mudança em dependências, schema ou Dockerfile:

```text
docker compose up --build -d
```

### Conta Google desconectada

Confira `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` e `OAUTH_STATE_SECRET`. A URI deve ser idêntica à cadastrada no Google Cloud. Depois, conecte novamente a conta em **Contas Drive**.

### Download grande falha no navegador

Use uma versão atual do Chrome ou Edge, permita a escolha do destino e mantenha a aba aberta. Outros navegadores usam um fallback limitado a 128 MiB.

### Resposta HTTP 429

O rate limiting detectou tentativas excessivas. Aguarde o número de segundos informado em `retryAfterSeconds`. Em produção, o proxy reverso deve normalizar `X-Forwarded-For` e `X-Real-IP`.

## Preparação para ambientes reais

O `compose.yaml` e o `Dockerfile.dev` são voltados ao desenvolvimento. Antes de publicar o Hermes:

- use `AUTH_MODE=supabase` e configure o Supabase Auth;
- remova credenciais demonstrativas e não execute o seed local;
- armazene segredos em um cofre da plataforma;
- use HTTPS e um proxy reverso confiável;
- configure backup, retenção, monitoramento e alertas;
- restrinja o acesso ao PostgreSQL;
- valide as políticas de consentimento e os escopos Google com a instituição;
- execute a prova de conceito com arquivos e cotas reais;
- defina um processo de restauração testado;
- revise permissões e usuários antes de abrir a campanha.

O modo de autenticação `development` é recusado pela API quando `NODE_ENV=production`.

## Estrutura do repositório

```text
apps/web             interface do portal, porta 3000
apps/api             API REST versionada, porta 3001
packages/contracts   contratos Zod e DTOs compartilhados
packages/database    schema, migrations e cliente Prisma
packages/permissions códigos e regras de RBAC
docs                 arquitetura, operação e segurança
memory               contexto local para IA, ignorado pelo Git
```

## Documentação complementar

- [Arquitetura](docs/architecture/overview.md)
- [Desenvolvimento no Windows](docs/operations/windows.md)
- [Variáveis de ambiente](docs/operations/environment.md)
- [Configuração do Google Drive](docs/operations/google-drive.md)
- [Auditoria de transferências](docs/security/transfer-auditing.md)
- [Limitação de requisições](docs/security/rate-limiting.md)

## Licença

Uso interno do Instituto Sagres. Defina uma licença explícita antes de redistribuir o projeto.
