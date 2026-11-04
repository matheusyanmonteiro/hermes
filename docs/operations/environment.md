# Variáveis de ambiente

O arquivo `.env.example` documenta todas as chaves aceitas. Arquivos `.env` nunca são versionados.

## Obrigatórias no desenvolvimento

- `DATABASE_URL`: conexão PostgreSQL.
- `DEV_AUTH_SECRET`: no mínimo 32 caracteres e exclusivo da máquina/equipe.
- `NEXT_PUBLIC_API_URL`: base pública da API.

## Produção

- `AUTH_MODE=supabase`.
- URLs e chaves publicáveis do Supabase.
- `DATABASE_URL` com o Transaction pooler do Supabase para o runtime.
- `DIRECT_URL` com a conexão direta ou Session pooler somente ao executar migrations e bootstrap.
- `SUPABASE_SECRET_KEY` somente na API, para administração de usuários.
- `TOKEN_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64 para AES-256-GCM.
- `OAUTH_STATE_SECRET`: segredo aleatório com pelo menos 32 caracteres.

As credenciais OAuth Google e a URI de retorno são cadastradas pelo administrador na tela **Contas Drive** e ficam criptografadas no banco.

Veja o inventário completo e os escopos por aplicação em [Deploy na Vercel](vercel.md).

Nunca use segredos em variáveis iniciadas por `NEXT_PUBLIC_`; elas fazem parte do bundle do navegador.

