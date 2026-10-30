# Hermes

Portal seguro para catalogar, distribuir e auditar mídias educacionais armazenadas no Google Drive. O projeto é um monorepo com duas aplicações Next.js independentes: a interface Web e a API.

## Requisitos

- Docker Desktop 4+ (Windows, macOS ou Linux), ou
- Node.js 24+, pnpm 10.17+ e PostgreSQL 17+ para execução nativa.

No Windows, os comandos abaixo funcionam no PowerShell, Windows Terminal ou Git Bash. Não dependem de scripts Bash.

## Início rápido com Docker

1. Copie `.env.example` para `.env`.
2. Troque ao menos `POSTGRES_PASSWORD` e `DEV_AUTH_SECRET`.
3. Execute `docker compose up --build`.
4. Acesse a Web em <http://localhost:3000> e a API em <http://localhost:3001/api/v1/health>.

No modo local, entre com `admin@hermes.local` e a senha definida em `DEV_LOGIN_PASSWORD` (`hermes-dev` no exemplo).

O Compose aguarda o PostgreSQL, sincroniza as dependências nos volumes, aplica as migrations, executa a carga inicial idempotente e só então inicia as aplicações. Healthchecks impedem que a Web seja liberada antes de a API estar pronta.

Para encerrar use `docker compose down`. Para apagar também o banco local use `docker compose down -v` (operação destrutiva).

## Desenvolvimento nativo

```text
corepack enable
pnpm install
docker compose up -d db
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

## Estrutura

```text
apps/web             interface do portal (porta 3000)
apps/api             API REST versionada (porta 3001)
packages/contracts   contratos Zod e DTOs
packages/database    schema, migrations e cliente Prisma
packages/permissions RBAC compartilhado
docs                 arquitetura, operação e segurança
memory               contexto local para IA (ignorado pelo Git)
```

## Segurança

O modo `development` oferece contas locais sem depender de serviços externos. Ele é bloqueado em builds de produção. Em homologação/produção configure `AUTH_MODE=supabase` e as chaves publicáveis do Supabase. Segredos do Google e chaves de criptografia pertencem somente à API.

Consulte [Arquitetura](docs/architecture/overview.md), [desenvolvimento no Windows](docs/operations/windows.md), [variáveis de ambiente](docs/operations/environment.md), [configuração do Google Drive](docs/operations/google-drive.md), [limites da auditoria](docs/security/transfer-auditing.md) e [limitação de requisições](docs/security/rate-limiting.md).

## Qualidade

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

O workflow de CI repete lint, tipos e testes em Linux e Windows, além de validar migrations, carga inicial e build integrado com PostgreSQL 17.

