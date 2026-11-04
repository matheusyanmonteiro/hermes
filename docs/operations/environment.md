# Variáveis de ambiente

O arquivo `.env.example` documenta todas as chaves aceitas. Arquivos `.env` nunca são versionados.

## Obrigatórias no desenvolvimento

- `DATABASE_URL`: conexão PostgreSQL.
- `DEV_AUTH_SECRET`: no mínimo 32 caracteres e exclusivo da máquina/equipe.
- `NEXT_PUBLIC_API_URL`: base pública da API.

## Produção

- `AUTH_MODE=local` e `NEXT_PUBLIC_AUTH_MODE=local`.
- `AUTH_SECRET`: segredo aleatório com pelo menos 32 caracteres usado para assinar as sessões; mantenha somente na API.
- `DATABASE_URL` com o Transaction pooler do Supabase para o runtime.
- `DIRECT_URL` com a conexão direta ou Session pooler somente ao executar migrations e bootstrap.
- `TOKEN_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64 para AES-256-GCM.
- `OAUTH_STATE_SECRET`: segredo aleatório com pelo menos 32 caracteres.

O Supabase é usado apenas como PostgreSQL. O Hermes cria usuários, valida senhas e controla sessões sem depender do Supabase Auth. `DIRECT_URL` e as variáveis `BOOTSTRAP_*` não precisam ficar na Vercel.

As credenciais OAuth Google e a URI de retorno são cadastradas pelo administrador na tela **Contas Drive** e ficam criptografadas no banco.

Veja o inventário completo e os escopos por aplicação em [Deploy na Vercel](vercel.md).

Nunca use segredos em variáveis iniciadas por `NEXT_PUBLIC_`; elas fazem parte do bundle do navegador. `NEXT_PUBLIC_AUTH_MODE` contém apenas o nome público do modo, nunca uma chave.

