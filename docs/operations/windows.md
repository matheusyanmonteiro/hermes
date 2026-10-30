# Desenvolvimento no Windows

## Caminho recomendado

1. Instale Docker Desktop com backend WSL 2.
2. Ative o Git para preservar finais de linha do repositório (`git config core.autocrlf false` é recomendado neste projeto).
3. Copie `.env.example` para `.env` pelo Explorer ou com `Copy-Item .env.example .env` no PowerShell.
4. Execute `docker compose up --build`.

O código é montado no contêiner e o `WATCHPACK_POLLING` garante que alterações sejam detectadas em volumes do Docker Desktop.

## Desenvolvimento fora do Docker

Use Node 24 (nvm-windows, Volta ou instalador oficial), execute `corepack enable` e depois `pnpm install`. Mantenha somente o PostgreSQL no Docker com `docker compose up -d db`.

Os scripts do `package.json` são multiplataforma: não usam `export`, `rm`, `cp` ou encadeamentos específicos de shell.

## Problemas comuns

- Porta ocupada: configure `POSTGRES_PORT` no `.env`; as portas Web/API são 3000/3001.
- Mudança de dependências não refletida: recrie com `docker compose up --build`.
- Volume antigo incompatível: exporte o que for necessário e só depois use `docker compose down -v`.
- Lentidão: mantenha o repositório dentro do filesystem do WSL (`~/projetos`) ao usar terminal Linux.

