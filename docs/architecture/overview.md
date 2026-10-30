# Arquitetura do Hermes

O Hermes aplica separação real entre interface e regras de negócio, mantendo contratos e políticas compartilhados no monorepo.

```text
Navegador -> apps/web -> HTTPS -> apps/api -> PostgreSQL
                                      |----> Supabase Auth
                                      |----> Google Drive API
```

## Limites de responsabilidade

- `web` renderiza a experiência e nunca recebe credenciais privilegiadas.
- `api` valida identidade, permissões, campanha e idempotência antes de persistir ou acessar o Drive.
- `database` concentra o modelo relacional e migrations reproduzíveis.
- `contracts` é a fonte dos formatos de entrada e saída.
- `permissions` define os códigos de RBAC e as checagens comuns.

O desenvolvimento usa PostgreSQL local em Docker. A mesma camada de persistência aceita uma conexão PostgreSQL do Supabase em produção.

## Autenticação

Há dois adaptadores explícitos:

- `development`: emite JWT curto assinado por um segredo exclusivamente local e vincula o `sub` a um usuário semeado.
- `supabase`: valida o JWT do Supabase e usa o `sub` como `authId` do usuário interno.

O modo local existe para tornar o repositório executável sem credenciais. A API recusa esse modo quando `NODE_ENV=production`.

## Datas e auditoria

Todas as datas são persistidas em UTC. A interface as apresenta no fuso configurado. Eventos de download e retratos do arquivo são imutáveis do ponto de vista dos usuários comuns.

