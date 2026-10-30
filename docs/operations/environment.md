# Variáveis de ambiente

O arquivo `.env.example` documenta todas as chaves aceitas. Arquivos `.env` nunca são versionados.

## Obrigatórias no desenvolvimento

- `DATABASE_URL`: conexão PostgreSQL.
- `DEV_AUTH_SECRET`: no mínimo 32 caracteres e exclusivo da máquina/equipe.
- `NEXT_PUBLIC_API_URL`: base pública da API.

## Produção

- `AUTH_MODE=supabase`.
- URLs e chaves publicáveis do Supabase.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e URI de retorno cadastrada.
- `TOKEN_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64 para AES-256-GCM.

Nunca use segredos em variáveis iniciadas por `NEXT_PUBLIC_`; elas fazem parte do bundle do navegador.

