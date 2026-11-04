# Arquitetura do Hermes

O Hermes aplica separação real entre interface e regras de negócio, mantendo contratos e políticas compartilhados no monorepo.

```text
Navegador -> apps/web -> HTTPS -> apps/api -> PostgreSQL (Supabase em produção)
                  |            |       |----> Google Drive API
                  |            |
                  +-- cookie de sessão HttpOnly
```

## Limites de responsabilidade

- `web` renderiza a experiência e nunca recebe credenciais privilegiadas.
- `api` valida identidade, permissões, campanha e idempotência antes de persistir ou acessar o Drive.
- `database` concentra o modelo relacional e migrations reproduzíveis.
- `contracts` é a fonte dos formatos de entrada e saída.
- `permissions` define os códigos de RBAC e as checagens comuns.

O desenvolvimento usa PostgreSQL local em Docker. A mesma camada de persistência aceita uma conexão PostgreSQL do Supabase em produção.

## Autenticação

Há dois modos explícitos, ambos autenticados pelo próprio Hermes:

- `development`: permite que as contas semeadas usem a senha compartilhada de desenvolvimento e assina a sessão com `DEV_AUTH_SECRET`.
- `local`: valida a senha individual armazenada como hash no PostgreSQL e assina a sessão com `AUTH_SECRET`; é o modo obrigatório em produção.

Depois do login, a API grava um cookie de sessão `HttpOnly`, `Secure` em produção e `SameSite=Strict`. O navegador não recebe a senha armazenada nem mantém token em `localStorage`. Alterações de senha ou status invalidam as sessões anteriores. O modo `development` é recusado quando `NODE_ENV=production`.

## Datas e auditoria

Todas as datas são persistidas em UTC. A interface as apresenta no fuso configurado. Eventos de download e retratos do arquivo são imutáveis do ponto de vista dos usuários comuns.

